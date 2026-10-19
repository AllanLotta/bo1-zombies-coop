// Renders docs/images/four-players.png: four browser windows on vel.gg, each showing one player's view of the same
// lobby. The lobby is staged (no game engine is loaded, so it runs on any machine); vel.gg in the background is real.
//   npm run build && node scripts/render-hero.mjs [locale=en-US] [out=/tmp/four-players.png], then shrink it into docs/images/four-players.jpg
import { chromium } from "playwright";
import path from "node:path";

const LOCALE = process.argv[2] ?? "en-US";
const OUT = process.argv[3] ?? "docs/images/four-players.png";
const extension = path.resolve("extension");
const ROOM = "kq7m-2xw4-hb9t-r3np";
const players = [
  { n: 1, name: "Allan", host: true, status: "lobby", tone: "ok" },
  { n: 2, name: "Rafa", status: "ready", tone: "ok", ping: 38 },
  { n: 3, name: "Bruno", status: "ready", tone: "ok", ping: 64 },
  { n: 4, name: "Leo", status: "ready", tone: "ok", ping: 91 },
];
const lobby = { t: "lobby", slug: "kino", horde: false, playing: false, players };

/** Puts the page's card into one player's view of the lobby. */
function stage({ seat, lobby, room }) {
  const s = window.__bo1Coop;
  s.pump?.terminate?.();
  s.pump = { postMessage() {} };
  Object.defineProperty(s, "socket", { configurable: true, get: () => "open", set() {} });
  window.five = window.five ?? {};
  Object.defineProperty(window.five, "screen", { configurable: true, get: () => "ready" });
  s.engine = new Proxy({}, { get: (_, k) => (k === "serverSlots" ? () => [] : k === "connectionState" ? () => 10 : k === "menuOpen" ? () => false : () => 0) });
  s.build = { introState: 0 };
  s.room = room;
  s.peer = true;
  const me = lobby.players[seat];
  s.name = me.name;
  if (seat === 0) {
    s.zone = "zombie_theater";
    s.queues = { seats: { 1: { port: 2406 }, 2: { port: 2407 }, 3: { port: 2408 } } };
    const rtts = {};
    lobby.players.slice(1).forEach((p, i) => {
      rtts[i + 1] = p.ping;
      s.guests.set(i + 1, { seat: i + 1, present: true, state: { phase: "connected", name: p.name }, pause: false, slot: { slot: i + 1, state: 5, loopback: true, port: 2406 + i }, leftAt: 0, kicks: 0, lastKickAt: 0, sent: {} });
    });
    s.queues.seats = { 1: { port: 2406 }, 2: { port: 2407 }, 3: { port: 2408 } };
    const slots = lobby.players.slice(1).map((p, i) => ({ slot: i + 1, state: 5, loopback: true, port: 2406 + i }));
    s.engine = new Proxy({}, { get: (_, k) => (k === "serverSlots" ? () => slots : k === "connectionState" ? () => 10 : k === "menuOpen" ? () => false : () => 0) });
    Object.defineProperty(s, "stats", { configurable: true, get: () => ({ rtt: 91, rtts }), set() {} });
  } else {
    Object.assign(s, { phase: "connected", seat, lobby, hostInfo: { slug: "kino", zone: "zombie_theater" }, hostState: { screen: "ready", ready: true } });
    Object.defineProperty(s, "stats", { configurable: true, get: () => ({ rtt: me.ping }), set() {} });
  }
}

const context = await chromium.launchPersistentContext("/tmp/bo1-hero-profile", {
  headless: false,
  locale: LOCALE,
  viewport: { width: 960, height: 700 },
  deviceScaleFactor: 2,
  args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`, `--lang=${LOCALE}`],
});
const shots = [];
for (let seat = 0; seat < 4; seat += 1) {
  const page = await context.newPage();
  const mode = seat === 0 ? "host" : "join";
  // A dead loopback relay keeps the real network out of the staged state.
  await page.goto(`https://vel.gg/bsz#coop=${mode}&room=${ROOM}&coopRelay=${encodeURIComponent("http://127.0.0.1:9")}`);
  await page.waitForFunction(() => window.__bo1Coop?.card);
  await page.waitForTimeout(1500);
  await page.evaluate(stage, { seat, lobby, room: ROOM });
  await page.waitForTimeout(800);
  shots.push((await page.screenshot()).toString("base64"));
}

// Four windows tiled on a dark desktop, each with a title bar naming the player.
const titles = players.map((p) => `${p.name}${p.host ? " (host)" : ""} · vel.gg/bsz`);
const canvas = await context.newPage();
await canvas.setViewportSize({ width: 1920, height: 1490 });
await canvas.setContent(`<style>
  html, body { overflow: hidden; }
  body { margin: 0; background: radial-gradient(1400px 900px at 50% 40%, #2a1a14, #0c0a09); font-family: system-ui, -apple-system, sans-serif; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; padding: 36px 40px; }
  .win { border-radius: 12px; overflow: hidden; background: #1d1b1a; box-shadow: 0 18px 50px rgba(0,0,0,.6); border: 1px solid #3a3530; }
  .bar { height: 34px; display: flex; align-items: center; gap: 8px; padding: 0 14px; color: #bdb5aa; font-size: 14px; }
  .bar i { width: 12px; height: 12px; border-radius: 50%; display: inline-block; }
  .bar span { margin-left: 10px; }
  img { display: block; width: 100%; }
</style><div class="grid">${shots.map((b64, i) => `<div class="win"><div class="bar"><i style="background:#ff5f57"></i><i style="background:#febc2e"></i><i style="background:#28c840"></i><span>${titles[i]}</span></div><img src="data:image/png;base64,${b64}"></div>`).join("")}</div>`);
await canvas.waitForTimeout(500);
await canvas.screenshot({ path: OUT });
await context.close();
console.log(`rendered ${OUT}`);
