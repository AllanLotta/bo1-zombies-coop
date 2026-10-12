// Turns the session into the card's view model: a header chip, a list of blocks, and the compact pill shown while
// playing. Pure function of the session (plus the page's screen), recomputed every tick.
import { MAX_GUESTS } from "../../shared/protocol.js";
import { currentHorde, currentSlug, currentZone, MAP_NAMES, MAP_SLUGS, screen as pageScreen } from "../game/page.js";
import { AIM_SPEEDS } from "../input/gamepad.js";
import { guestRoster, hostRoster } from "../session/lobby.js";
import { validSeat } from "../session/session.js";
import { DEFAULT_RELAY } from "../util/relay.js";
import { cleanName } from "../util/settings.js";
import { T } from "./strings.js";

const COPIED_MS = 2000;
const CONNECTED = ["ingame", "ready", "lobby"];
const ON_THE_WAY = ["joining", "turn", "loading", "opening", "reconnecting"];

export function view(session) {
  const screen = pageScreen();
  const playing = screen === "playing" && !session.engine?.menuOpen();
  const blocks = [];
  if (session.error) blocks.push({ kind: "callout", tone: "bad", text: session.error });
  if (session.notice) blocks.push({ kind: "callout", tone: "info", text: session.notice });
  if (session.update) blocks.push({ kind: "callout", tone: "ok", text: T.updateAvailable(session.update.version), buttons: [{ act: "openUpdate", label: T.updateHow, style: "primary" }] });
  if (!session.mode) return soloView(session, blocks, playing);

  const hosting = session.mode === "host";
  const roster = hosting ? hostRoster(session).players : guestRoster(session);
  const chip = hosting ? hostSection(session, blocks, roster, screen) : guestSection(session, blocks, screen);

  const me = hosting ? 1 : validSeat(session.seat) ? session.seat + 1 : 0;
  const connected = roster.filter((p) => CONNECTED.includes(p.status)).length;
  blocks.push({ kind: "players", label: T.players, aside: T.playersAside(connected, MAX_GUESTS + 1), players: playerRows(session, roster, me) });

  const actions = [];
  if (!hosting && session.phase === "connected" && session.hostPos) actions.push({ act: "goToHost", label: T.goToHost });
  actions.push({ act: "leave", label: T.leave, style: "ghost" });
  blocks.push({ kind: "buttons", buttons: actions });
  blocks.push(settingsSection(session, true));

  const ping = session.stats?.rtt != null ? `${Math.round(session.stats.rtt)} ms` : "–";
  const pill = {
    players: roster.map((p) => ({ n: p.n, on: CONNECTED.includes(p.status) })),
    texts: [session.paused ? T.chip.paused : ping, ...(session.gamepad?.status === "active" ? ["\u{1F3AE}"] : [])],
  };
  return { chip, tagline: `${T.room} ${session.room}`, blocks, compact: playing && !session.error, pill };
}

function soloView(session, blocks, playing) {
  blocks.push({ kind: "text", cls: "muted", text: T.intro });
  blocks.push({ kind: "buttons", buttons: [{ act: "host", label: T.host, style: "primary" }] });
  blocks.push({ kind: "input", label: T.joinLabel, field: "join", placeholder: T.joinPlaceholder, act: "join", button: T.join });
  blocks.push(settingsSection(session, false));
  const pill = session.gamepad?.status === "active" ? { texts: ["\u{1F3AE}"] } : null;
  return { chip: { text: T.chip.solo }, tagline: T.tagline, blocks, compact: playing && !session.error && !session.notice, pill };
}

