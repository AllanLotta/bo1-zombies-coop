// A guest: loads the same map in its own engine, then parks its local server and connects its client to the host's
// server instead. The pump worker forwards the client's packets to the host and writes the host's replies back.
import { CONNECTION, SLOT } from "../engine/builds.js";
import { EngineMemory } from "../engine/memory.js";
import { applyGameSettings, BASE, currentHorde, currentSlug, devmapZone, go, latestView, MAP_NAMES, screen as pageScreen } from "../game/page.js";
import { send } from "../net/pump.js";
import { introduce } from "./messages.js";
import { validSeat } from "./session.js";

const HOST_GONE_MS = 10000;
const STATE_REPEAT_MS = 2000;
const SPAWN_JUMP = 400; // a view jump this large means we (re)spawned
const NEAR_HOST = 300;
const HOST_POS_MAX_AGE_MS = 6000;
const SPAWN_CHECK_MS = 2000;
const SPAWN_TRIES = 2;
const EYE_HEIGHT = 62;

/** Each seat has its own qport range, so guests never collide with each other or with the host (7). */
export const guestQport = (seat) => 1000 + 10000 * (seat - 1) + 1 + Math.floor(Math.random() * 9999);

/** Opens the host's map on this page if it is not the one already open. */
export function followHostMap(session) {
  const info = session.hostInfo;
  if (!info?.slug || session.engine) return;
  if (currentSlug() === info.slug && currentHorde() === Boolean(info.horde)) return;
  session.phase = "following";
  go(`${BASE}${info.slug}?coop=join&room=${session.room}${info.horde ? "&horde=1" : ""}${session.relayParam}`);
}

/** Called right before the engine starts: waits for the host's map details and copies its game settings. */
export async function prepareGuest(session, Module, args) {
  const info = await until(() => (session.hostInfo?.zone ? session.hostInfo : null), 30000);
  if (!info) throw new Error("hostNoAnswer");
  if (info.hash && info.hash !== session.hash) throw new Error("versionMismatch");
  const zone = devmapZone(args);
  if (zone !== info.zone) throw new Error(`hostPlaying:${MAP_NAMES[info.slug] ?? info.zone}`);
  if (Array.isArray(info.gameArgs)) applyGameSettings(args, info.gameArgs);

  const engine = new EngineMemory(Module, session.build);
  if (!engine.mailboxesIdle()) throw new Error("unexpectedMemory");
  session.engine = engine;
  session.zone = zone;
  session.pump.postMessage({
    type: "attach",
    buffer: engine.buffer,
    loopback: session.build.loopback,
    reads: [{ seat: 0, base: engine.queueAt(1) }], // our client's outgoing packets, for the host
    writeBase: engine.queueAt(0), // the host's packets, for our client
    ports: { 0: 0 },
    reading: false,
    injecting: false,
  });
  session.phase = "loading";
}

function until(check, timeoutMs) {
  return new Promise((resolve) => {
    const started = Date.now();
    const poll = () => {
      const value = check();
      if (value || Date.now() - started > timeoutMs) resolve(value ?? null);
      else setTimeout(poll, 100);
    };
    poll();
  });
}

export function guestTick(session) {
  const screen = pageScreen();
  const engine = session.engine;
  if (screen === "error" && !["ended", "failed"].includes(session.phase)) {
    session.phase = "ended";
    session.note("engine stopped");
  }
  // While our server is parked, our client would otherwise time out on it.
  if (engine && ["freezing", "connect"].includes(session.phase)) engine.keepClientAlive();
  if (engine && ["challenging", "joining"].includes(session.phase)) {
    if (engine.dvar("clPaused")) engine.setDvar("clPaused", 0);
    if (engine.dvar("svPaused")) engine.setDvar("svPaused", 0);
  }
  if (session.peer && (session.phase !== session.sentPhase || Date.now() - (session.sentPhaseAt ?? 0) > STATE_REPEAT_MS)) introduce(session);
  if (!session.peer) session.sentPhase = null;

  const step = STEPS[session.phase];
  if (step) step(session, engine, screen);
}

