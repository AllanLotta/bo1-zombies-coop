import { DurableObject } from "cloudflare:workers";
import {
  GUEST_ID_PATTERN,
  MAX_BINARY_BYTES,
  MAX_GUESTS,
  MAX_TEXT_BYTES,
  PROTOCOL_VERSION,
  ROLES,
  ROOM_ID_PATTERN,
  decodePackets,
  decodeSeatPackets,
  encodePackets,
  encodeSeatPackets,
  isPeerMessage,
  parseControl,
} from "./protocol.js";
import { json } from "./http.js";
import { UsageTally } from "./usage.js";

const CLOSE = { replaced: 4001, protocol: 4003, full: 4004, tooBig: 1009 };

// Token buckets per socket. Binary frames over the limit are dropped without a word, as a lossy network would; the
// game's own netcode retransmits what matters. The host carries traffic for up to three guests, hence more room.
const LIMITS = {
  guest: { binaryRate: 400, binaryBurst: 800, textRate: 20, textBurst: 40 },
  host: { binaryRate: 1200, binaryBurst: 2400, textRate: 80, textBurst: 160 },
};

/**
 * One room: a host and up to MAX_GUESTS guests. Guests only ever talk to the host. Game data passes through
 * untouched; the room only regroups host batches per guest and stamps guest traffic with its seat.
 *
 * Sockets use the hibernation API, so who-is-who lives in socket tags ("host", "guest", "guest:<id>", "seat:<n>")
 * and attachments rather than in memory. Reconnecting with the same role (host) or guest id replaces the old socket.
 */
