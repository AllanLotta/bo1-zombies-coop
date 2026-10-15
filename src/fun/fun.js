// Fun mode: lets the host (or a solo player) change the game for every player. Everything goes through
// the engine's own mechanisms, either flags the native console cheats flip (god, notarget, noclip, ...) or settings
// and commands the engine already has (player_sustainAmmo, jump_height, ai, give, ...). Only the host's server is
// touched, so it works for guests running the public extension too.
import { SLOT } from "../engine/builds.js";
import { MAP_SLUGS, currentZone, screen as pageScreen } from "../game/page.js";
import { LANG } from "../ui/strings.js";

const TEXT = {
  en: {
    title: "Fun mode",
    note: "Host only. Changes apply to everyone in your game.",
    pause: "Tip: press Esc in game to open this card.",
    flyHint: "Fly and Noclip go through walls: switch them off standing on the floor, or you fall out of the map.",
    players: "Players",
    all: "Everyone",
    god: "God",
    demigod: "Can't die",
    notarget: "Invisible",
    noclip: "Noclip",
    ufo: "Fly",
    speed: "Speed",
    money: "Points",
    ammo: "Ammo",
    infiniteClip: "Infinite clip",
    infiniteStock: "Infinite reserve",
    refill: "Refill everyone",
    zombies: "Zombies",
    oneHit: "Die in one hit",
    passive: "Ignore players",
    clear: "Clear zombies",
    world: "World",
    timescale: "Game speed",
    jump: "Jump height",
    gravity: "Gravity",
    weapons: "Weapons (for you)",
    weaponMissing: (w) => `${w} is not on this map.`,
    weaponGiven: (w) => `${w} given.`,
    reset: "Reset everything",
    notLoaded: "Start a map to use this.",
    cheatsOff: "This map has cheats off: the commands won't work.",
  },
  pt: {
    title: "Modo diversão",
    note: "Só o host. Vale para todo mundo na sua partida.",
    pause: "Dica: aperte Esc no jogo para abrir este cartão.",
    flyHint: "Voa e Atravessa passam por paredes: desligue com os p\u00e9s no ch\u00e3o, sen\u00e3o o jogador cai para fora do mapa.",
    players: "Jogadores",
    all: "Todos",
    god: "Imortal",
    demigod: "Não morre",
    notarget: "Invisível",
    noclip: "Atravessa",
    ufo: "Voa",
    speed: "Velocidade",
    money: "Pontos",
    ammo: "Munição",
    infiniteClip: "Pente infinito",
    infiniteStock: "Reserva infinita",
    refill: "Encher a de todos",
    zombies: "Zumbis",
    oneHit: "Morrem com 1 tiro",
    passive: "Ignoram vocês",
    clear: "Limpar zumbis",
    world: "Mundo",
    timescale: "Velocidade do jogo",
    jump: "Altura do pulo",
    gravity: "Gravidade",
    weapons: "Armas (para você)",
    weaponMissing: (w) => `${w} não existe neste mapa.`,
    weaponGiven: (w) => `${w} entregue.`,
    reset: "Resetar tudo",
    notLoaded: "Abra um mapa para usar.",
    cheatsOff: "Este mapa está com cheats desligados: os comandos não vão funcionar.",
  },
};
const F = TEXT[LANG];

const PLAYER_TOGGLES = ["god", "demigod", "notarget", "noclip", "ufo"];
const SPEEDS = [0.5, 0.75, 1, 1.5, 2, 3];
const TIMESCALES = [0.25, 0.5, 0.75, 1, 1.5, 2];
const JUMPS = [39, 80, 150, 300, 600];
const GRAVITIES = [800, 600, 400, 200, 100];
const STOCK = 999;

