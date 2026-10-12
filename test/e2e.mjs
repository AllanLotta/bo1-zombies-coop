// End to end on the real vel.gg: one browser per player, each with the extension, joined through a relay.
//
//   npm run relay:dev, then: node test/e2e.mjs [players=2] [map=nacht] [relay=http://127.0.0.1:8787]
//
// Environment: HOLD_S=<s> host waits that long in the lobby before starting; PAUSETEST=<rounds> presses Escape and T
// on several players and checks nobody crashes; SOAK=<s> keeps playing that long; DEADLINE_MIN=<min> gives up after.
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
const DEADLINE = Date.now() + Number(process.env.DEADLINE_MIN ?? 10) * 60000;

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const extension = path.resolve("extension");
const ROOM = Array.from({ length: 16 }, () => "0123456789abcdefghjkmnpqrstvwxyz"[(Math.random() * 32) | 0]).join("").match(/.{4}/g).join("-");
// A relay on this machine is reached through a test-only URL parameter.
const relayParam = /127\.0\.0\.1|localhost/.test(RELAY) ? `&coopRelay=${encodeURIComponent(RELAY)}` : "";
const t0 = Date.now();
const log = (...args) => console.log(((Date.now() - t0) / 1000).toFixed(1).padStart(6), ...args);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function launch(i) {
  const context = await chromium.launchPersistentContext(`/tmp/bo1-e2e-profile-${i}`, {
    headless: false,
    viewport: { width: 800, height: 450 },
    args: [
      `--disable-extensions-except=${extension}`,
      `--load-extension=${extension}`,
      "--disable-background-timer-throttling",
      "--disable-renderer-backgrounding",
      "--disable-backgrounding-occluded-windows",
      // https page -> relay on 127.0.0.1: skip Chrome's local-network permission prompt
      "--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessSendPreflights,PrivateNetworkAccessRespectPreflightResults",
      `--window-position=${(i % 2) * 820},${Math.floor(i / 2) * 540}`,
      "--window-size=800,520",
    ],
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
  const page = context.pages()[0] ?? (await context.newPage());
  const logFile = `${OUT}/p${i + 1}.console.log`;
  page.on("console", (m) => fs.appendFileSync(logFile, `${m.text()}\n`));
  page.on("pageerror", (e) => fs.appendFileSync(logFile, `PAGEERROR ${e.message}\n`));
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
        stats: s.stats && { in: s.stats.packetsIn, out: s.stats.packetsOut, rtt: s.stats.rtt && Math.round(s.stats.rtt), lost: s.stats.lost },
      };
    })
    .catch((error) => ({ unreachable: String(error.message).slice(0, 80) }));

const players = [];
for (let i = 0; i < PLAYERS; i += 1) players.push(await launch(i));
const [host, ...guests] = players;
await host.page.goto(`https://vel.gg/bo1z/${MAP}?coop=host&room=${ROOM}${relayParam}`);
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
    if (p.s?.screen === "landing") {
      await p.page.mouse.click(150, 300).catch(() => {});
      await p.page.keyboard.press("Space").catch(() => {});
    }
  }
  const previous = guests[opened - 1];
  if (opened < guests.length && host.s?.screen === "ready" && (!previous || previous.s?.phase === "connected")) {
    const g = guests[opened++];
    log(`${g.name} opens the invite`);
    await g.page.goto(`https://vel.gg/bo1z/?coop=join&room=${ROOM}${relayParam}`);
  }
  const connected = guests.filter((g) => g.s?.phase === "connected" && g.s?.connection === 10).length;
  if (connected === guests.length && !allConnectedAt) allConnectedAt = Date.now();
  const holding = allConnectedAt && Date.now() - allConnectedAt < HOLD_MS;
  if (!hostStarted && !holding && host.s?.screen === "ready" && !host.s.gate && connected === guests.length) {
    log("everyone connected, the host starts");
    await host.page.mouse.click(150, 300);
    hostStarted = true;
  }
  if (hostStarted && host.s?.screen === "playing") {
    for (const g of guests) if (g.s?.screen === "ready") await g.page.mouse.click(150, 300);
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

let ok = allIn;
if (allIn) {
  await wait(4000);
  for (const g of guests) await g.page.keyboard.down("w");
  await wait(1500);
  for (const g of guests) await g.page.keyboard.up("w");
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
        await who.page.mouse.click(150, 300);
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
        await who.page.mouse.click(150, 300);
        if (!(await healthy(`${who.name} chat (round ${round})`))) {
          ok = false;
          break rounds;
        }
      }
    }
  }

  for (let k = 0; k < Number(process.env.SOAK ?? 20); k += 1) {
    await wait(1000);
    if (k % 10 === 9) for (const p of players) log(p.name.padEnd(4), JSON.stringify(await snapshot(p)));
  }
}

for (const p of players) {
  const notes = await p.page.evaluate(() => window.__bo1Coop?.log ?? []).catch(() => []);
  fs.writeFileSync(`${OUT}/${p.name}.coop.log`, notes.join("\n"));
}
if (!process.env.KEEP) for (const p of players) await p.context.close().catch(() => {});
log("logs in", OUT);
process.exit(ok ? 0 : 1);
