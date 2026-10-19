// End to end on the real vel.gg: one browser per player, each with the extension, joined through a relay.
//
//   npm run relay:dev, then: node test/e2e.mjs [players=2] [map=nacht] [relay=http://127.0.0.1:8787]
//
// Environment: HOLD_S=<s> host waits that long in the lobby before starting; PAUSETEST=<rounds> presses Escape and T
// on several players and checks nobody crashes; SOAK=<s> keeps playing that long; DEADLINE_MIN=<min> gives up after.
//
// GUEST_DELAY_S=<s> guests click into the game that long after the host (the order players report as laggy).
// GUEST_FIRST_S=<s> guests click in first and the host that long after, guests standing still.
//
// EXT=<folder> tests another build of the extension (an unzipped release, say) instead of ./extension.
//
// LITE=1 is easy on the machine: one browser and one profile for everyone (the map pack is downloaded and stored once,
// and later runs reuse it), small windows, vel.gg's low graphics quality at half resolution, no sound, and the game
// capped at LITE_FPS (default 30) frames per second.
//
// Every player is a whole game engine (several GB of memory): on a 16 GB machine keep it to 3 players.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const PLAYERS = Number(process.argv[2] ?? 2);
const MAP = process.argv[3] ?? "nacht";
const RELAY = process.argv[4] ?? "http://127.0.0.1:8787";
const OUT = process.env.OUT ?? "/tmp/bo1-e2e";
const HOLD_MS = Number(process.env.HOLD_S ?? 0) * 1000;
const GUEST_DELAY_MS = Number(process.env.GUEST_DELAY_S ?? 0) * 1000;
const GUEST_FIRST_MS = process.env.GUEST_FIRST_S == null ? null : Number(process.env.GUEST_FIRST_S) * 1000;
const LITE = Boolean(process.env.LITE);
const LITE_FPS = Number(process.env.LITE_FPS ?? 30);
const VIEWPORT = LITE ? { width: 400, height: 300 } : { width: 800, height: 450 };
// On the game, clear of the co-op card (top right; in the small LITE window it covers all but a strip on the left).
const CLICK = LITE ? [30, 200] : [150, 300];
const DEADLINE = Date.now() + Number(process.env.DEADLINE_MIN ?? 10) * 60000;

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const extension = path.resolve(process.env.EXT ?? "extension");
const ROOM = Array.from({ length: 16 }, () => "0123456789abcdefghjkmnpqrstvwxyz"[(Math.random() * 32) | 0]).join("").match(/.{4}/g).join("-");
// A relay on this machine is reached through a test-only URL parameter.
const liteParam = LITE ? "&quality=low&renderScale=0.5" : "";
const relayParam = /127\.0\.0\.1|localhost/.test(RELAY) ? `&coopRelay=${encodeURIComponent(RELAY)}` : "";
const t0 = Date.now();
const log = (...args) => console.log(((Date.now() - t0) / 1000).toFixed(1).padStart(6), ...args);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const browserArgs = (i) => [
  `--disable-extensions-except=${extension}`,
  `--load-extension=${extension}`,
  "--disable-background-timer-throttling",
  "--disable-renderer-backgrounding",
  "--disable-backgrounding-occluded-windows",
  // https page -> relay on 127.0.0.1: skip Chrome's local-network permission prompt
  "--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessSendPreflights,PrivateNetworkAccessRespectPreflightResults",
  ...(LITE ? ["--mute-audio"] : [`--window-position=${(i % 2) * 820},${Math.floor(i / 2) * 540}`, "--window-size=800,520"]),
];

async function openContext(dir, i) {
  const context = await chromium.launchPersistentContext(dir, {
    headless: false,
    viewport: VIEWPORT,
    args: browserArgs(i),
  });
  // Automated windows are refused pointer lock, which the game needs to leave "click to start". Test only.
  await context.addInitScript(() => {
    let locked = null;
    Object.defineProperty(Document.prototype, "pointerLockElement", { configurable: true, get: () => locked });
    const notify = () => setTimeout(() => document.dispatchEvent(new Event("pointerlockchange")), 0);
    Element.prototype.requestPointerLock = function () {
      locked = this;
      notify();
      return Promise.resolve();
    };
    Document.prototype.exitPointerLock = function () {
      locked = null;
      notify();
    };
  });
  if (LITE) {
    await context.addInitScript(() => {
      globalThis.__kisakMuted = true;
      try {
        localStorage.setItem("bo1zm-quality", "low");
      } catch {
        // the page then picks its own quality
      }
    });
  }
  return context;
}