function hostSection(session, blocks, roster, screen) {
  const freeSeats = roster.filter((p) => p.status === "free").length;
  const onTheWay = roster.some((p) => !p.host && ON_THE_WAY.includes(p.status));
  const mapOpen = Boolean(session.engine) || screen === "loading" || screen === "download";
  const step = screen === "playing" ? 3 : screen === "ready" ? 2 : mapOpen ? 1 : 0;

  const linkCopied = Date.now() - session.copiedLinkAt < COPIED_MS;
  const codeCopied = Date.now() - session.copiedCodeAt < COPIED_MS;
  blocks.push({
    kind: "room",
    label: T.room,
    aside: T.inviteAside(freeSeats),
    code: session.room,
    buttons: [
      { act: "copyLink", label: linkCopied ? T.copied : T.copy, style: linkCopied ? "done" : "primary" },
      { act: "copyCode", label: codeCopied ? T.copied : T.copyCode, style: codeCopied ? "done" : "" },
    ],
  });
  blocks.push({ kind: "steps", steps: T.stepsHost, current: step });

  if (!mapOpen) blocks.push({ kind: "callout", tone: "info", text: T.pickMap });
  else if (session.gate) blocks.push({ kind: "callout", tone: "wait", text: T.gate, buttons: [{ act: "startNow", label: T.startNow }] });
  else if (screen === "ready" && !onTheWay && roster.some((p) => !p.host && p.status === "ready")) blocks.push({ kind: "callout", tone: "ok", text: T.allIn });
  else if (onTheWay && screen === "playing") blocks.push({ kind: "callout", tone: "info", text: T.latecomers });
  if (session.paused) blocks.push({ kind: "callout", tone: "wait", text: session.menuOpen ? T.pausedYou : T.pausedBy });

  blocks.push(mapBlock(MAP_SLUGS[session.zone ?? currentZone()] ?? null, currentHorde(), T.mapSubHost));

  if (session.error) return { text: T.chip.error, tone: "bad" };
  if (session.paused) return { text: T.chip.paused, tone: "wait" };
  return screen === "playing" ? { text: T.chip.ingame, tone: "ok live" } : { text: T.chip.hosting, tone: "wait live" };
}

const GUEST_STEP = { "joining-room": 0, following: 1, loading: 2, "waiting-host": 3, freezing: 3, connect: 3, challenging: 3, joining: 3, connected: 4 };

function guestSection(session, blocks, screen) {
  const phase = session.phase;
  const failed = ["ended", "failed"].includes(phase);
  const slug = session.lobby?.slug ?? session.hostInfo?.slug ?? null;
  const mapName = slug ? MAP_NAMES[slug] : null;
  let step = GUEST_STEP[phase] ?? session.lastStep ?? 0;
  if (phase === "joining-room" && session.hostInfo?.slug) step = 1;
  if (!failed) session.lastStep = step;

  if (session.inviteRelay && session.inviteRelay !== session.relay) {
    blocks.push({ kind: "callout", tone: "wait", text: T.otherRelay(new URL(session.inviteRelay).hostname), buttons: [{ act: "useInviteRelay", label: T.useRelay, style: "primary" }] });
  }
  blocks.push({ kind: "steps", steps: T.stepsGuest, current: step, fail: failed });

  const onHostMap = session.hostInfo?.slug && currentSlug() === session.hostInfo.slug;
  if ((phase === "loading" || (phase === "joining-room" && onHostMap)) && screen === "landing") {
    blocks.push({ kind: "callout", tone: "wait", title: "⌨", text: T.pressKey });
  } else {
    const text = guestMessage(session, phase, mapName, screen);
    if (text) blocks.push({ kind: "callout", tone: failed ? "bad" : phase === "connected" ? "ok" : "info", text, buttons: failed ? [{ act: "rejoin", label: T.rejoin, style: "primary" }] : [] });
  }
  if (session.joinedLate && ["joining", "connected"].includes(phase)) blocks.push({ kind: "callout", tone: "info", text: T.lateJoin });
  if (phase === "connected" && session.paused) blocks.push({ kind: "callout", tone: "wait", text: session.menuOpen ? T.pausedYou : T.pausedBy });
  blocks.push(mapBlock(slug, session.lobby?.horde ?? session.hostInfo?.horde, T.mapSubGuest));

  if (session.error) return { text: T.chip.error, tone: "bad" };
  if (failed) return { text: T.chip.ended, tone: "bad" };
  if (session.paused) return { text: T.chip.paused, tone: "wait" };
  if (phase === "connected") return screen === "playing" ? { text: T.chip.ingame, tone: "ok live" } : { text: T.chip.lobby, tone: "ok" };
  return { text: T.chip.joining, tone: "wait live" };
}

function guestMessage(session, phase, mapName, screen) {
  switch (phase) {
    case "joining-room":
      return session.peer ? (mapName ? T.opening(mapName) : T.hostPicking) : T.waitingHost;
    case "following":
      return T.opening(mapName ?? "…");
    case "loading":
      return T.loadingMap;
    case "waiting-host":
      if (session.hostState?.ready && !session.hostState.turn) return T.nextInLine;
      return session.peer ? T.hostLoading : T.waitingHost;
    case "freezing":
    case "connect":
    case "challenging":
      return T.connecting;
    case "joining":
      return T.joiningGame;
    case "connected":
      if (screen === "playing") return null;
      return session.hostState?.screen === "playing" || (screen === "ready" && session.lobby?.playing) ? T.clickToPlay : T.waitingStart;
    case "ended":
      return T.ended;
    case "failed":
      return T.failed;
    default:
      return null;
  }
}

