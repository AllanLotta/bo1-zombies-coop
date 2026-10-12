// Wire format spoken between the extension and the relay. Imported by both sides, so keep it free of browser- or
// Worker-only APIs.
//
// Connection: wss://<relay>/v1/rooms/<room>?role=host|guest&v=<PROTOCOL_VERSION>[&id=<guest id>]
//
// A room has one host and up to MAX_GUESTS guests. Each guest gets a seat (1..MAX_GUESTS = players 2..4); the guest id
// is random per browser tab and room, so reloading the page gives back the same seat.
//
// Text frames carry JSON objects with a string `t`. The relay itself only sends `welcome`, `peer` and `error`;
// everything else is relayed untouched:
//   host  -> guests   any message; `to: <seat>` targets one guest, no `to` reaches all of them
//   guest -> host     any message; the relay adds `from: <seat>`
//
// Binary frames carry game packets in batches:
//   guest <-> relay   kind 1: [u8 1][u8 1][u16 count] then count x ([u16 length][bytes])
//   host  <-> relay   kind 2: [u8 1][u8 2][u16 count] then count x ([u8 seat][u16 length][bytes])
// All integers are little-endian.

export const PROTOCOL_VERSION = 3;
export const ROLES = Object.freeze(["host", "guest"]);
export const RELAY_MESSAGE_TYPES = Object.freeze(["welcome", "peer", "error"]);
export const MAX_GUESTS = 3;

export const MAX_TEXT_BYTES = 4096;
export const MAX_BINARY_BYTES = 65536;
// Matches the engine's loopback message buffer.
export const MAX_PACKET_BYTES = 1264;

export const ROOM_ID_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/;
export const GUEST_ID_PATTERN = /^[a-z0-9]{8,32}$/;

// Base32 without i, l, o and u, so a code read out loud cannot be misheard.
const CODE_ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz";
const ROOM_CODE_LENGTH = 16;

const randomBytes = (length) => crypto.getRandomValues(new Uint8Array(length));
const toCode = (bytes) => Array.from(bytes, (byte) => CODE_ALPHABET[byte & 31]).join("");

/** "abcd-efgh-jkmn-pqrs": 16 symbols, 80 random bits. */
export function createRoomCode(random = randomBytes) {
  return toCode(random(ROOM_CODE_LENGTH)).match(/.{4}/g).join("-");
}

export function createGuestId(random = randomBytes) {
  return toCode(random(16));
}

/** Accepts a bare code in any case and spacing, or a whole invite link. Returns the canonical code or null. */
export function normalizeRoomCode(input) {
  if (typeof input !== "string") return null;
  let text = input.trim();
  try {
    text = new URL(text).searchParams.get("room") ?? "";
  } catch {
    // not a link
  }
  const compact = text.toLowerCase().replace(/[^0-9a-z]/g, "");
  if (compact.length !== ROOM_CODE_LENGTH || [...compact].some((c) => !CODE_ALPHABET.includes(c))) return null;
  return compact.match(/.{4}/g).join("-");
}

export function relaySocketUrl(relayBase, room, role, guestId) {
  const url = new URL(relayBase);
  url.protocol = url.protocol === "http:" || url.protocol === "ws:" ? "ws:" : "wss:";
  url.pathname = `/v1/rooms/${encodeURIComponent(room)}`;
  url.search = `?role=${role}&v=${PROTOCOL_VERSION}${role === "guest" ? `&id=${guestId}` : ""}`;
  return url.toString();
}

const BATCH_VERSION = 1;
const KIND_PACKETS = 1;
const KIND_SEAT_PACKETS = 2;

function writeBatch(kind, items, seatOf, packetOf) {
  const header = kind === KIND_SEAT_PACKETS ? 3 : 2;
  let size = 4;
  for (const item of items) size += header + packetOf(item).byteLength;
  if (items.length > 0xffff || size > MAX_BINARY_BYTES) throw new RangeError("packet batch too large");
  const out = new Uint8Array(size);
  const view = new DataView(out.buffer);
  out[0] = BATCH_VERSION;
  out[1] = kind;
  view.setUint16(2, items.length, true);
  let at = 4;
  for (const item of items) {
    const packet = packetOf(item);
    if (packet.byteLength > MAX_PACKET_BYTES) throw new RangeError("packet too large");
    if (kind === KIND_SEAT_PACKETS) out[at++] = seatOf(item);
    view.setUint16(at, packet.byteLength, true);
    out.set(packet, at + 2);
    at += 2 + packet.byteLength;
  }
  return out;
}

function readBatch(kind, data) {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  if (bytes.byteLength < 4 || bytes[0] !== BATCH_VERSION || bytes[1] !== kind) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const count = view.getUint16(2, true);
  const items = [];
  let at = 4;
  for (let i = 0; i < count; i += 1) {
    let seat = 0;
    if (kind === KIND_SEAT_PACKETS) {
      if (at + 1 > bytes.byteLength) return null;
      seat = bytes[at++];
      if (seat < 1 || seat > MAX_GUESTS) return null;
    }
    if (at + 2 > bytes.byteLength) return null;
    const length = view.getUint16(at, true);
    at += 2;
    if (length > MAX_PACKET_BYTES || at + length > bytes.byteLength) return null;
    items.push({ seat, packet: bytes.subarray(at, at + length) });
    at += length;
  }
  return at === bytes.byteLength ? items : null;
}

/** Guest batch: an array of packets (Uint8Array). */
export const encodePackets = (packets) => writeBatch(KIND_PACKETS, packets, null, (p) => p);
/** Array of packet views, or null when malformed. */
export const decodePackets = (data) => readBatch(KIND_PACKETS, data)?.map((item) => item.packet) ?? null;
/** Host batch: an array of { seat, packet }. */
export const encodeSeatPackets = (items) => writeBatch(KIND_SEAT_PACKETS, items, (i) => i.seat, (i) => i.packet);
/** Array of { seat, packet } (packet is a view), or null when malformed. */
export const decodeSeatPackets = (data) => readBatch(KIND_SEAT_PACKETS, data);

/** A text frame as a control message, or null. */
export function parseControl(text) {
  if (typeof text !== "string" || text.length > MAX_TEXT_BYTES) return null;
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  const ok = value && typeof value === "object" && !Array.isArray(value) && typeof value.t === "string" && value.t.length <= 32;
  return ok ? value : null;
}

/** Messages players may send each other: any type the relay does not use itself. */
export const isPeerMessage = (message) => message !== null && !RELAY_MESSAGE_TYPES.includes(message.t);
