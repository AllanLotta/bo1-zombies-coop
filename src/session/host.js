// The host: runs the real game server. Guests' clients reach it through extra loopback queues that the pump worker
// fills from the relay; the host also decides who may connect when, keeps everyone's pause in sync and tells guests
// what the lobby looks like.
import { MAX_GUESTS } from "../../relay/src/protocol.js";
import { SLOT } from "../engine/builds.js";
import { EngineMemory } from "../engine/memory.js";
import { devmapZone, gameSettings, insertBeforeDevmap, latestView, screen as pageScreen } from "../game/page.js";
import { send } from "../net/pump.js";
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

/** Called right before the engine starts: sets up the guest queues and the command line. */
export function prepareHost(session, Module, args) {
  const engine = new EngineMemory(Module, session.build);
  if (!engine.mailboxesIdle()) throw new Error("unexpectedMemory");
  const queues = engine.createGuestQueues(MAX_GUESTS);
  engine.useInboundQueue(queues.inbound.port);
  session.engine = engine;
  session.queues = queues;

  insertBeforeDevmap(args, ["+setqport", String(HOST_QPORT)]);
  if (session.uncapped) insertBeforeDevmap(args, ["+set", "kisak_web_uncapped", "1", "+set", "com_maxfps", String(session.refreshRate)]);
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
    const state = { t: "state", to: g.seat, ready, slot: g.slot?.state ?? 0, screen, turn: session.joinTurn === g.seat };
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

  syncPause(session, present, active, phase, screen);
  broadcastLobby(session);

  const view = latestView();
  if (present.some(active) && view && view.ms !== session.sentViewMs) {
    session.sentViewMs = view.ms;
    send(session, { t: "pos", o: view.origin, a: view.angles });
  }

  for (const g of all) kickIfStale(session, g, phase(g), now);
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
 * Anyone opening the menu pauses everyone, as solo BO1 does. The host freezes its server and tells each guest
 * whether someone else is paused. While a guest is still connecting nothing pauses: it needs the server running.
 */
function syncPause(session, present, active, phase, screen) {
  const engine = session.engine;
  const menuOpen = Boolean(engine?.menuOpen()) && screen === "playing";
  session.menuOpen = menuOpen;
  const linked = present.filter((g) => active(g) && phase(g) === "connected");
  const connecting = present.some((g) => !active(g) && CONNECTING.includes(phase(g)));
  if (engine) applyHostPause(session, linked.length > 0 && !connecting && (menuOpen || linked.some((g) => g.pause)), menuOpen);
  if (engine && !session.paused && present.some((g) => !active(g))) {
    if (engine.dvar("clPaused")) engine.setDvar("clPaused", 0);
    if (engine.dvar("svPaused")) engine.setDvar("svPaused", 0);
  }
  for (const g of present) {
    const on = menuOpen || linked.some((other) => other !== g && other.pause);
    if (on !== g.sentPause) {
      g.sentPause = on;
      send(session, { t: "pause", on, to: g.seat });
    }
  }
}

function applyHostPause(session, paused, menuOpen) {
  const engine = session.engine;
  if (paused) {
    if (!session.paused) session.note(menuOpen ? "paused" : "paused by a guest");
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
