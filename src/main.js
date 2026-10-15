// Entry point, injected into vel.gg's page before its own scripts run (manifest: run_at document_start, world MAIN).
import { createRoomCode, normalizeRoomCode } from "../relay/src/protocol.js";
import { CONNECTION } from "./engine/builds.js";
import { BASE, go, keepSinglePlayer } from "./game/page.js";
import { AIM_SPEEDS, Gamepad } from "./input/gamepad.js";
import { startPump } from "./net/pump.js";
import { guestTick, moveToHost } from "./session/guest.js";
import { holdStart, hookMain, hookWasm } from "./session/hooks.js";
import { hostTick } from "./session/host.js";
import { onControl } from "./session/messages.js";
import { createSession } from "./session/session.js";
import { Card } from "./ui/card.js";
import { LANG, T } from "./ui/strings.js";
import { view } from "./ui/view.js";
import { DEFAULT_RELAY, inviteLink, normalizeRelay } from "./util/relay.js";
import { createFun, funActions, funTick, watchConsole } from "./fun/fun.js";
import { cleanName, guestIdFor, saveSetting } from "./util/settings.js";
import { checkForUpdate, RELAY_GUIDE } from "./util/updates.js";

const TICK_MS = 50;
const LANG_QUERY = LANG === "pt" ? "?lang=pt#" : "#";
const USAGE_REFRESH_MS = 600000;

if (!window.__bo1Coop) start();

function start() {
  const session = createSession();
  window.__bo1Coop = session;
  session.fun = createFun();
  watchConsole(session);
  if (session.mode) keepSinglePlayer(session.room);

  // Both hooks must be in place before vel.gg loads the engine.
  hookWasm(session);
  hookMain(session);

  const card = new Card(actions(session));
  session.card = card;
  card.mount();

  if (session.controller) {
    session.gamepad = new Gamepad({
      // Only while our player is in a game: then the engine takes commands and the menus own the cursor.
      engine: () => {
        const engine = session.engine;
        return engine && session.patched && engine.connectionState() === CONNECTION.active ? { Module: engine.Module, command: (text) => engine.command(text) } : null;
      },
      canvasSize: () => {
        const canvas = document.getElementById("game");
        return { width: canvas?.width || 1280, height: canvas?.height || 720 };
      },
      aimLevel: session.aimLevel,
    });
    session.gamepad.start();
  }

  const refreshUsage = () =>
    fetch(`${session.relay}/usage`)
      .then((r) => (r.ok ? r.json() : null))
      .then((usage) => (session.usage = Number.isFinite(usage?.fraction) ? usage : null))
      .catch(() => (session.usage = null));
  refreshUsage();
  setInterval(refreshUsage, USAGE_REFRESH_MS);
  checkForUpdate(session);

  if (session.mode) {
    if (session.mode === "guest") session.guestId = guestIdFor(session.room);
    session.phase = session.mode === "host" ? "hosting" : "joining-room";
    session.pump = startPump(session, onControl);
    if (session.mode === "host") holdStart(session, card.host);
  }

  setInterval(() => tick(session), TICK_MS);
}

function tick(session) {
  try {
    if (session.mode === "host") hostTick(session);
    else if (session.mode === "guest") guestTick(session);
    if (session.mode) reportHidden(session);
    funTick(session);
  } catch (error) {
    session.error = error.message;
    session.note(`tick failed: ${error.stack ?? error}`);
  }
  session.card.render(view(session));
}

/**
 * A hidden tab gets no animation frames, and the engine draws (and runs) its frames from them. Told the tab is hidden,
 * it runs them from a timer on its own thread instead, as vel.gg's own co-op does: a host or guest who switches tabs
 * keeps the game going for everyone.
 */
function reportHidden(session) {
  const input = session.engine?.Module._KB_Input;
  if (!input || session.reportedHidden === document.hidden) return;
  input(8, Number(document.hidden), 0);
  session.reportedHidden = document.hidden;
}

const copy = (session, text, stamp) =>
  navigator.clipboard?.writeText(text).then(
    () => (session[stamp] = Date.now()),
    () => (session.notice = text),
  );

const reloadWithRelay = (relay) => {
  saveSetting("relay", relay);
  location.reload();
};

/** What each button and field on the card does. */
function actions(session) {
  return {
    host: () => go(`${BASE}?coop=host&coopRoom=${createRoomCode()}${session.relayParam}`),
    join: (text) => {
      const code = normalizeRoomCode(text);
      if (code) go(`${BASE}?coop=join&coopRoom=${code}${session.relayParam}`);
      else session.notice = T.notRoomCode;
    },
    copyLink: () => copy(session, inviteLink(session), "copiedLinkAt"),
    copyCode: () => copy(session, session.room, "copiedCodeAt"),
    leave: () => {
      session.pump?.postMessage({ type: "close" });
      go(location.pathname);
    },
    startNow: () => (session.startAlone = true),
    rejoin: () => location.reload(),
    openUpdate: () => window.open(session.update?.url, "_blank", "noopener"),
    openRelayGuide: () => window.open(`${RELAY_GUIDE.replace("#", LANG_QUERY)}`, "_blank", "noopener"),
    goToHost: () => moveToHost(session, "button"),
    settings: () => (session.showSettings = !session.showSettings),
    saveName: (text) => {
      session.name = cleanName(text);
      saveSetting("name", session.name);
      session.sentPhaseAt = 0; // resend our state, which carries the name
    },
    editRelay: () => (session.editRelay = !session.editRelay),
    // From the over-quota notice: open settings straight at the relay field.
    editRelayNow: () => {
      session.showSettings = true;
      session.editRelay = true;
    },
    saveRelay: (text) => {
      const url = normalizeRelay(text ?? "");
      if (url) reloadWithRelay(url === DEFAULT_RELAY ? "" : url);
      else session.notice = T.notRelay;
    },
    defaultRelay: () => reloadWithRelay(""),
    useInviteRelay: () => reloadWithRelay(session.inviteRelay),
    controller: () => {
      session.controller = !session.controller;
      saveSetting("controller", session.controller ? "1" : "0");
      session.notice = T.controllerReload;
    },
    aimDown: () => setAim(session, session.aimLevel - 1),
    aimUp: () => setAim(session, session.aimLevel + 1),
    ...funActions(session),
  };
}

function setAim(session, level) {
  session.aimLevel = Math.max(0, Math.min(AIM_SPEEDS.length - 1, level));
  if (session.gamepad) session.gamepad.aimLevel = session.aimLevel;
  saveSetting("aim", String(session.aimLevel));
}
