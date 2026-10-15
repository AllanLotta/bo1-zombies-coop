// The co-op session: everything the extension knows about this page's game, shared by the engine hooks, the network
// side and the card. One per page, created at startup and exposed as window.__bo1Coop for debugging.
import { MAX_GUESTS, normalizeRoomCode } from "../../relay/src/protocol.js";
import { T } from "../ui/strings.js";
import { isLoopback, normalizeRelay, pickRelay } from "../util/relay.js";
import { cleanName, readSetting } from "../util/settings.js";

export const VERSION = "2.2.0";
export const AIM_LEVELS = 10;

export function createSession(search = location.search) {
  const params = new URLSearchParams(search);
  // "room" in links from before vel.gg had its own co-op (which reads ?room= too); keepSinglePlayer() renames it.
  const room = normalizeRoomCode(params.get("coopRoom") ?? params.get("room") ?? "");
  const wanted = params.get("coop");
  const relayOverride = params.get("coopRelay");

  const session = {
    version: VERSION,
    /** "host", "guest", or null when playing solo. */
    mode: room && wanted === "host" ? "host" : room && wanted === "join" ? "guest" : null,
    room,
    relay: pickRelay(relayOverride),
    relayParam: relayOverride && isLoopback(relayOverride) ? `&coopRelay=${encodeURIComponent(relayOverride)}` : "",
    // A relay named in an invite is only used after the guest agrees to switch.
    inviteRelay: normalizeRelay(params.get("relay") ?? ""),
    uncapped: params.get("coopUncapped") !== "0",
    // The controller drives the game through the patched engine, so with it on even solo games get patched.
    controller: readSetting("controller", "1") !== "0",
    aimLevel: Math.max(0, Math.min(AIM_LEVELS - 1, Number(readSetting("aim", "4")) || 0)),
    name: cleanName(readSetting("name", "")),

    // engine
    hash: null,
    build: null,
    patched: false,
    engine: null,
    zone: null,
    gameSettings: null,
    refreshRate: 60,

    // network
    socket: "idle",
    pump: null,
    stats: null,
    usage: null,
    /** Host: some guest is in the room. Guest: the host is in the room. */
    peer: false,

    // host
    queues: null,
    guests: new Map(), // seat -> what the host knows about that guest
    joinTurn: null, // the seat currently allowed to connect
    joinTurnAt: 0,
    gate: false, // the host's start waits for players on their way
    startAlone: false,

    // guest
    phase: "idle",
    guestId: null,
    seat: null,
    hostInfo: null, // map and settings, from the host
    hostState: null, // the host's view of this guest (ready, slot state, join turn)
    lobby: null, // the room as the host last described it
    hostPos: null,

    // card
    update: null, // { version, url } when a newer release is out
    overQuota: null, // { resetsAt } while the relay is out of its daily allowance
    error: null,
    notice: null,
    editRelay: false,
    showSettings: false,
    copiedLinkAt: 0,
    copiedCodeAt: 0,
    log: [],
  };

  session.note = (text) => {
    session.log.push(`${new Date().toISOString().slice(11, 23)} ${text}`);
    if (session.log.length > 200) session.log.shift();
  };

  /** Shows a translated error on the card. */
  session.fail = (key, ...args) => {
    const text = T[key];
    session.error = typeof text === "function" ? text(...args) : text ?? key;
  };

  session.onSocket = ({ state, code }) => {
    session.socket = state;
    if (state === "closed" && code === 4005) session.overQuota ??= { resetsAt: null };
    if (state !== "open") {
      session.peer = false;
      for (const guest of session.guests.values()) {
        if (guest.present) guest.leftAt = Date.now();
        guest.present = false;
      }
    }
    if (state === "closed" && code === 4001) session.fail("replaced");
    if (state === "closed" && code === 4004) session.fail("full", MAX_GUESTS + 1);
    session.note(`relay ${state}${code ? ` ${code}` : ""}`);
  };

  return session;
}

export const validSeat = (seat) => Number.isInteger(seat) && seat >= 1 && seat <= MAX_GUESTS;
