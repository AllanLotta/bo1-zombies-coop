// Control messages between players (everything except game packets), and the host's bookkeeping of its guests.
import { MAX_GUESTS } from "../../relay/src/protocol.js";
import { currentGuns, currentHorde, currentZone, MAP_SLUGS } from "../game/page.js";
import { send } from "../net/pump.js";
import { followHostMap } from "./guest.js";
import { validSeat, VERSION } from "./session.js";

export function onControl(session, message) {
  if (session.mode === "host") onHostMessage(session, message);
  else onGuestMessage(session, message);
}

function onHostMessage(session, message) {
  switch (message.t) {
    case "welcome":
      session.overQuota = null;
      for (const seat of Array.isArray(message.guests) ? message.guests : []) guestArrived(session, seat);
      break;
    case "peer":
      if (!validSeat(message.seat)) return;
      if (message.present) guestArrived(session, message.seat);
      else guestLeft(session, message.seat);
      break;
    case "state":
      if (validSeat(message.from)) guest(session, message.from).state = message;
      break;
    case "pause":
      if (validSeat(message.from)) guest(session, message.from).pause = Boolean(message.on);
      break;
    case "error":
      session.note(`relay error ${message.code}`);
      if (message.code === "over_quota") session.overQuota = { resetsAt: message.resetsAt ?? null };
      break;
  }
  session.peer = [...session.guests.values()].some((g) => g.present);
}

function onGuestMessage(session, message) {
  switch (message.t) {
    case "welcome":
      session.overQuota = null;
      session.seat = validSeat(message.seat) ? message.seat : null;
      session.peer = Boolean(message.peer);
      if (session.peer) introduce(session);
      break;
    case "peer":
      session.peer = Boolean(message.present);
      if (session.peer) introduce(session);
      else {
        session.hostLeftAt = Date.now();
        session.remotePause = false;
      }
      session.note(`host ${session.peer ? "joined" : "left"} the room`);
      break;
    case "info":
      session.hostInfo = message;
      followHostMap(session);
      break;
    case "state":
      session.hostState = message;
      break;
    case "pause":
      session.remotePause = Boolean(message.on);
      break;
    case "lobby":
      if (Array.isArray(message.players)) session.lobby = message;
      break;
    case "pos":
      if (Array.isArray(message.o) && message.o.length === 3 && message.o.every(Number.isFinite)) {
        session.hostPos = { origin: message.o, at: Date.now() };
        rememberHostTrail(session, session.hostPos);
      }
      break;
    case "error":
      session.note(`relay error ${message.code}`);
      if (message.code === "room_full") session.fail("full", MAX_GUESTS + 1);
      if (message.code === "over_quota") session.overQuota = { resetsAt: message.resetsAt ?? null };
      break;
  }
}

/** The host's record for a seat, created on first use. */
export function guest(session, seat) {
  let record = session.guests.get(seat);
  if (!record) {
    record = { seat, present: false, state: null, pause: false, slot: null, leftAt: 0, kicks: 0, lastKickAt: 0, sent: {} };
    session.guests.set(seat, record);
  }
  return record;
}

function guestArrived(session, seat) {
  if (!validSeat(seat)) return;
  const record = guest(session, seat);
  if (!record.present) session.note(`player ${seat + 1} joined the room`);
  Object.assign(record, { present: true, state: null, pause: false, sent: {}, sentPause: undefined });
  session.sentLobby = null;
  sendGameInfo(session, seat);
}

function guestLeft(session, seat) {
  const record = guest(session, seat);
  Object.assign(record, { present: false, leftAt: Date.now(), pause: false });
  session.note(`player ${seat + 1} left the room`);
}

/** Guest: tells the host where it is in the join process (and its name). Repeated, so a lost message heals. */
export function introduce(session) {
  send(session, { t: "state", phase: session.phase, v: VERSION, name: session.name });
  send(session, { t: "pause", on: Boolean(session.menuOpen) });
  session.sentPhase = session.phase;
  session.sentPhaseAt = Date.now();
}

/** Host: which map and game settings guests must load. */
export function sendGameInfo(session, to) {
  const zone = session.zone ?? currentZone();
  send(session, {
    t: "info",
    v: VERSION,
    hash: session.hash,
    zone,
    slug: MAP_SLUGS[zone] ?? null,
    horde: currentHorde(),
    guns: currentGuns(),
    gameArgs: session.gameSettings,
    ...(to ? { to } : {}),
  });
}

const TRAIL_STEP = 16;
const TRAIL_MS = 20000;

/** Where the host walked lately: floor a guest can be sent to without landing inside the host (see moveToHost). */
function rememberHostTrail(session, pos) {
  const trail = (session.hostTrail ??= []);
  const last = trail.at(-1);
  if (!last || Math.hypot(pos.origin[0] - last.origin[0], pos.origin[1] - last.origin[1], pos.origin[2] - last.origin[2]) >= TRAIL_STEP) trail.push(pos);
  while (trail.length && pos.at - trail[0].at > TRAIL_MS) trail.shift();
}
