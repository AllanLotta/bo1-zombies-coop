// The host: runs the real game server. Guests' clients reach it through extra loopback queues that the pump worker
// fills from the relay; the host also decides who may connect when, keeps everyone's pause in sync and tells guests
// what the lobby looks like.
import { MAX_GUESTS } from "../../relay/src/protocol.js";
import { SLOT } from "../engine/builds.js";
import { EngineMemory, NORMAL_SPEED } from "../engine/memory.js";
import { devmapZone, gameSettings, insertBeforeDevmap, latestView, screen as pageScreen } from "../game/page.js";
import { guardPlayers } from "../fun/fun.js";
import { send } from "../net/pump.js";
import { cleanName } from "../util/settings.js";
import { broadcastLobby } from "./lobby.js";
import { guest, sendGameInfo } from "./messages.js";

// The server tells loopback clients apart by qport alone (every loopback address looks the same to it) and refuses
// a connect that reuses an active client's qport. The host's own client takes a fixed low value; guests pick from
// their own seat's range (see guestQport).
const HOST_QPORT = 7;

/** Guest phases between "my turn to connect" and "connected". */
export const CONNECTING = ["freezing", "connect", "challenging", "joining"];
const JOIN_TURN_MS = 60000;
const STATE_REPEAT_MS = 2000;
const KICK_AFTER_LEFT_MS = 15000;
const KICK_SPACING_MS = 15000;
const MAX_KICKS = 4;
// pm_flags bit set while the player's view is a fixed camera (the level intro, the end-of-game scoreboard). Guests
// must not be sent there: it hangs above the map, and a guest teleported to it falls to its death.
const FIXED_CAMERA = 0x400;
// How often guests hear where the host is. They only use it to spawn next to the host (see stayNearHost in guest.js),
// so 10 times a second is plenty, and it keeps the relay's text traffic (which counts against its quota) low.
const POS_EVERY_MS = 100;
// A player who fell out of the game holds everyone this long at most; then the game goes on without them.
const DROP_HOLD_MAX_MS = 300000;

/** Called right before the engine starts: sets up the guest queues and the command line. */
export function prepareHost(session, Module, args) {
  const engine = new EngineMemory(Module, session.build);
  if (!engine.mailboxesIdle()) throw new Error("unexpectedMemory");
  const queues = engine.createGuestQueues(MAX_GUESTS);
  engine.useInboundQueue(queues.inbound.port);
  session.engine = engine;
  session.queues = queues;

  insertBeforeDevmap(args, ["+setqport", String(HOST_QPORT)]);
  // vel.gg's own co-op rules, as its multiplayer page starts the host. Without them the level script decides this is
  // a solo game whenever the host is alone when it checks (going down then ends the game and restarts the map, Quick
  // Revive works as in solo) and starts the round before the guests are in. kisak_coop_players 1 is vel.gg's fallback
  // count; the start itself waits on KB_CoopWait (see coopWait), bit 0 standing for the host's start click.
  insertBeforeDevmap(args, ["+set", "kisak_web_coop", "1", "+set", "kisak_coop_players", "1"]);
  coopWait(session, 1);
  session.zone = devmapZone(args);
  session.gameSettings = gameSettings(args);

  const ports = Object.fromEntries(Object.entries(queues.seats).map(([seat, q]) => [seat, q.port]));
  session.pump.postMessage({
    type: "attach",
    buffer: engine.buffer,
    loopback: session.build.loopback,
    reads: Object.entries(queues.seats).map(([seat, q]) => ({ seat: Number(seat), base: q.base })),
    writeBase: queues.inbound.base,
    ports,
    reading: true,
    injecting: true,
    dropCommands: ["rcon"], // nobody but the host gets to run server commands
  });
  session.note(`guest queues: ${Object.values(ports).join(", ")}, inbound ${queues.inbound.port}`);
  if (session.peer) sendGameInfo(session);
}