let shared = null;
async function launch(i) {
  let context;
  let page;
  if (LITE) {
    shared ??= await openContext("/tmp/bo1-e2e-profile-lite", i);
    context = shared;
    // A new page would be a background tab of the same window, which gets no input: each player is a popup window,
    // opened without an opener so it runs in its own renderer process (and thread) instead of sharing the host's.
    const opener = context.pages()[0] ?? (await context.newPage());
    if (i === 0) page = opener;
    else {
      const features = `popup,noopener,width=${VIEWPORT.width},height=${VIEWPORT.height + 40},left=${(i % 2) * 420},top=${Math.floor(i / 2) * 380}`;
      [page] = await Promise.all([context.waitForEvent("page"), opener.evaluate((f) => window.open("about:blank", "_blank", f), features)]);
      await page.setViewportSize(VIEWPORT);
    }
  } else {
    context = await openContext(`/tmp/bo1-e2e-profile-${i}`, i);
    page = context.pages()[0] ?? (await context.newPage());
  }
  const logFile = `${OUT}/p${i + 1}.console.log`;
  page.on("console", (m) => fs.appendFileSync(logFile, `${m.text()}\n`));
  page.on("pageerror", (e) => fs.appendFileSync(logFile, `PAGEERROR ${e.message}\n`));
  // A dialog would block every later call into the page.
  page.on("dialog", (d) => {
    log(`p${i + 1} dialog (${d.type()}): ${d.message()}`);
    d.dismiss().catch(() => {});
  });
  return { i, context, page, name: i === 0 ? "host" : `p${i + 1}` };
}

const snapshot = (player) =>
  player.page
    .evaluate(() => {
      const s = window.__bo1Coop;
      if (!s) return null;
      return {
        screen: window.five?.screen,
        phase: s.phase,
        seat: s.seat,
        peer: s.peer,
        error: s.error,
        connection: s.engine?.connectionState?.() ?? null,
        guests: [...s.guests.values()].map((g) => `${g.seat}:${g.present ? "in" : "out"}:${g.state?.phase ?? "?"}:${g.slot?.state ?? 0}`).join(" "),
        turn: s.joinTurn,
        gate: s.gate,
        paused: s.paused ?? false,
        ts: s.engine?.codeTimeScale ? +s.engine.codeTimeScale().toFixed(2) : null,
        // Frames over the last 3 s and how fast game time ran against the wall clock (1 = normal, below = slow motion).
        fps: (() => {
          const read = (window.__e2eFrames ??= window.five?.engine?.presentReader?.());
          const f = read?.();
          if (!f?.intervals.length) return null;
          const total = f.intervals.reduce((sum, v) => sum + v, 0);
          return { avg: Math.round((1000 * f.intervals.length) / total), worstMs: Math.round(Math.max(...f.intervals)) };
        })(),
        pace: (() => { const v = (window.five?.views ?? []).filter((x) => x.ms > performance.now() - 3000); return v.length > 1 ? +((v.at(-1).engineMs - v[0].engineMs) / (v.at(-1).ms - v[0].ms)).toFixed(2) : null; })(),
        stats: s.stats && { in: s.stats.packetsIn, out: s.stats.packetsOut, rtt: s.stats.rtt && Math.round(s.stats.rtt), lost: s.stats.lost },
      };
    })
    .catch((error) => ({ unreachable: String(error.message).slice(0, 80) }));

const players = [];
for (let i = 0; i < PLAYERS; i += 1) players.push(await launch(i));
const [host, ...guests] = players;
await host.page.goto(`https://vel.gg/bsz/${MAP}?coop=host&coopRoom=${ROOM}${relayParam}${liteParam}`);
log("room", ROOM, "players", PLAYERS, "map", MAP);