// Name in the give command -> label. Wonder weapons only exist on some maps; the engine refuses the others.
export const WEAPONS = [
  ["ray_gun_zm", "Ray Gun"],
  ["ray_gun_upgraded_zm", "Ray Gun (PaP)"],
  ["thundergun_zm", "Thundergun"],
  ["thundergun_upgraded_zm", "Thundergun (PaP)"],
  ["tesla_gun_zm", "Wunderwaffe"],
  ["freezegun_zm", "Winter's Howl"],
  ["microwavegun_zm", "Wave Gun"],
  ["sniper_explosive_zm", "Scavenger"],
  ["crossbow_explosive_zm", "Crossbow"],
  ["knife_ballistic_zm", "Ballistic Knife"],
  ["hk21_zm", "HK21"],
  ["rpk_zm", "RPK"],
  ["galil_zm", "Galil"],
  ["commando_zm", "Commando"],
  ["famas_zm", "FAMAS"],
  ["aug_acog_zm", "AUG"],
  ["spas_zm", "SPAS-12"],
  ["china_lake_zm", "China Lake"],
  ["python_zm", "Python"],
  ["cz75dw_zm", "CZ75 Dual"],
  ["zombie_cymbal_monkey", "Monkey Bomb"],
  ["zombie_black_hole_bomb", "Gersh Device"],
  ["bowie_knife_zm", "Bowie Knife"],
  ["claymore_zm", "Claymores"],
];

export function createFun() {
  return {
    open: false,
    players: {}, // slot -> { god, demigod, notarget, noclip, ufo, speed }
    infiniteClip: false,
    infiniteStock: false,
    oneHit: false,
    passive: false,
    timescale: 1,
    jump: 39,
    gravity: 800,
    queue: [], // console commands waiting for the engine's mailbox
    notice: null,
    noticeAt: 0,
    lastStockAt: 0,
    lastZombiesAt: 0,
  };
}

const playerState = (fun, slot) => (fun.players[slot] ??= { god: false, demigod: false, notarget: false, noclip: false, ufo: false, speed: 1 });

/** Who is in the game right now: [{ slot, n, name }]. Slot 0 is always the host (or the solo player). */
export function funPlayers(session) {
  const players = [{ slot: 0, n: 1, name: session.name || (LANG === "pt" ? "Você" : "You") }];
  if (session.mode === "host") {
    for (const g of session.guests.values()) {
      if (g.present && g.slot?.state === SLOT.active) players.push({ slot: g.slot.slot, n: g.seat + 1, name: g.state?.name || `${LANG === "pt" ? "Jogador" : "Player"} ${g.seat + 1}` });
    }
  }
  return players;
}

/** Only the host, or someone playing solo, runs the server this panel changes. */
export const funAvailable = (session) => session.mode !== "guest";

function addresses(session) {
  const f = session.build?.fun;
  const engine = session.engine;
  if (!f || !engine) return null;
  return {
    f,
    engine,
    ent: (slot) => f.entities + slot * f.entitySize,
    client: (slot) => engine.int(f.entities + slot * f.entitySize + f.ent.client),
  };
}

function setBit(engine, address, bit, on) {
  if (on) Atomics.or(engine.i32, address >> 2, bit);
  else Atomics.and(engine.i32, address >> 2, ~bit);
}

function say(fun, text) {
  fun.notice = text;
  fun.noticeAt = Date.now();
}

/** Called every tick. Keeps toggles applied (respawns and scripts reset some of them) and drains the command queue. */
export function funTick(session) {
  const fun = session.fun;
  if (fun.notice && Date.now() - fun.noticeAt > 6000) fun.notice = null;
  const a = addresses(session);
  if (!a || !funAvailable(session) || pageScreen() !== "playing") {
    flushQueue(session);
    return;
  }
  const { f, engine } = a;
  const now = Date.now();
  for (const { slot } of funPlayers(session)) {
    const p = fun.players[slot];
    if (!p) continue;
    const ent = a.ent(slot);
    const client = a.client(slot);
    if (!client) continue;
    if (p.god || p.demigod || p.notarget) {
      if (p.god) setBit(engine, ent + f.ent.flags, f.entFlags.god, true);
      if (p.demigod) setBit(engine, ent + f.ent.flags, f.entFlags.demigod, true);
      if (p.notarget) setBit(engine, ent + f.ent.flags, f.entFlags.notarget, true);
    }
    if (p.noclip) setBit(engine, client + f.client.flags, f.clientFlags.noclip, true);
    if (p.ufo) setBit(engine, client + f.client.flags, f.clientFlags.ufo, true);
    if (p.speed !== 1) new Float32Array(engine.buffer)[(client + f.client.speedScale) >> 2] = p.speed;
  }
  if (fun.infiniteStock && now - fun.lastStockAt > 500) {
    fun.lastStockAt = now;
    refillStock(session, a);
  }
  if ((fun.oneHit || fun.passive) && now - fun.lastZombiesAt > 1500) {
    // New zombies spawn all the time: re-apply to every living one. Skipped while earlier commands are waiting.
    fun.lastZombiesAt = now;
    if (!fun.queue.length) {
      if (fun.oneHit) fun.queue.push("ai axis health 1");
      if (fun.passive) fun.queue.push("ai axis ignoreall 1");
    }
  }
  flushQueue(session);
}