export function hostTick(session) {
  const screen = pageScreen();
  const engine = session.engine;
  const now = Date.now();
  const ready = Boolean(engine) && (screen === "ready" || screen === "playing");

  // Match server slots to seats by the loopback port each seat sends from.
  const slots = engine && session.queues ? engine.serverSlots() : [];
  for (let seat = 1; seat <= MAX_GUESTS; seat += 1) {
    const port = session.queues?.seats[seat]?.port;
    const slot = port ? slots.find((s) => s.loopback && s.port === port) ?? null : null;
    if (slot || session.guests.has(seat)) guest(session, seat).slot = slot;
  }
  const all = [...session.guests.values()];
  const present = all.filter((g) => g.present);
  const active = (g) => g.slot?.state === SLOT.active;
  const phase = (g) => g.state?.phase;

  updateJoinTurn(session, present, ready, now);
  for (const g of present) {
    // normalSpeed: the host's game is out of slow motion (see restoreSpeed in guest.js).
    const normalSpeed = !engine || engine.codeTimeScale() >= NORMAL_SPEED;
    const state = { t: "state", to: g.seat, ready, slot: g.slot?.state ?? 0, screen, turn: session.joinTurn === g.seat, normalSpeed };
    sendWhenChanged(session, g, "state", state, now);
  }

  // Hold the host's start while players are on their way, so everyone spawns together.
  session.gate = screen === "ready" && !session.startAlone && present.some((g) => !active(g) && !["ended", "failed"].includes(phase(g)));

  // vel.gg keeps a loaded map frozen behind "click to start"; a joining guest needs the server running.
  const joining = present.some((g) => ["waiting-host", ...CONNECTING].includes(phase(g)));
  if (engine && joining && screen === "ready" && !session.introReleased && engine.int(session.build.introState) === 1) {
    session.introReleased = true;
    engine.Module._KB_Input?.(7, 1, 0);
    session.note("released the start screen so players can connect");
  }

  // The level starts once the host clicks in: everyone already connected starts together, later players watch until
  // the next round.
  coopWait(session, screen === "playing" ? 0 : 1);
  trackDropped(session, all, active, phase, screen, now);
  syncPause(session, present, active, phase, screen, now);
  broadcastLobby(session);

  const view = latestView();
  if (present.some(active) && view && view.ms !== session.sentViewMs && now - (session.sentPosAt ?? 0) >= POS_EVERY_MS && !(view.flags & FIXED_CAMERA)) {
    session.sentViewMs = view.ms;
    session.sentPosAt = now;
    send(session, { t: "pos", o: view.origin, a: view.angles });
  }

  for (const g of all) kickIfStale(session, g, phase(g), now);
}

/** The level script's start barrier (vel.gg's KB_CoopWait): holds while any bit of the mask is set. */
function coopWait(session, mask) {
  const wait = session.engine?.Module._KB_CoopWait;
  if (!wait || session.coopWaitMask === mask) return;
  wait(mask);
  session.coopWaitMask = mask;
  session.note(mask ? "level start held for the host's click" : "level start released");
}

/** One guest connects at a time: two simultaneous handshakes can be mixed up by the server. */
function updateJoinTurn(session, present, ready, now) {
  const turn = session.joinTurn ? session.guests.get(session.joinTurn) : null;
  const phase = turn?.state?.phase;
  if (turn && (!turn.present || ["connected", "ended", "failed"].includes(phase) || now - session.joinTurnAt > JOIN_TURN_MS)) {
    session.note(`player ${turn.seat + 1}'s turn is over (${turn.present ? phase : "left"})`);
    session.joinTurn = null;
  }
  if (session.joinTurn || !ready) return;
  const next = present.find((g) => ["waiting-host", "connect"].includes(g.state?.phase));
  if (next) {
    session.joinTurn = next.seat;
    session.joinTurnAt = now;
    session.note(`player ${next.seat + 1} may connect`);
  }
}

/** Sends a per-guest message when it changes, and again every few seconds in case one got lost. */
function sendWhenChanged(session, g, kind, message, now) {
  const key = JSON.stringify(message);
  const last = g.sent[kind];
  if (last?.key === key && now - last.at <= STATE_REPEAT_MS) return;
  g.sent[kind] = { key, at: now };
  send(session, message);
}

/**
 * A player who falls out mid-game (connection lost, page closed, crash) must not cost the others the game: everyone
 * is held until they are back or the host decides to go on without them. session.dropped: seat -> { since, name }.
 */