// Guests open the invite one at a time, each once the previous one is in: loading several engines at once can starve
// a single machine badly enough to time players out.
let opened = 0;
const last = {};
let hostStarted = false;
let allIn = false;
let allConnectedAt = 0;
while (Date.now() < DEADLINE) {
  for (const p of players) {
    p.s = await snapshot(p);
    const key = JSON.stringify({ ...p.s, stats: undefined });
    if (key !== last[p.name]) log(p.name.padEnd(4), (last[p.name] = key));
    if (LITE && !p.capped && ["ready", "playing"].includes(p.s?.screen)) {
      p.capped = await p.page.evaluate((fps) => window.__bo1Coop.engine?.command(`com_maxfps ${fps}`) ?? false, LITE_FPS).catch(() => false);
      if (p.capped) log(`${p.name} capped at ${LITE_FPS} fps`);
    }
    if (p.s?.screen === "landing") {
      await p.page.mouse.click(...CLICK).catch(() => {});
      await p.page.keyboard.press("Space").catch(() => {});
    }
  }
  const previous = guests[opened - 1];
  if (opened < guests.length && host.s?.screen === "ready" && (!previous || previous.s?.phase === "connected")) {
    const g = guests[opened++];
    log(`${g.name} opens the invite`);
    await g.page.goto(`https://vel.gg/bsz#coop=join&room=${ROOM}${relayParam}${liteParam}`);
  }
  const connected = guests.filter((g) => g.s?.phase === "connected" && g.s?.connection === 10).length;
  if (connected === guests.length && !allConnectedAt) allConnectedAt = Date.now();
  const holding = allConnectedAt && Date.now() - allConnectedAt < HOLD_MS;
  if (GUEST_FIRST_MS != null && !hostStarted && !holding && connected === guests.length) {
    for (const g of guests) if (g.s?.screen === "ready") await g.page.mouse.click(...CLICK);
    if (guests.every((g) => g.s?.screen === "playing")) {
      log(`guests are in first, the host starts in ${GUEST_FIRST_MS / 1000} s`);
      await wait(GUEST_FIRST_MS);
      await host.page.mouse.click(...CLICK);
      hostStarted = Date.now();
    }
  } else if (!hostStarted && !holding && host.s?.screen === "ready" && !host.s.gate && connected === guests.length) {
    log("everyone connected, the host starts");
    await host.page.mouse.click(...CLICK);
    hostStarted = Date.now();
  }
  if (hostStarted && host.s?.screen === "playing" && Date.now() - hostStarted >= GUEST_DELAY_MS) {
    for (const g of guests) if (g.s?.screen === "ready") await g.page.mouse.click(...CLICK);
    if (guests.every((g) => g.s?.screen === "playing")) {
      allIn = true;
      break;
    }
  }
  if (players.some((p) => p.s?.error)) {
    log("ERROR", players.map((p) => p.s?.error));
    break;
  }
  await wait(1000);
}
log(allIn ? "ALL PLAYERS IN THE GAME" : "NOT ALL IN");

// Every guest holds W; the host's server must see each of them move (its engine logs "pN=.../x,y,z" about once a
// second). The host stands still meanwhile.
async function walkCheck(when) {
  const positions = () => {
    const lines = fs.readFileSync(`${OUT}/p1.console.log`, "utf8").split("\n").filter((l) => l.startsWith("KISAK_COOP state"));
    const last = lines.at(-1) ?? "";
    return Object.fromEntries([...last.matchAll(/ p(\d)=\S*\/(-?[\d.]+),(-?[\d.]+),(-?[\d.]+)/g)].map((m) => [m[1], [+m[2], +m[3]]]));
  };
  const before = positions();
  // Players are solid: two closer than a body width are stuck in each other.
  const slots = Object.keys(before);
  const pairs = slots.flatMap((a, i) => slots.slice(i + 1).map((b) => [`${a}-${b}`, Math.round(Math.hypot(before[a][0] - before[b][0], before[a][1] - before[b][1]))]));
  const overlapping = pairs.filter(([, d]) => d < 30);
  if (overlapping.length) log(`OVERLAP ${when}: ${overlapping.map(([pair, d]) => `${pair} ${d}u`).join(", ")}`);
  for (const g of guests) await g.page.keyboard.down("w");
  await wait(1500);
  for (const g of guests) await g.page.keyboard.up("w");
  await wait(2500);
  const after = positions();
  const moved = Object.keys(after).map((n) => [n, before[n] ? Math.round(Math.hypot(after[n][0] - before[n][0], after[n][1] - before[n][1])) : null]);
  log(`walk check ${when}: server-side distance per player slot`, JSON.stringify(Object.fromEntries(moved)));
  const stuck = moved.filter(([n, d]) => n !== "0" && (d ?? 0) < 20);
  if (stuck.length) log(`STUCK ${when}: slot(s) ${stuck.map(([n]) => n).join(", ")} did not move on the server`);
  return !stuck.length && !overlapping.length;
}