function flushQueue(session) {
  const fun = session.fun;
  if (!fun.queue.length || !session.engine) return;
  if (session.engine.command(fun.queue[0])) fun.queue.shift();
}

function refillStock(session, a, slots = funPlayers(session).map((p) => p.slot)) {
  const { f, engine } = a;
  for (const slot of slots) {
    const client = a.client(slot);
    if (!client) continue;
    for (let i = 0; i < f.client.ammoSlots; i += 1) {
      const pool = client + f.client.ammoPools + 8 * i;
      if (engine.int(pool) && engine.int(pool + 4) < STOCK) engine.setInt(pool + 4, STOCK);
    }
  }
}

/** Watches the engine's console for a give that failed, to tell the host the weapon is not on this map. */
export function watchConsole(session) {
  for (const level of ["log", "warn", "error"]) {
    const original = console[level];
    console[level] = function (...args) {
      const text = typeof args[0] === "string" ? args[0] : "";
      const missing = text.match(/Could not load weapon "([^"]+)"/);
      if (missing && session.fun?.pendingWeapon === missing[1]) {
        const label = WEAPONS.find(([w]) => w === missing[1])?.[1] ?? missing[1];
        say(session.fun, F.weaponMissing(label));
        session.fun.pendingWeapon = null;
      }
      return original.apply(this, args);
    };
  }
}

function step(list, value, direction) {
  const i = list.indexOf(value);
  const at = i < 0 ? list.indexOf(list.reduce((best, v) => (Math.abs(v - value) < Math.abs(best - value) ? v : best), list[0])) : i;
  return list[Math.max(0, Math.min(list.length - 1, at + direction))];
}