const STEPS = {
  loading(session, engine, screen) {
    if (screen === "ready" || screen === "playing") session.phase = "waiting-host";
  },

  "waiting-host"(session, engine) {
    // Parking our server starts our client's timeout clock, so only do it once the host says it is our turn.
    if (session.peer && session.hostState?.ready && session.hostState.turn && validSeat(session.seat)) {
      engine.holdServer(true);
      session.heldAt = Date.now();
      session.phase = "freezing";
      session.note("parking the local server");
    }
  },

  freezing(session, engine) {
    if (engine.serverReadsPackets() && Date.now() - session.heldAt <= 5000) return;
    if (engine.serverReadsPackets()) session.note("local server still reading after 5 s, going on");
    engine.setDvar("svPaused", 0);
    session.pump.postMessage({ type: "read", dropUntilConnect: true });
    session.pump.postMessage({ type: "inject", on: false, clearInbox: true });
    session.phase = "connect";
  },

  connect(session, engine) {
    if (!session.introReleased && engine.int(session.build.introState) === 1) {
      session.introReleased = true;
      engine.Module._KB_Input?.(7, 1, 0);
    }
    // After a reload our old slot may still be on the host's server; give the host a moment to free it.
    session.connectWaitAt ??= Date.now();
    if ((session.hostState?.slot ?? 0) >= SLOT.connected && Date.now() - session.connectWaitAt < 20000) return;
    session.qport ??= guestQport(session.seat);
    if (engine.command(`setqport ${session.qport};connect LOCALHOST`)) {
      session.joinedLate = session.hostState?.screen === "playing";
      session.connectAt = Date.now();
      session.phase = "challenging";
      session.note("connect sent");
    }
  },

  challenging(session, engine) {
    const state = engine.connectionState();
    if (state >= CONNECTION.connecting && state <= CONNECTION.challenging && engine.pointClientAt(0) && engine.clientServerPort() === 0) {
      session.pump.postMessage({ type: "inject", on: true });
      session.phase = "joining";
      session.note("handshake started, passing the host's packets in");
    } else if (Date.now() - session.connectAt > 15000) {
      session.fail("connectFailed");
      session.phase = "failed";
    }
  },

  joining(session, engine) {
    if (engine.clientServerPort() !== 0) engine.pointClientAt(0);
    if (engine.connectionState() === CONNECTION.active) {
      session.phase = "connected";
      session.lastViewOrigin = null;
      session.spawn ??= { tries: 0, sentAt: 0 };
      session.note("connected to the host");
    } else if (Date.now() - session.connectAt > 90000) {
      session.fail("notLetIn");
      session.phase = "failed";
    }
  },

  connected(session, engine, screen) {
    if (engine.connectionState() < CONNECTION.challenging) {
      session.phase = "ended";
      session.note("disconnected");
    } else if (!session.peer && session.hostLeftAt && Date.now() - session.hostLeftAt > HOST_GONE_MS) {
      session.phase = "ended";
      session.fail("hostLeft");
      engine.command("disconnect");
    } else {
      syncGuestPause(session, engine, screen);
      // The host may keep the lobby open for minutes; a slow moment there must not time us out. If the host really
      // leaves, the relay tells us.
      if (session.hostState?.screen !== "playing") engine.keepClientAlive();
      stayNearHost(session);
    }
  },
};

/** Opening our menu pauses everyone; someone else's menu pauses us. */
function syncGuestPause(session, engine, screen) {
  const menuOpen = engine.menuOpen() && screen === "playing";
  if (menuOpen !== session.menuOpen) {
    session.menuOpen = menuOpen;
    if (session.peer) send(session, { t: "pause", on: menuOpen });
  }
  const paused = menuOpen || (session.peer && Boolean(session.remotePause));
  if (paused) {
    if (!session.paused) session.note(menuOpen ? "paused" : "paused by another player");
    if (!engine.dvar("svPaused")) engine.setDvar("svPaused", 1);
    if (!engine.dvar("clPaused")) engine.setDvar("clPaused", 1);
    engine.keepClientAlive();
  } else {
    if (session.paused) {
      engine.keepClientAlive();
      session.note("resumed");
    }
    if (engine.dvar("svPaused")) engine.setDvar("svPaused", 0);
    if (engine.dvar("clPaused")) engine.setDvar("clPaused", 0);
  }
  session.paused = paused;
}

const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** Some maps spawn guests far from everyone; after each spawn, move next to the host if that happened. */
function stayNearHost(session) {
  if (session.hostState?.screen !== "playing") return;
  const view = latestView();
  if (view && view.ms !== session.lastViewMs) {
    const previous = session.lastViewOrigin;
    session.lastViewMs = view.ms;
    session.lastViewOrigin = view.origin;
    if (!previous || distance(previous, view.origin) > SPAWN_JUMP) session.spawn ??= { tries: 0, sentAt: 0 };
  }
  const pending = session.spawn;
  if (!pending || session.paused) return;
  const host = session.hostPos;
  const mine = session.lastViewOrigin;
  if (!host || Date.now() - host.at > HOST_POS_MAX_AGE_MS || !mine) return;
  if (pending.sentAt && Date.now() - pending.sentAt < SPAWN_CHECK_MS) return;
  if (distance(host.origin, mine) <= NEAR_HOST) {
    session.spawn = null;
  } else if (pending.tries >= SPAWN_TRIES) {
    session.spawn = null;
    session.note("could not get next to the host");
  } else if (moveToHost(session, pending.tries ? "spawn, retry" : "spawn")) {
    pending.sentAt = Date.now();
    pending.tries += 1;
  }
}

/** Teleports our player to the host's position (also the card's "Go to the host" button). */
export function moveToHost(session, why) {
  const engine = session.engine;
  const host = session.hostPos;
  if (!engine || session.phase !== "connected" || !host) return false;
  if (Date.now() - (session.movedAt ?? 0) < 1000) return false;
  const target = [host.origin[0], host.origin[1], host.origin[2] + EYE_HEIGHT];
  if (!engine.command(`setviewpos ${target.map((v) => v.toFixed(1)).join(" ")}`)) return false;
  session.movedAt = Date.now();
  session.note(`moved next to the host (${why})`);
  return true;
}
