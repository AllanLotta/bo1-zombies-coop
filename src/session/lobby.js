// The lobby every player sees: four rows, host first. The host builds it from what it knows about each guest and
// broadcasts it; guests show the host's copy, with their own row filled in from their own state.
import { MAX_GUESTS } from "../../relay/src/protocol.js";
import { SLOT } from "../engine/builds.js";
import { currentHorde, currentZone, MAP_SLUGS, screen as pageScreen } from "../game/page.js";
import { send } from "../net/pump.js";
import { cleanName } from "../util/settings.js";
import { CONNECTING } from "./host.js";
import { validSeat } from "./session.js";

const roundPing = (rtt) => (Number.isFinite(rtt) ? Math.round(rtt) : null);
const LEFT_VISIBLE_MS = 60000;

/**
 * Host: [{ n, name, host?, status, tone, ping }] for players 1..4.
 * status: picking | loading | lobby | ingame | ready | opening | turn | joining | reconnecting | left | disconnected | free
 * tone: ok | wait | bad | "" (the colour of the status dot)
 */
export function hostRoster(session) {
  const screen = pageScreen();
  const playing = screen === "playing";
  const [hostStatus, hostTone] = playing ? ["ingame", "ok"] : screen === "ready" ? ["lobby", "ok"] : session.engine || screen === "loading" || screen === "download" ? ["loading", "wait"] : ["picking", "wait"];
  const players = [{ n: 1, name: session.name, host: true, status: hostStatus, tone: hostTone, ping: null }];
  const rtts = session.stats?.rtts ?? {};
  for (let seat = 1; seat <= MAX_GUESTS; seat += 1) {
    const g = session.guests.get(seat);
    const [status, tone] = guestStatus(session, g, seat, playing);
    players.push({ n: seat + 1, name: status === "free" ? "" : cleanName(g?.state?.name), status, tone, ping: g?.present ? roundPing(rtts[seat]) : null });
  }
  return { t: "lobby", players, slug: MAP_SLUGS[session.zone ?? currentZone()] ?? null, horde: currentHorde(), playing };
}

function guestStatus(session, g, seat, playing) {
  const phase = g?.state?.phase;
  if (!g || (!g.present && !g.slot && (!g.leftAt || Date.now() - g.leftAt > LEFT_VISIBLE_MS))) return ["free", ""];
  if (!g.present) return g.slot ? ["reconnecting", "wait"] : ["left", "bad"];
  if (["ended", "failed"].includes(phase)) return ["disconnected", "bad"];
  if (g.slot?.state === SLOT.active) return playing ? ["ingame", "ok"] : ["ready", "ok"];
  if (session.joinTurn === seat || g.slot || CONNECTING.includes(phase)) return ["joining", "wait"];
  if (phase === "waiting-host" && session.engine) return ["turn", "wait"];
  if (phase === "joining-room" && !session.engine) return ["opening", "wait"];
  return ["loading", "wait"];
}

/** Host: sends the lobby to every guest when it changes, and every 5 s regardless. */
export function broadcastLobby(session) {
  if (!session.peer) {
    session.sentLobby = null;
    return;
  }
  const lobby = hostRoster(session);
  const key = JSON.stringify(lobby);
  if (key === session.sentLobby && Date.now() - (session.sentLobbyAt ?? 0) <= 5000) return;
  session.sentLobby = key;
  session.sentLobbyAt = Date.now();
  send(session, lobby);
}

/** Guest: the host's lobby (or an empty one until it arrives), with our own row from our own state. */
export function guestRoster(session) {
  let players = Array.isArray(session.lobby?.players) ? session.lobby.players.slice(0, MAX_GUESTS + 1) : [];
  if (!players.length) {
    players = [{ n: 1, name: "", host: true, status: session.peer ? "loading" : "away", tone: session.peer ? "wait" : "" }];
    for (let seat = 1; seat <= MAX_GUESTS; seat += 1) players.push({ n: seat + 1, name: "", status: "free", tone: "" });
  }
  if (!validSeat(session.seat)) return players;
  const [status, tone] = ownStatus(session);
  return players.map((p) => (p.n === session.seat + 1 ? { ...p, name: session.name, ping: roundPing(session.stats?.rtt), status, tone } : p));
}

function ownStatus(session) {
  const phase = session.phase;
  if (phase === "connected") return session.lobby?.playing || session.hostState?.screen === "playing" ? ["ingame", "ok"] : ["ready", "ok"];
  if (["ended", "failed"].includes(phase)) return ["disconnected", "bad"];
  if (CONNECTING.includes(phase)) return ["joining", "wait"];
  if (phase === "waiting-host" && session.hostState?.ready && !session.hostState.turn) return ["turn", "wait"];
  return ["loading", "wait"];
}