let ok = allIn;
if (allIn) {
  await wait(4000);
  // The host walks a few steps: a guest that spawned far away is then sent to a spot the host walked over.
  await host.page.keyboard.down("s");
  await wait(1200);
  await host.page.keyboard.up("s");
  await wait(4000);
  if (!(await walkCheck("after joining"))) ok = false;
  // "Go to the host" (what a guest that spawned far from everyone also does) must not leave anyone stuck.
  for (const g of guests) log(`${g.name} goes to the host:`, await g.page.evaluate(() => window.__bo1Coop.card.handlers.goToHost()));
  await wait(3000);
  if (!(await walkCheck("after going to the host"))) ok = false;
  for (const g of guests) {
    const lobby = await g.page.evaluate(() => window.__bo1Coop.lobby?.players?.map((p) => `${p.n}:${p.status}${p.ping != null ? `:${p.ping}ms` : ""}`));
    log(`${g.name} sees the lobby`, JSON.stringify(lobby));
  }
  for (const p of players) await p.page.screenshot({ path: `${OUT}/${p.name}.png` }).catch(() => {});

  if (process.env.PAUSETEST) {
    const healthy = async (what) => {
      await wait(4000);
      const broken = [];
      for (const p of players) {
        const s = await snapshot(p);
        if (s?.screen === "error" || (p !== host && s?.phase !== "connected")) broken.push(`${p.name}:${s?.screen}/${s?.phase}`);
      }
      log(broken.length ? `FAIL after ${what}: ${broken.join(" ")}` : `ok  after ${what}`);
      return broken.length === 0;
    };
    const actors = [guests[0], host, guests.at(-1)].filter(Boolean);
    rounds: for (let round = 1; round <= Number(process.env.PAUSETEST); round += 1) {
      for (const who of actors) {
        await who.page.keyboard.press("Escape");
        await wait(3000);
        log(`${who.name} pressed Escape: host paused = ${await host.page.evaluate(() => window.__bo1Coop.paused)}`);
        await who.page.keyboard.press("Escape");
        await wait(500);
        await who.page.mouse.click(...CLICK);
        if (!(await healthy(`${who.name} Escape (round ${round})`))) {
          ok = false;
          break rounds;
        }
        await who.page.keyboard.press("t");
        await wait(1000);
        await who.page.keyboard.type("oi");
        await wait(500);
        await who.page.keyboard.press("Enter");
        await wait(500);
        await who.page.mouse.click(...CLICK);
        if (!(await healthy(`${who.name} chat (round ${round})`))) {
          ok = false;
          break rounds;
        }
      }
    }
  }

  if (process.env.GAMEOVER) {
        for (const p of players) log(p.name.padEnd(4), "before", JSON.stringify(await snapshot(p)));
    if (process.env.DUMP) for (const p of players) await p.page.evaluate(() => window.__bo1Coop.engine.command("echo DUMP_BEFORE;dvardump;echo DUMP_END"));
    // Everyone on 1 health and the game at triple speed: the first zombies down everybody, which ends the game.
    await host.page.evaluate((n) => {
      const s = window.__bo1Coop, f = s.build.fun;
      for (let slot = 0; slot < n; slot += 1) s.engine.setInt(f.entities + slot * f.entitySize + f.ent.health, 1);
      if (location.search.includes("fast")) s.engine.command("timescale 3");
    }, players.length);
    log("everyone on 1 health, timescale 3");
  }
  const every = process.env.GAMEOVER ? 5 : 10;
  for (let k = 0; k < Number(process.env.SOAK ?? 20); k += 1) {
    await wait(1000);
    if (process.env.RELEASE && k === Number(process.env.RELEASE)) {
      for (const p of players) log(p.name, "introState", await p.page.evaluate(() => window.__bo1Coop.engine.int(window.__bo1Coop.build.introState)));
      for (const g of guests) await g.page.evaluate(() => window.__bo1Coop.engine.Module._KB_Input(7, 1, 0));
      log("guests: intro released again");
    }
    if (process.env.RESETMF && k === Number(process.env.RESETMF)) {
      for (const g of guests) await g.page.evaluate(() => window.__bo1Coop.engine.command("set hud_missionFailed 0"));
      log("guests: set hud_missionFailed 0");
    }
    if (process.env.GAMEOVER && k === 75) await host.page.evaluate(() => window.__bo1Coop.engine.command("timescale 1"));
    // DIAG="dvar dvar ...": every player prints these to its console log (pN.console.log) every few seconds.
    if (process.env.DIAG && k % every === 0) for (const p of players) await p.page.evaluate((d) => window.__bo1Coop.engine.command(d), process.env.DIAG.split(/\s+/).join(";")).catch(() => {});
    if (k % every === every - 1) {
      for (const p of players) log(p.name.padEnd(4), JSON.stringify(await snapshot(p)));
      if (process.env.GAMEOVER) for (const p of players) await p.page.screenshot({ path: `${OUT}/${p.name}-${k + 1}s.png` }).catch(() => {});
    }
  }
}

if (process.env.DUMP) {
  for (const p of players) await p.page.evaluate(() => window.__bo1Coop.engine.command("echo DUMP_AFTER;dvardump;echo DUMP_END")).catch(() => {});
  await wait(2000);
}
for (const p of players) {
  const notes = await p.page.evaluate(() => window.__bo1Coop?.log ?? []).catch(() => []);
  fs.writeFileSync(`${OUT}/${p.name}.coop.log`, notes.join("\n"));
}
if (!process.env.KEEP) for (const context of new Set(players.map((p) => p.context))) await context.close().catch(() => {});
log("logs in", OUT);
process.exit(ok ? 0 : 1);