function playerRows(session, roster, me) {
  return roster.map((p) => {
    const n = Number(p.n);
    const empty = p.status === "free";
    const tags = [];
    if (p.host) tags.push({ cls: "host", text: T.hostTag });
    if (n === me) tags.push({ cls: "you", text: T.you });
    return {
      n,
      name: empty ? T.st.free : cleanName(p.name) || T.player(n),
      tags,
      me: n === me,
      empty,
      status: empty ? (session.mode === "host" ? T.freeHint : "") : T.st[p.status] ?? T.st.away,
      tone: p.tone ?? "",
      ping: empty || p.host || !Number.isFinite(p.ping) ? null : p.ping,
    };
  });
}

function mapBlock(slug, horde, sub) {
  if (!slug) return { kind: "map", glyph: "?", name: T.noMap, sub };
  const name = MAP_NAMES[slug] ?? slug;
  return { kind: "map", glyph: name[0], name, tag: horde ? T.hell : null, sub };
}

function settingsSection(session, inRoom) {
  const blocks = [{ kind: "input", label: T.yourName, field: "name", placeholder: T.namePlaceholder, act: "saveName", button: T.save, value: session.name, maxLength: 16 }];
  if (inRoom) {
    const items = [
      [T.relay, T.relayState[session.socket] ?? T.relayState.idle, session.socket === "open" ? "" : "error"],
      [T.ping, session.stats?.rtt != null ? `${Math.round(session.stats.rtt)} ms` : "–"],
    ];
    if (session.stats?.lost) items.push([T.dropped, String(session.stats.lost)]);
    blocks.push({ kind: "kv", items });
  }
  blocks.push(...controllerBlocks(session), ...relayBlocks(session), { kind: "credits", text: T.credits });
  return { kind: "section", title: T.settings, act: "settings", open: session.showSettings, blocks };
}

function controllerBlocks(session) {
  const pad = session.gamepad;
  const name = pad?.name ? pad.name.replace(/\s*\(.*$/, "").slice(0, 32) : "";
  let status;
  if (!session.controller) status = T.ctrl.off;
  else if (!session.patched && session.hash) status = T.ctrl.unavailable;
  else if (!pad || pad.status === "none") status = T.ctrl.press;
  else if (pad.status === "active") status = T.ctrl.active(name, session.aimLevel + 1, AIM_SPEEDS.length);
  else status = T.ctrl.later(name);
  const buttons =
    session.controller && pad?.status !== "none"
      ? [{ act: "aimDown", label: T.aimDown }, { act: "aimUp", label: T.aimUp }, { act: "controller", label: T.turnOff, style: "ghost" }]
      : [{ act: "controller", label: session.controller ? T.turnOff : T.turnOn, style: "ghost" }];
  return [{ kind: "kv", items: [[T.controller, status]] }, { kind: "buttons", buttons }];
}

function relayBlocks(session) {
  const custom = session.relay !== DEFAULT_RELAY;
  const blocks = [{ kind: "kv", items: [[T.relay, custom ? T.relayCustom(new URL(session.relay).hostname) : T.relayDefault]] }];
  if (!custom) blocks.push({ kind: "text", cls: "muted small", text: T.relayNote });
  if (session.usage) {
    const resets = new Date(session.usage.resetsAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const label = session.usage.fraction >= 1 ? T.usedUp(resets) : T.usage(Math.round(session.usage.fraction * 100), resets);
    blocks.push({ kind: "meter", fraction: session.usage.fraction, label });
  }
  if (session.editRelay) {
    blocks.push({ kind: "input", field: "relay", placeholder: T.relayPlaceholder, act: "saveRelay", button: T.save, value: custom ? session.relay : "" });
    blocks.push({ kind: "text", cls: "muted small", text: T.relayEditNote });
    blocks.push({ kind: "buttons", buttons: [{ act: "defaultRelay", label: T.useDefault }, { act: "editRelay", label: T.cancel, style: "ghost" }] });
  } else {
    blocks.push({ kind: "buttons", buttons: [{ act: "editRelay", label: T.changeRelay, style: "ghost" }] });
  }
  return blocks;
}
