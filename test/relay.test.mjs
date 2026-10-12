// Relay routing against a running relay: host, three guests, a fourth refused, packets and messages routed per seat,
// seats kept on reload and reused when freed.
//   npm run relay:dev, then: node test/relay.test.mjs [relay URL]
import assert from "node:assert/strict";
import { encodePackets, decodePackets, encodeSeatPackets, decodeSeatPackets, relaySocketUrl, createRoomCode, createGuestId } from "../shared/protocol.js";

const RELAY = process.argv[2] ?? "http://127.0.0.1:8787";
const room = createRoomCode();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function client(role, id) {
  const ws = new WebSocket(relaySocketUrl(RELAY, room, role, id));
  ws.binaryType = "arraybuffer";
  const c = { ws, text: [], bin: [], closed: null };
  ws.onmessage = (e) => (typeof e.data === "string" ? c.text.push(JSON.parse(e.data)) : c.bin.push(new Uint8Array(e.data)));
  ws.onclose = (e) => (c.closed = e.code);
  c.ready = new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  c.take = async (pred, ms = 3000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      const i = c.text.findIndex(pred);
      if (i >= 0) return c.text.splice(i, 1)[0];
      await wait(20);
    }
    throw new Error(`${role} ${id ?? ""}: timed out; have ${JSON.stringify(c.text)}`);
  };
  return c;
}
const bytes = (...v) => Uint8Array.from(v);

const host = client("host");
await host.ready;
const hw = await host.take((m) => m.t === "welcome");
assert.deepEqual(hw.guests, []);

const ids = [createGuestId(), createGuestId(), createGuestId()];
const g = [];
for (const id of ids) {
  const c = client("guest", id);
  await c.ready;
  const w = await c.take((m) => m.t === "welcome");
  assert.equal(w.peer, true);
  c.seat = w.seat;
  const p = await host.take((m) => m.t === "peer" && m.seat === w.seat);
  assert.equal(p.present, true);
  g.push(c);
}
assert.deepEqual(g.map((c) => c.seat).sort(), [1, 2, 3]);
console.log("ok  3 guests seated", g.map((c) => c.seat));

const fourth = client("guest", createGuestId());
await fourth.ready.catch(() => {});
await fourth.take((m) => m.t === "error" && m.code === "room_full");
await wait(200);
assert.equal(fourth.closed, 4004);
console.log("ok  4th guest refused (room_full, 4004)");

// guest -> host binary is tagged with the seat
g[1].ws.send(encodePackets([bytes(1, 2, 3), bytes(4)]));
await wait(300);
const fromGuest = decodeSeatPackets(host.bin.pop());
assert.deepEqual(fromGuest.map((x) => [x.seat, [...x.packet]]), [[g[1].seat, [1, 2, 3]], [g[1].seat, [4]]]);
console.log("ok  guest packets reach host tagged with seat", g[1].seat);

// host -> guests binary is split per seat
host.ws.send(encodeSeatPackets([{ seat: 1, packet: bytes(10) }, { seat: 3, packet: bytes(30, 31) }, { seat: 1, packet: bytes(11) }]));
await wait(300);
const bySeat = Object.fromEntries(g.map((c) => [c.seat, c.bin.map((b) => decodePackets(b).map((p) => [...p]))]));
assert.deepEqual(bySeat[1], [[[10], [11]]]);
assert.deepEqual(bySeat[2], []);
assert.deepEqual(bySeat[3], [[[30, 31]]]);
console.log("ok  host packets split per seat");

// text: broadcast, directed, stamped
host.ws.send(JSON.stringify({ t: "info", zone: "x" }));
for (const c of g) await c.take((m) => m.t === "info");
host.ws.send(JSON.stringify({ t: "state", to: 2, turn: true }));
const s2 = g.find((c) => c.seat === 2);
await s2.take((m) => m.t === "state" && m.turn);
await wait(200);
assert.ok(g.filter((c) => c !== s2).every((c) => !c.text.some((m) => m.t === "state")));
g[0].ws.send(JSON.stringify({ t: "state", phase: "connect", from: 3 }));
const st = await host.take((m) => m.t === "state");
assert.equal(st.from, g[0].seat, "relay overwrites `from`");
console.log("ok  text broadcast / directed / from-stamped");

// a guest reloading (same id) keeps its seat and the host sees no leave
const seat0 = g[0].seat;
const again = client("guest", ids[0]);
await again.ready;
const w2 = await again.take((m) => m.t === "welcome");
assert.equal(w2.seat, seat0);
await wait(300);
assert.equal(g[0].closed, 4001);
assert.ok(!host.text.some((m) => m.t === "peer" && m.present === false), "no leave for a replaced socket");
console.log("ok  reload keeps seat", seat0);

// a guest leaving frees its seat; a newcomer takes it
g[2].ws.close();
const left = await host.take((m) => m.t === "peer" && m.present === false);
assert.equal(left.seat, g[2].seat);
const late = client("guest", createGuestId());
await late.ready;
const w3 = await late.take((m) => m.t === "welcome");
assert.equal(w3.seat, g[2].seat);
console.log("ok  freed seat reused", w3.seat);

// host leaving is announced to every guest
host.ws.close();
for (const c of [again, g[1], late]) await c.take((m) => m.t === "peer" && m.present === false);
console.log("ok  host leave announced");
for (const c of [again, g[1], late]) c.ws.close();
console.log("relay: all passed");