/** Button handlers. Each receives the button's data-arg. */
export function funActions(session) {
  const fun = session.fun;
  const engineReady = () => Boolean(addresses(session));
  const togglePlayer = (key, slot) => {
    const a = addresses(session);
    const p = playerState(fun, slot);
    p[key] = !p[key];
    if (!p[key] && a) {
      // Switching off has to clear the bit once; switching on is kept applied by funTick.
      const client = a.client(slot);
      if (key === "noclip" || key === "ufo") {
        if (client) setBit(a.engine, client + a.f.client.flags, a.f.clientFlags[key], false);
      } else {
        setBit(a.engine, a.ent(slot) + a.f.ent.flags, a.f.entFlags[key], false);
      }
    }
  };
  const setSpeed = (slot, value) => {
    const a = addresses(session);
    playerState(fun, slot).speed = value;
    const client = a?.client(slot);
    if (client) new Float32Array(a.engine.buffer)[(client + a.f.client.speedScale) >> 2] = value;
  };
  const addPoints = (slot, amount) => {
    const a = addresses(session);
    const client = a?.client(slot);
    if (!client) return;
    const score = client + a.f.client.score;
    a.engine.setInt(score, amount === "max" ? 9999990 : amount === "zero" ? 0 : Math.min(9999990, a.engine.int(score) + amount));
  };
  const parse = (arg) => {
    const [what, slot] = String(arg).split(":");
    return { what, slot: slot === "all" ? "all" : Number(slot) };
  };
  const forSlots = (slot) => (slot === "all" ? funPlayers(session).map((p) => p.slot) : [slot]);

  return {
    fun: () => (fun.open = !fun.open),
    funToggle: (arg) => {
      if (!engineReady()) return;
      const { what, slot } = parse(arg);
      if (slot === "all") {
        const slots = forSlots("all");
        const turnOn = !slots.every((s) => playerState(fun, s)[what]);
        for (const s of slots) if (playerState(fun, s)[what] !== turnOn) togglePlayer(what, s);
      } else {
        togglePlayer(what, slot);
      }
    },
    funSpeed: (arg) => {
      if (!engineReady()) return;
      const { what, slot } = parse(arg);
      for (const s of forSlots(slot)) setSpeed(s, step(SPEEDS, playerState(fun, s).speed, what === "up" ? 1 : -1));
    },
    funPoints: (arg) => {
      if (!engineReady()) return;
      const { what, slot } = parse(arg);
      const amount = what === "max" || what === "zero" ? what : Number(what);
      for (const s of forSlots(slot)) addPoints(s, amount);
    },
    funAmmo: (arg) => {
      if (!engineReady()) return;
      if (arg === "clip") {
        fun.infiniteClip = !fun.infiniteClip;
        fun.queue.push(`set player_sustainAmmo ${fun.infiniteClip ? 1 : 0}`);
      } else if (arg === "stock") {
        fun.infiniteStock = !fun.infiniteStock;
      } else if (arg === "refill") {
        refillStock(session, addresses(session));
      }
    },
    funZombies: (arg) => {
      if (!engineReady()) return;
      if (arg === "onehit") fun.oneHit = !fun.oneHit;
      else if (arg === "passive") {
        fun.passive = !fun.passive;
        if (!fun.passive) fun.queue.push("ai axis ignoreall 0");
      } else if (arg === "clear") fun.queue.push("ai axis delete");
      if (fun.oneHit && arg === "onehit") fun.queue.push("ai axis health 1");
      if (fun.passive && arg === "passive") fun.queue.push("ai axis ignoreall 1");
    },
    funWorld: (arg) => {
      if (!engineReady()) return;
      const [what, dir] = String(arg).split(":");
      const direction = dir === "up" ? 1 : -1;
      if (what === "timescale") {
        fun.timescale = step(TIMESCALES, fun.timescale, direction);
        fun.queue.push(`timescale ${fun.timescale}`);
      } else if (what === "jump") {
        fun.jump = step(JUMPS, fun.jump, direction);
        fun.queue.push(`jump_height ${fun.jump}`);
      } else if (what === "gravity") {
        fun.gravity = step(GRAVITIES, fun.gravity, direction);
        fun.queue.push(`bg_gravity ${fun.gravity}`);
      }
    },
    funWeapon: (weapon) => {
      if (!engineReady()) return;
      fun.pendingWeapon = weapon;
      fun.queue.push(`give ${weapon}`);
      const label = WEAPONS.find(([w]) => w === weapon)?.[1] ?? weapon;
      say(fun, F.weaponGiven(label));
    },
    funReset: () => {
      const a = addresses(session);
      for (const { slot } of funPlayers(session)) {
        const p = playerState(fun, slot);
        for (const key of PLAYER_TOGGLES) if (p[key]) togglePlayer(key, slot);
        if (p.speed !== 1) setSpeed(slot, 1);
      }
      fun.infiniteStock = false;
      fun.oneHit = false;
      if (fun.passive) fun.queue.push("ai axis ignoreall 0");
      fun.passive = false;
      if (fun.infiniteClip) fun.queue.push("set player_sustainAmmo 0");
      fun.infiniteClip = false;
      if (fun.timescale !== 1) fun.queue.push("timescale 1");
      if (fun.jump !== 39) fun.queue.push("jump_height 39");
      if (fun.gravity !== 800) fun.queue.push("bg_gravity 800");
      Object.assign(fun, { timescale: 1, jump: 39, gravity: 800 });
      if (!a) fun.queue.length = 0;
    },
  };
}

const fmt = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/0$/, ""));

