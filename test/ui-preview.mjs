// Screenshots of the card in every state, staged on vel.gg's landing page without loading the game (one light
// browser). Used for the README images.
//   node test/ui-preview.mjs [locale=pt-BR] [outdir=/tmp/bo1-ui] [scale=1]
import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";

const LOCALE = process.argv[2] ?? "pt-BR";
const OUT = process.argv[3] ?? "/tmp/bo1-ui";
const SCALE = Number(process.argv[4] ?? 1);
fs.mkdirSync(OUT, { recursive: true });
const extension = path.resolve("extension");
const ctx = await chromium.launchPersistentContext("/tmp/bo1-ui-profile", {
  headless: false, locale: LOCALE, viewport: { width: 1100, height: 900 }, deviceScaleFactor: SCALE,
  args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`, `--lang=${LOCALE}`],
});
const ROOM = "n3m0-a447-ajbr-sj80";

// Stands in for the engine and the network so the card can be put in any state.
const fake = ({ screen, mem = true, coop }) => {
  const c = window.__bo1Coop;
  window.five = window.five ?? {};
  Object.defineProperty(window.five, "screen", { configurable: true, get: () => screen });
  if (mem) {
    const clients = coop.clients ?? [];
    c.engine = new Proxy({}, { get: (_, k) => k === "serverSlots" ? () => clients : k === "connectionState" ? () => 10 : k === "menuOpen" ? () => false : k === "command" ? () => true : k === "int" && coop.fun ? () => 2500 : k === "byte" ? () => 1 : () => 0 });
  }
  c.build = c.build ?? { introState: 0 };
  if (coop.fun) {
    c.build.fun = { entities: 0, entitySize: 0, ent: { client: 0, flags: 0, health: 0 }, entFlags: {}, client: { score: 0, ammoSlots: 0 }, clientFlags: {}, cheatsDvar: 0 };
    Object.assign(c.fun, coop.fun);
  }
  c.queues = { seats: { 1: { port: 2406 }, 2: { port: 2407 }, 3: { port: 2408 } } };
  for (const [k, v] of Object.entries(coop.set ?? {})) c[k] = v;
  for (const g of coop.guests ?? []) c.guests.set(g.seat, { present: true, state: null, pause: false, slot: null, leftAt: 0, kicks: 0, lastKickAt: 0, sent: {}, ...g });
  c.pump?.terminate?.();
  c.pump = { postMessage() {} };
  // Keep the socket and stats as staged, whatever the real worker reports.
  const stats = coop.stats;
  if (stats) Object.defineProperty(c, "stats", { configurable: true, get: () => stats, set() {} });
  Object.defineProperty(c, "socket", { configurable: true, get: () => coop.socket ?? "open", set() {} });
};

const scenes = [
  { name: "1-solo", url: "/bsz/", run: null },
  { name: "2-host-lobby", url: `/bsz/?coop=host&coopRoom=${ROOM}`, run: { screen: "ready", coop: {
    set: { zone: "zombie_theater", name: "Allan", peer: true, gate: false },
    clients: [{ slot: 1, state: 5, loopback: true, port: 2406 }, { slot: 2, state: 3, loopback: true, port: 2407 }],
    guests: [{ seat: 1, state: { phase: "connected", name: "Rafa" } }, { seat: 2, state: { phase: "joining", name: "Bruno" } }, { seat: 3, state: { phase: "loading", name: "" } }],
    stats: { rtt: 142, rtts: { 1: 38, 2: 142, 3: 260 }, lost: 0 } } } },
  { name: "3-host-picking", url: `/bsz/?coop=host&coopRoom=${ROOM}`, run: { screen: "landing", mem: false, coop: { set: { name: "Allan" }, stats: { rtt: null, rtts: {} } } } },
  { name: "4-guest-joining", url: `/bsz/?coop=join&coopRoom=${ROOM}`, run: { screen: "loading", coop: {
    set: { phase: "loading", seat: 2, peer: true, name: "Bruno", hostInfo: { slug: "kino", zone: "zombie_theater" },
      lobby: { t: "lobby", slug: "kino", horde: false, playing: false, players: [
        { n: 1, name: "Allan", host: true, status: "lobby", tone: "ok" }, { n: 2, name: "Rafa", status: "ready", tone: "ok", ping: 38 },
        { n: 3, name: "Bruno", status: "loading", tone: "wait", ping: 90 }, { n: 4, name: "", status: "free", tone: "" }] } },
    stats: { rtt: 91 } } } },
  { name: "5-guest-lobby-settings", url: `/bsz/?coop=join&coopRoom=${ROOM}`, run: { screen: "ready", coop: {
    set: { phase: "connected", seat: 1, peer: true, name: "Rafa", showSettings: true, hostInfo: { slug: "kino", zone: "zombie_theater" }, hostState: { screen: "ready", ready: true },
      usage: { fraction: 0.12, resetsAt: new Date(Date.now() + 5 * 3600e3).toISOString() },
      lobby: { t: "lobby", slug: "kino", horde: true, playing: false, players: [
        { n: 1, name: "Allan", host: true, status: "lobby", tone: "ok" }, { n: 2, name: "Rafa", status: "ready", tone: "ok", ping: 38 },
        { n: 3, name: "Bruno", status: "ready", tone: "ok", ping: 142 }, { n: 4, name: "Leo", status: "turn", tone: "wait", ping: 210 }] } },
    stats: { rtt: 38, lost: 0 } } } },
  { name: "6-guest-error", url: `/bsz/?coop=join&coopRoom=${ROOM}`, run: { screen: "error", coop: {
    set: { phase: "failed", seat: 3, peer: true, name: "Leo", lastStep: 3, error: null },
    stats: { rtt: 120 } } } },
  { name: "7-host-ingame-pill", url: `/bsz/?coop=host&coopRoom=${ROOM}`, run: { screen: "playing", coop: {
    set: { zone: "zombie_theater", name: "Allan", peer: true },
    clients: [{ slot: 1, state: 5, loopback: true, port: 2406 }, { slot: 2, state: 5, loopback: true, port: 2407 }],
    guests: [{ seat: 1, state: { phase: "connected", name: "Rafa" } }, { seat: 2, state: { phase: "connected", name: "Bruno" } }],
    stats: { rtt: 64, rtts: { 1: 38, 2: 64 } } } } },
  { name: "8-host-fun", tall: true, url: `/bsz/?coop=host&coopRoom=${ROOM}`, run: { screen: "ready", coop: {
    set: { zone: "zombie_theater", name: "Allan", peer: true },
    clients: [{ slot: 1, state: 5, loopback: true, port: 2406 }],
    guests: [{ seat: 1, state: { phase: "connected", name: "Rafa" }, slot: { slot: 1, state: 5 } }],
    fun: { open: true, infiniteClip: true, passive: true, timescale: 1, jump: 150, gravity: 400,
      players: { 0: { god: true, demigod: false, notarget: false, noclip: false, ufo: false, speed: 1.5 }, 1: { god: true, demigod: false, notarget: true, noclip: false, ufo: false, speed: 1 } } },
    stats: { rtt: 38, rtts: { 1: 38 } } } } },
];

for (const scene of scenes) {
  const page = await ctx.newPage();
  if (scene.tall) await page.setViewportSize({ width: 1100, height: 2600 });
  await page.goto(`https://vel.gg${scene.url}${scene.url.includes("?") ? "&coopRelay=http%3A%2F%2F127.0.0.1%3A9" : ""}`);
  await page.waitForFunction(() => window.__bo1Coop?.card);
  if (scene.run) await page.evaluate(fake, scene.run);
  await page.waitForTimeout(600);
  const box = await page.locator("bo1-coop-card").boundingBox();
  const card = await page.evaluate(() => {
    const host = document.querySelector("bo1-coop-card");
    return { w: host.offsetWidth, h: host.offsetHeight };
  });
  const clip = { x: Math.max(0, box.x - 8), y: Math.max(0, box.y - 8), width: Math.max(card.w, box.width) + 16, height: Math.min(scene.tall ? 2580 : 880, Math.max(card.h, box.height) + 16) };
  await page.screenshot({ path: `${OUT}/${scene.name}.png`, clip });
  console.log("shot", scene.name, clip.width, "x", clip.height);
  await page.close();
}
await ctx.close();