function trackDropped(session, all, active, phase, screen, now) {
  session.dropped ??= new Map();
  for (const g of all) {
    const inGame = g.present && active(g);
    if (inGame && screen === "playing") g.wasInGame = true;
    else if (!inGame && g.wasInGame) {
      g.wasInGame = false;
      if (screen === "playing" && !session.dropped.has(g.seat)) {
        session.dropped.set(g.seat, { since: now, name: cleanName(g.state?.name) || null });
        session.note(`player ${g.seat + 1} fell out of the game: holding everyone`);
      }
    }
    if (inGame && phase(g) === "connected" && session.dropped.delete(g.seat)) session.note(`player ${g.seat + 1} is back`);
  }
  for (const [seat, d] of session.dropped) {
    if (now - d.since > DROP_HOLD_MAX_MS || screen !== "playing") {
      session.dropped.delete(seat);
      session.note(`stopped waiting for player ${seat + 1}`);
    }
  }
}

/**
 * Anyone opening the menu pauses everyone, as solo BO1 does, and so does a player falling out (see trackDropped). The
 * host freezes its server and tells each guest whether (and why) someone else holds the game. While a guest is still
 * connecting nothing pauses: it needs the server running. Mid-game that stretch is guarded instead: everyone is
 * invulnerable and the zombies lose interest until the newcomer is in (see guardPlayers in fun.js).
 */
function syncPause(session, present, active, phase, screen, now) {
  const engine = session.engine;
  const menuOpen = Boolean(engine?.menuOpen()) && screen === "playing";
  session.menuOpen = menuOpen;
  // Slot states come straight from the engine; a guest's own phase report can lag behind by a message or two.
  const linked = present.filter((g) => active(g));
  const connecting = present.some((g) => !active(g) && CONNECTING.includes(phase(g)));
  const dropHold = session.dropped?.size > 0;
  const guestPause = linked.find((g) => g.pause);
  const wanted = !connecting && ((linked.length > 0 && (menuOpen || Boolean(guestPause))) || dropHold);
  if (engine) {
    applyHostPause(session, wanted, menuOpen);
    guardPlayers(session, screen === "playing" && connecting);
  }
  if (engine && !session.paused && present.some((g) => !active(g))) {
    if (engine.dvar("clPaused")) engine.setDvar("clPaused", 0);
    if (engine.dvar("svPaused")) engine.setDvar("svPaused", 0);
  }
  const dropped = dropHold ? [...session.dropped.values()] : [];
  for (const g of present) {
    const other = linked.find((o) => o !== g && o.pause);
    const on = !connecting && (menuOpen || dropHold || Boolean(other));
    const why = !on ? undefined : dropHold ? "dropped" : menuOpen ? "host" : "player";
    const who = why === "dropped" ? dropped.map((d) => d.name).filter(Boolean) : why === "player" ? [cleanName(other.state?.name)].filter(Boolean) : [];
    // Repeated now and then, like the state message: a lost "resume" would leave a guest frozen for good.
    sendWhenChanged(session, g, "pause", { t: "pause", on, to: g.seat, why, who }, now);
  }
}

function applyHostPause(session, paused, menuOpen) {
  const engine = session.engine;
  if (paused) {
    if (!session.paused) session.note(menuOpen ? "paused" : session.dropped?.size ? "paused: a player fell out" : "paused by a guest");
    engine.holdServer(true);
    if (!engine.dvar("svPaused")) engine.setDvar("svPaused", 1);
    if (!engine.dvar("clPaused")) engine.setDvar("clPaused", 1);
    engine.keepClientAlive();
  } else if (session.paused) {
    engine.holdServer(false);
    engine.setDvar("svPaused", 0);
    if (!menuOpen) engine.setDvar("clPaused", 0);
    engine.keepClientAlive();
    session.note("resumed");
  }
  session.paused = paused;
}

/**
 * Frees a server slot that still belongs to a guest who reloaded or left; otherwise their reconnect is refused.
 * Kicks are few and spaced out: one the server has not run yet must not hit whoever takes the slot next.
 */
function kickIfStale(session, g, phase, now) {
  const slot = g.slot;
  const stale = slot && slot.state >= SLOT.connected && ((g.present && phase && !["challenging", "joining", "connected"].includes(phase)) || (!g.present && g.leftAt && now - g.leftAt > KICK_AFTER_LEFT_MS));
  if (!stale) {
    g.kicks = 0;
    return;
  }
  if (g.kicks >= MAX_KICKS || now - g.lastKickAt <= KICK_SPACING_MS) return;
  if (session.engine.command(`clientkick ${slot.slot}`)) {
    g.lastKickAt = now;
    g.kicks += 1;
    session.note(`freed player ${g.seat + 1}'s slot ${slot.slot} (${g.present ? phase : "left"})`);
  }
}