/** The card section. */
export function funSection(session) {
  const fun = session.fun;
  const blocks = [];
  const a = addresses(session);
  if (!a || !["ready", "playing"].includes(pageScreen())) {
    blocks.push({ kind: "text", cls: "muted small", text: F.notLoaded });
    return { kind: "section", title: F.title, act: "fun", open: fun.open, blocks };
  }
  const cheats = (() => {
    const dvar = a.engine.int(a.f.cheatsDvar);
    return dvar ? a.engine.byte(dvar + 24) === 1 : true;
  })();
  blocks.push({ kind: "text", cls: "muted small", text: `${F.note} ${F.pause}` });
  if (!cheats) blocks.push({ kind: "callout", tone: "wait", text: F.cheatsOff });
  if (fun.notice) blocks.push({ kind: "callout", tone: "info", text: fun.notice });

  const players = funPlayers(session);
  blocks.push({ kind: "label", text: F.players });
  const rows = players.length > 1 ? [...players, { slot: "all", n: 0, name: F.all }] : players;
  for (const p of rows) {
    const state = p.slot === "all" ? null : playerState(fun, p.slot);
    const allOn = (key) => players.every((q) => playerState(fun, q.slot)[key]);
    const on = (key) => (state ? state[key] : allOn(key));
    const speed = state ? state.speed : players.every((q) => playerState(fun, q.slot).speed === playerState(fun, players[0].slot).speed) ? playerState(fun, players[0].slot).speed : null;
    const score = state ? a.engine.int((a.client(p.slot) || 0) + a.f.client.score) : null;
    blocks.push({
      kind: "funPlayer",
      n: p.n,
      name: p.name,
      chips: PLAYER_TOGGLES.map((key) => ({ act: "funToggle", arg: `${key}:${p.slot}`, label: F[key], on: on(key) })),
      speed: { label: F.speed, value: speed == null ? "–" : `${fmt(speed)}×`, dec: { act: "funSpeed", arg: `down:${p.slot}` }, inc: { act: "funSpeed", arg: `up:${p.slot}` } },
      money: {
        label: F.money,
        value: score == null ? "" : score.toLocaleString(),
        buttons: [
          { act: "funPoints", arg: `5000:${p.slot}`, label: "+5k" },
          { act: "funPoints", arg: `50000:${p.slot}`, label: "+50k" },
          { act: "funPoints", arg: `max:${p.slot}`, label: "Max" },
          { act: "funPoints", arg: `zero:${p.slot}`, label: "0" },
        ],
      },
    });
  }

  if (players.some((p) => fun.players[p.slot]?.noclip || fun.players[p.slot]?.ufo)) blocks.push({ kind: "callout", tone: "wait", text: F.flyHint });

  blocks.push({ kind: "label", text: F.ammo });
  blocks.push({
    kind: "chips",
    chips: [
      { act: "funAmmo", arg: "clip", label: F.infiniteClip, on: fun.infiniteClip },
      { act: "funAmmo", arg: "stock", label: F.infiniteStock, on: fun.infiniteStock },
      { act: "funAmmo", arg: "refill", label: F.refill, on: false, plain: true },
    ],
  });

  blocks.push({ kind: "label", text: F.zombies });
  blocks.push({
    kind: "chips",
    chips: [
      { act: "funZombies", arg: "onehit", label: F.oneHit, on: fun.oneHit },
      { act: "funZombies", arg: "passive", label: F.passive, on: fun.passive },
      { act: "funZombies", arg: "clear", label: F.clear, on: false, plain: true },
    ],
  });

  blocks.push({ kind: "label", text: F.world });
  blocks.push({ kind: "stepper", label: F.timescale, value: `${fmt(fun.timescale)}×`, dec: { act: "funWorld", arg: "timescale:down" }, inc: { act: "funWorld", arg: "timescale:up" } });
  blocks.push({ kind: "stepper", label: F.jump, value: String(fun.jump), dec: { act: "funWorld", arg: "jump:down" }, inc: { act: "funWorld", arg: "jump:up" } });
  blocks.push({ kind: "stepper", label: F.gravity, value: String(fun.gravity), dec: { act: "funWorld", arg: "gravity:down" }, inc: { act: "funWorld", arg: "gravity:up" } });

  blocks.push({ kind: "label", text: F.weapons, aside: MAP_SLUGS[session.zone ?? currentZone()] ?? "" });
  blocks.push({ kind: "grid", buttons: WEAPONS.map(([w, label]) => ({ act: "funWeapon", arg: w, label })) });

  blocks.push({ kind: "buttons", buttons: [{ act: "funReset", label: F.reset, style: "ghost" }] });
  return { kind: "section", title: F.title, act: "fun", open: fun.open, blocks };
}
