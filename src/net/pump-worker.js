// The packet pump. Runs in a Worker so it keeps going at a steady pace even when the page's main thread is busy
// rendering: it polls the engine's loopback queues every millisecond, batches what it finds to the relay, and writes
// what the relay delivers back into the engine.
//
// Host: one reader per guest seat (what the server sends that guest) and one writer (the shared inbound queue, each
// packet stamped with its sender's port). Guest: one reader (its client's outgoing queue) and one writer (its client's
// incoming queue, port 0).
import { decodePackets, decodeSeatPackets, encodePackets, encodeSeatPackets, MAX_BINARY_BYTES, parseControl, relaySocketUrl } from "../../shared/protocol.js";
import { connectionlessCommand, QueueReader, QueueWriter } from "./queues.js";

const POLL_MS = 1;
const FLUSH_MS = 4;
const INBOX_LIMIT = 512;
const PING_MS = 2000;

const state = {
  role: null,
  url: null,
  socket: null,
  closed: false,
  retries: 0,
  readers: [],
  writer: null,
  ports: {},
  reading: false,
  injecting: false,
  dropUntilConnect: false,
  dropCommands: [],
  inbox: [],
  outbox: [],
  lastFlush: 0,
  looping: false,
  stats: { packetsOut: 0, packetsIn: 0, bytesOut: 0, bytesIn: 0, framesOut: 0, framesIn: 0, dropped: 0, lost: 0, rtt: null, rtts: {} },
};
const hosting = () => state.role === "host";
const post = (message) => self.postMessage(message);

self.onmessage = ({ data: message }) => {
  switch (message.type) {
    case "connect":
      state.role = message.role;
      state.url = relaySocketUrl(message.relay, message.room, message.role, message.guestId);
      open();
      loop();
      break;
    case "attach":
      state.readers = message.reads.map(({ seat, base }) => ({ seat, queue: new QueueReader(message.buffer, message.loopback, base, { consume: true }) }));
      state.writer = new QueueWriter(message.buffer, message.loopback, message.writeBase);
      state.ports = message.ports;
      state.reading = Boolean(message.reading);
      state.injecting = Boolean(message.injecting);
      state.dropCommands = message.dropCommands ?? [];
      break;
    case "read":
      for (const { queue } of state.readers) queue.skip();
      state.dropUntilConnect = Boolean(message.dropUntilConnect);
      state.reading = true;
      break;
    case "inject":
      state.injecting = Boolean(message.on);
      if (message.clearInbox) state.inbox.length = 0;
      break;
    case "send":
      sendText(message.message);
      break;
    case "close":
      state.closed = true;
      try {
        state.socket?.close(1000, "bye");
      } catch {
        // already closed
      }
      break;
  }
};

function open() {
  if (state.closed) return;
  let socket;
  try {
    socket = new WebSocket(state.url);
  } catch (error) {
    post({ type: "socket", state: "error", reason: String(error?.message ?? error) });
    retry();
    return;
  }
  socket.binaryType = "arraybuffer";
  state.socket = socket;
  post({ type: "socket", state: "connecting" });
  socket.onopen = () => {
    state.retries = 0;
    post({ type: "socket", state: "open" });
  };
  socket.onmessage = ({ data }) => (typeof data === "string" ? onText(data) : onBinary(data));
  socket.onclose = (event) => {
    if (state.socket === socket) state.socket = null;
    post({ type: "socket", state: "closed", code: event.code, reason: event.reason });
    // 4001: another tab took this seat; 4004: the room is full. Retrying would not help either.
    if (event.code === 4001 || event.code === 4004) state.closed = true;
    else retry();
  };
  socket.onerror = () => {};
}

function retry() {
  if (state.closed) return;
  setTimeout(open, Math.min(5000, 250 * 2 ** state.retries));
  state.retries += 1;
}

