// What the extension reads from (or does to) vel.gg's own page: the map being played, the screen it shows, the
// arguments it starts the engine with.

export const BASE = "/bo1z/";

/** Engine map name -> vel.gg URL slug. */
export const MAP_SLUGS = {
  zombie_pentagon: "five",
  zombie_theater: "kino",
  zombie_cod5_factory: "riese",
  zombie_cod5_prototype: "nacht",
  zombie_cod5_asylum: "verruckt",
  zombie_cod5_sumpf: "shinonuma",
  zombie_cosmodrome: "ascension",
  zombie_coast: "cotd",
  zombie_temple: "shangrila",
  zombie_moon: "moon",
};

export const MAP_NAMES = {
  five: "Five",
  kino: "Kino der Toten",
  riese: "Der Riese",
  nacht: "Nacht der Untoten",
  verruckt: "Verrückt",
  shinonuma: "Shi No Numa",
  ascension: "Ascension",
  cotd: "Call of the Dead",
  shangrila: "Shangri-La",
  moon: "Moon",
};

/** vel.gg's page state: "landing", "download", "loading", "ready" (click to start), "playing" or "error". */
export const screen = () => window.five?.screen;

export function currentZone() {
  const zone = document.documentElement?.dataset.map;
  if (zone) return zone;
  const slug = currentSlug();
  return Object.keys(MAP_SLUGS).find((z) => MAP_SLUGS[z] === slug) ?? null;
}

export function currentSlug() {
  const zone = document.documentElement?.dataset.map;
  if (zone && MAP_SLUGS[zone]) return MAP_SLUGS[zone];
  const match = location.pathname.match(/^\/(?:bo1z\/)?([a-z]+)\/?$/);
  return match && Object.values(MAP_SLUGS).includes(match[1]) ? match[1] : null;
}

/** Hell mode (vel.gg calls it horde). */
export const currentHorde = () => document.documentElement?.dataset.mode === "horde" || new URLSearchParams(location.search).get("horde") === "1";

/** vel.gg's gun set: "classic" or "cs" (Counter-Strike guns, a different set of packs). */
export const currentGuns = () => (new URLSearchParams(location.search).get("guns") === "cs" ? "cs" : "classic");

/**
 * vel.gg has its own co-op now: a map page whose URL says ?room= or mode=multi starts vel.gg's lobby instead of the
 * plain game, and the landing's "Multiplayer" choice leads there. While this extension runs a session, every page URL
 * is kept in single-player mode with our room under coopRoom, including the URL the landing pushes when a map is
 * picked and the mode the landing hands over in globalThis.__kisakMode.
 */
export function keepSinglePlayer(room) {
  const fix = (value) => {
    const url = new URL(value, location.href);
    if (url.origin !== location.origin || !`${url.pathname}/`.startsWith(BASE)) return value;
    const params = url.searchParams;
    params.delete("room");
    params.set("coopRoom", room);
    params.set("mode", "single");
    if (params.get("guns") !== "cs") params.set("guns", "classic");
    return url.href;
  };
  history.replaceState(history.state, "", fix(location.href));
  for (const name of ["pushState", "replaceState"]) {
    const original = history[name];
    history[name] = function (state, title, url) {
      return original.call(this, state, title, url == null ? url : fix(String(url)));
    };
  }
  Object.defineProperty(globalThis, "__kisakMode", { configurable: true, get: () => "single", set() {} });
  // vel.gg labels the game "Single player" in a corner; with the extension it is not.
  const style = document.createElement("style");
  style.textContent = "#coop-mode-label { display: none !important; }";
  document.documentElement.append(style);
}

/** The local player's latest camera position, as vel.gg reports it. */
export function latestView() {
  const view = window.five?.views?.at(-1);
  return view && Array.isArray(view.origin) && view.origin.length === 3 && view.origin.every(Number.isFinite) ? view : null;
}

export const go = (url) => location.assign(url);

// Engine command line ------------------------------------------------------------------------------------------

/** Settings that change the game itself; the guest copies the host's so both run the same rules. */
const GAME_SETTINGS = /^(fs_mods|horde_[a-z_]+|kisak_mod_[a-z_]+|r_mod_[a-z_]+|r_dobjLimit|cg_mod_[a-z_]+|zinfo|noperks)$/i;

export function devmapZone(args) {
  const i = args.indexOf("+devmap");
  return i >= 0 ? args[i + 1] : null;
}

export function insertBeforeDevmap(args, extra) {
  const i = args.indexOf("+devmap");
  args.splice(i < 0 ? args.length : i, 0, ...extra);
}

export function gameSettings(args) {
  const out = [];
  for (let i = 0; i + 2 < args.length; i += 1) if (args[i] === "+set" && GAME_SETTINGS.test(args[i + 1])) out.push([args[i + 1], args[i + 2]]);
  return out;
}

/** Replaces the local game settings with the host's (names and values are validated first). */
export function applyGameSettings(args, settings) {
  for (let i = args.length - 3; i >= 0; i -= 1) if (args[i] === "+set" && GAME_SETTINGS.test(args[i + 1])) args.splice(i, 3);
  const safe = settings.filter(([k, v]) => typeof k === "string" && GAME_SETTINGS.test(k) && typeof v === "string" && /^[\w .-]{0,64}$/.test(v));
  insertBeforeDevmap(args, safe.flatMap(([k, v]) => ["+set", k, v]));
}

/** The display's refresh rate, measured over 30 frames (the host caps the engine to it). */
export function measureRefreshRate(onResult) {
  const times = [];
  const step = (t) => {
    times.push(t);
    if (times.length < 30) return void requestAnimationFrame(step);
    const deltas = times.slice(1).map((v, i) => v - times[i]).sort((a, b) => a - b);
    const median = deltas[deltas.length >> 1];
    if (median > 0) onResult(Math.max(30, Math.min(240, Math.round(1000 / median))));
  };
  requestAnimationFrame(step);
}