export class RoomRelay extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.buckets = new Map(); // rate limits; starting over after hibernation is fine
    this.tally = new UsageTally(ctx, env);
  }

  async fetch(request) {
    const room = request.headers.get("x-room");
    const role = request.headers.get("x-role");
    const guestId = request.headers.get("x-guest-id");
    const upgrade = request.headers.get("Upgrade")?.toLowerCase() === "websocket";
    if (!ROOM_ID_PATTERN.test(room ?? "") || !ROLES.includes(role) || !upgrade) return json({ error: "invalid_room_request" }, 400);
    if (role === "guest" && !GUEST_ID_PATTERN.test(guestId ?? "")) return json({ error: "invalid_guest_id" }, 400);

    const [client, server] = Object.values(new WebSocketPair());
    const seat = role === "guest" ? await this.claimSeat(guestId) : 0;
    if (role === "guest" && !seat) {
      server.accept();
      this.send(server, { t: "error", code: "room_full" });
      this.close(server, CLOSE.full, "Room full");
      return new Response(null, { status: 101, webSocket: client });
    }

    const identity = role === "host" ? "host" : `guest:${guestId}`;
    for (const old of this.ctx.getWebSockets(identity)) {
      this.send(old, { t: "error", code: "replaced" });
      this.close(old, CLOSE.replaced, "Replaced by a new connection");
    }

    this.ctx.acceptWebSocket(server, role === "host" ? ["host"] : ["guest", identity, `seat:${seat}`]);
    server.serializeAttachment({ room, role, seat, id: guestId ?? null, joinedAt: Date.now() });
    this.tally.add(0, 1);

    if (role === "host") {
      this.send(server, { t: "welcome", v: PROTOCOL_VERSION, role, guests: this.guestSeats() });
      for (const guest of this.guests()) this.send(guest, { t: "peer", present: true });
    } else {
      const host = this.host();
      this.send(server, { t: "welcome", v: PROTOCOL_VERSION, role, seat, peer: host !== null });
      if (host) this.send(host, { t: "peer", seat, present: true });
    }
    return new Response(null, { status: 101, webSocket: client });
  }

  /**
   * Seat for a guest id: the one it had before, if nobody else holds it now (a reload then keeps the same engine
   * port and the host's server sees a reconnect); otherwise the lowest free seat, preferring seats no recent guest
   * still counts on. 0 when all seats are taken.
   */
  async claimSeat(guestId) {
    const taken = new Set();
    for (const socket of this.open("guest")) {
      const info = socket.deserializeAttachment();
      if (info?.id !== guestId) taken.add(info?.seat);
    }
    const remembered = (await this.ctx.storage.get("seats")) ?? {};
    let seat = remembered[guestId];
    if (!seat || taken.has(seat)) {
      const reserved = new Set(Object.values(remembered));
      const free = [];
      for (let s = 1; s <= MAX_GUESTS; s += 1) if (!taken.has(s)) free.push(s);
      seat = free.find((s) => !reserved.has(s)) ?? free[0] ?? 0;
    }
    if (!seat) return 0;
    for (const [id, s] of Object.entries(remembered)) if (s === seat && id !== guestId) delete remembered[id];
    remembered[guestId] = seat;
    await this.ctx.storage.put("seats", remembered);
    return seat;
  }

  webSocketMessage(socket, payload) {
    this.tally.add(1, 0);
    const info = socket.deserializeAttachment();
    if (!info || !ROLES.includes(info.role)) {
      this.close(socket, CLOSE.protocol, "Unknown connection");
      return;
    }
    const limits = LIMITS[info.role];
    if (typeof payload === "string") this.onText(socket, info, payload, limits);
    else this.onBinary(socket, info, payload, limits);
  }

  onText(socket, info, payload, limits) {
    if (payload.length > MAX_TEXT_BYTES) {
      this.close(socket, CLOSE.tooBig, "Text frame too large");
      return;
    }
    if (!this.take(socket, "text", limits.textRate, limits.textBurst)) {
      this.send(socket, { t: "error", code: "rate_limited" });
      return;
    }
    const message = parseControl(payload);
    if (!isPeerMessage(message)) {
      this.send(socket, { t: "error", code: "bad_message" });
      return;
    }
    if (info.role === "guest") {
      const host = this.host();
      if (host) this.send(host, { ...message, from: info.seat });
    } else if (message.to === undefined) {
      for (const guest of this.guests()) this.forward(guest, payload);
    } else {
      const guest = this.guestAt(message.to);
      if (guest) this.forward(guest, payload);
    }
  }

  onBinary(socket, info, payload, limits) {
    if (payload.byteLength > MAX_BINARY_BYTES) {
      this.close(socket, CLOSE.tooBig, "Binary frame too large");
      return;
    }
    if (!this.take(socket, "binary", limits.binaryRate, limits.binaryBurst)) return;

    if (info.role === "guest") {
      const host = this.host();
      const packets = host ? decodePackets(payload) : null;
      if (packets) this.forward(host, encodeSeatPackets(packets.map((packet) => ({ seat: info.seat, packet }))));
      return;
    }
    const items = decodeSeatPackets(payload);
    if (!items) return;
    const perSeat = new Map();
    for (const { seat, packet } of items) {
      if (!perSeat.has(seat)) perSeat.set(seat, []);
      perSeat.get(seat).push(packet);
    }
    for (const [seat, packets] of perSeat) {
      const guest = this.guestAt(seat);
      if (guest) this.forward(guest, encodePackets(packets));
    }
  }

  webSocketClose(socket, code, reason) {
    this.leave(socket);
    // The runtime leaves the closing handshake to us.
    this.close(socket, code === 1005 || code === 1006 ? 1000 : code, reason);
  }

  webSocketError(socket) {
    this.leave(socket);
    this.close(socket, CLOSE.protocol, "WebSocket error");
  }

  leave(socket) {
    this.buckets.delete(socket);
    this.tally.flush();
    const info = socket.deserializeAttachment();
    if (!info || !ROLES.includes(info.role)) return;
    // A socket replaced by a newer one leaves while its successor is already open: nobody needs to hear about it.
    if (info.role === "host") {
      if (this.open("host", socket).length) return;
      for (const guest of this.guests()) this.send(guest, { t: "peer", present: false });
      return;
    }
    if (this.open(`guest:${info.id}`, socket).length) return;
    const host = this.host();
    if (host) this.send(host, { t: "peer", seat: info.seat, present: false });
  }

  /** Open sockets with a tag, minus `except` (getWebSockets also lists sockets that are closing). */
  open(tag, except) {
    return this.ctx.getWebSockets(tag).filter((s) => s !== except && s.readyState === 1);
  }

  host() {
    return this.open("host")[0] ?? null;
  }

  guests() {
    return this.open("guest");
  }

  guestAt(seat) {
    return Number.isInteger(seat) ? this.open(`seat:${seat}`)[0] ?? null : null;
  }

  guestSeats() {
    return [...new Set(this.guests().map((s) => s.deserializeAttachment()?.seat).filter(Boolean))].sort();
  }

  take(socket, kind, rate, burst) {
    const now = Date.now();
    let bucket = this.buckets.get(socket);
    if (!bucket) this.buckets.set(socket, (bucket = { binary: { tokens: burst, at: now }, text: { tokens: burst, at: now } }));
    const state = bucket[kind];
    state.tokens = Math.min(burst, state.tokens + ((now - state.at) / 1000) * rate);
    state.at = now;
    if (state.tokens < 1) return false;
    state.tokens -= 1;
    return true;
  }

  send(socket, message) {
    this.forward(socket, JSON.stringify(message));
  }

  forward(socket, payload) {
    try {
      socket.send(payload);
    } catch {
      // closed in the meantime; its close handler cleans up
    }
  }

  close(socket, code, reason) {
    try {
      socket.close(code, reason);
    } catch {
      // already closed
    }
  }
}