function onBinary(data) {
  const items = hosting() ? decodeSeatPackets(data) : decodePackets(data)?.map((packet) => ({ seat: 0, packet }));
  if (!items) return;
  state.stats.framesIn += 1;
  for (const item of items) {
    state.stats.packetsIn += 1;
    state.stats.bytesIn += item.packet.byteLength;
    const command = connectionlessCommand(item.packet);
    if (command && state.dropCommands.includes(command)) continue;
    state.inbox.push(item);
  }
  if (state.inbox.length > INBOX_LIMIT) {
    state.stats.dropped += state.inbox.length - INBOX_LIMIT;
    state.inbox.splice(0, state.inbox.length - INBOX_LIMIT);
  }
  pump();
}

function onText(text) {
  const message = parseControl(text);
  if (!message) return;
  if (message.t === "ping") {
    sendText(hosting() ? { t: "pong", ts: message.ts, to: message.from } : { t: "pong", ts: message.ts });
  } else if (message.t === "pong") {
    if (typeof message.ts !== "number") return;
    const rtt = Math.max(0, performance.now() - message.ts);
    if (hosting()) {
      // The host pings all guests at once: keep one round-trip time per seat, plus the slowest.
      if (Number.isInteger(message.from)) state.stats.rtts[message.from] = rtt;
      state.stats.rtt = Math.max(0, ...Object.values(state.stats.rtts));
    } else {
      state.stats.rtt = rtt;
    }
  } else {
    post({ type: "control", message });
  }
}

function sendText(message) {
  if (state.socket?.readyState !== WebSocket.OPEN) return false;
  state.socket.send(JSON.stringify(message));
  return true;
}

function flush(now) {
  if (!state.outbox.length) return;
  const socket = state.socket;
  if (socket?.readyState !== WebSocket.OPEN) {
    state.stats.dropped += state.outbox.length;
  } else {
    const seats = hosting();
    const perPacket = seats ? 3 : 2;
    let batch = [];
    let size = 4;
    const send = () => {
      if (!batch.length) return;
      socket.send(seats ? encodeSeatPackets(batch) : encodePackets(batch.map((item) => item.packet)));
      state.stats.framesOut += 1;
      batch = [];
      size = 4;
    };
    for (const item of state.outbox) {
      const bytes = perPacket + item.packet.byteLength;
      if (size + bytes > MAX_BINARY_BYTES) send();
      batch.push(item);
      size += bytes;
      state.stats.packetsOut += 1;
      state.stats.bytesOut += item.packet.byteLength;
    }
    send();
  }
  state.outbox.length = 0;
  state.lastFlush = now;
}

function pump() {
  const now = performance.now();
  if (state.reading) {
    let lost = 0;
    for (const { seat, queue } of state.readers) {
      let packets = queue.poll([]);
      lost += queue.lost;
      // A guest's client chats with its own local server until it connects to the host: skip all of that.
      if (state.dropUntilConnect && packets.length) {
        const first = packets.findIndex((packet) => connectionlessCommand(packet) === "connect");
        packets = first < 0 ? [] : packets.slice(first);
        if (first >= 0) state.dropUntilConnect = false;
      }
      for (const packet of packets) state.outbox.push({ seat, packet });
    }
    state.stats.lost = lost;
  }
  if (state.outbox.length && now - state.lastFlush >= FLUSH_MS) flush(now);
  if (state.writer && state.injecting) {
    while (state.inbox.length && state.writer.push(state.inbox[0].packet, state.ports[state.inbox[0].seat] ?? 0)) state.inbox.shift();
  }
}

async function loop() {
  if (state.looping) return;
  state.looping = true;
  const tick = new Int32Array(new SharedArrayBuffer(4));
  let lastPing = 0;
  let lastStats = 0;
  while (!state.closed) {
    pump();
    const now = performance.now();
    if (now - lastPing >= PING_MS) {
      lastPing = now;
      sendText({ t: "ping", ts: now });
    }
    if (now - lastStats >= 1000) {
      lastStats = now;
      post({ type: "stats", stats: { ...state.stats, rtts: { ...state.stats.rtts }, inbox: state.inbox.length } });
    }
    // Atomics.waitAsync gives ~1 ms sleeps where setTimeout would be clamped.
    const wait = Atomics.waitAsync ? Atomics.waitAsync(tick, 0, 0, POLL_MS) : null;
    if (wait?.async) await wait.value;
    else await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
}
