// BO1 Zombies Co-op 2.2.1 for vel.gg. Built from src/ with scripts/build.mjs; edit the sources, not this file.
(() => {
  // relay/src/protocol.js
  var ROLES = Object.freeze(["host", "guest"]);
  var RELAY_MESSAGE_TYPES = Object.freeze(["welcome", "peer", "error"]);
  var MAX_GUESTS = 4;
  var GUEST_ID_PATTERN = /^[a-z0-9]{8,32}$/;
  var CODE_ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz";
  var ROOM_CODE_LENGTH = 16;
  var randomBytes = (length) => crypto.getRandomValues(new Uint8Array(length));
  var toCode = (bytes) => Array.from(bytes, (byte) => CODE_ALPHABET[byte & 31]).join("");
  function createRoomCode(random = randomBytes) {
    return toCode(random(ROOM_CODE_LENGTH)).match(/.{4}/g).join("-");
  }
  function createGuestId(random = randomBytes) {
    return toCode(random(16));
  }
  function normalizeRoomCode(input) {
    if (typeof input !== "string") return null;
    let text = input.trim();
    try {
      text = new URL(text).searchParams.get("room") ?? "";
    } catch {
    }
    const compact = text.toLowerCase().replace(/[^0-9a-z]/g, "");
    if (compact.length !== ROOM_CODE_LENGTH || [...compact].some((c) => !CODE_ALPHABET.includes(c))) return null;
    return compact.match(/.{4}/g).join("-");
  }

  // src/engine/builds.js
  var BUILDS = {
    // Served at https://vel.gg/bo1z/ since 2026-10-14 (the release with vel.gg's own co-op), 9,902,179 bytes. Same
    // functions and struct layouts as the build below, moved around.
    "c025d5383791b8a3b4244713e6f3e75d958d550d3f6c83a49ac3928be2ccdb5c": {
      functions: {
        svFrame: [2963, "__wrap__Z8SV_Frameii"],
        netGetLoopPacket: [4119, "NET_GetLoopPacket(netsrc_t, netadr_t*, msg_t*)"],
        cbufAddText: [286, "Cbuf_AddText(int, char const*)"],
        svWaitServer: [1654, "SV_WaitServer()"],
        assertHandler: [170, "Assert_MyHandler(char const*, int, int, char const*, ...)"],
        cachedTagUpdate: [4410, "CachedTag_UpdateTagInternal(centity_s const*, cached_client_tag_t*, unsigned int, int, bool)"],
        comError: [179, "Com_Error(errorParm_t, char const*, ...)"],
        clCreateCmd: [6685, "CL_CreateCmd(usercmd_s*, int)"],
        cgScriptSndLengthNotify: [6720, "CG_ScriptSndLengthNotify(int, int)"]
      },
      bytePatches: [
        {
          fn: "clCreateCmd",
          find: "10 ef 06 41 07 46 0d 00 20 05 20 05 28 02 04 41 04 72 36 02 04",
          replace: "10 ef 06 41 07 46 0d 00 20 05 20 05 28 02 04 41 00 72 36 02 04"
        },
        {
          fn: "cgScriptSndLengthNotify",
          role: "guest",
          find: "41 e0 d1 8a c2 00 28 02 00 2d 00 18 41 01 46 04 40",
          replace: "41 e0 d1 8a c2 00 28 02 00 2d 00 18 41 02 46 04 40"
        }
      ],
      // The words after introState are taken by vel.gg's co-op in this build. Linear memory below 1024 (where static
      // data starts) is never used by emscripten, so the mailboxes live there.
      mailbox: { command: 1008, freeze: 1012, inboundRing: 1016 },
      loopback: { base: 139465312, stride: 20360, slots: 16, slotSize: 1272, dataMax: 1264, offLen: 1264, offPort: 1268, offGet: 20352, offSend: 20356 },
      reservedPorts: [0, 1, 1773],
      server: {
        allowNetPackets: 146181042,
        clientsPtr: 146047644,
        clientStride: 544120,
        clientState: 0,
        clientAddrType: 32,
        clientAddrPort: 40
      },
      client: {
        connectionState: 14090344,
        clcPtr: 44481588,
        serverAddressPort: 24,
        lastPacketTime: 12,
        codeTimeScale: 138586480
      },
      dvars: { comSvRunning: 138586336, svPaused: 138586324, clPaused: 138586328, comMaxClients: 138586176 },
      dvarValue: 24,
      introState: 151950108,
      loopbackAddressType: 2,
      fun: {
        entities: 91240528,
        entitySize: 760,
        ent: { client: 324, flags: 372, health: 404 },
        entFlags: { god: 1, demigod: 2, notarget: 4 },
        client: { ammoPools: 832, ammoClips: 952, ammoSlots: 15, speedScale: 10088, score: 10276, flags: 10396 },
        clientFlags: { noclip: 1, ufo: 2 },
        cheatsDvar: 90624216
      }
    },
    // Served at https://vel.gg/bo1z/ since 2026-10-04, 9,618,325 bytes.
    "61192df377020627f52fa7e9fd28047bd53662aa46e5e3cd6e7fad0c5c35cc98": {
      // Functions the patcher edits or calls. The name is checked against the wasm name section before touching
      // anything, so a wrong index fails loudly instead of corrupting the engine.
      functions: {
        svFrame: [3646, "__wrap__Z8SV_Frameii"],
        netGetLoopPacket: [4026, "NET_GetLoopPacket(netsrc_t, netadr_t*, msg_t*)"],
        cbufAddText: [291, "Cbuf_AddText(int, char const*)"],
        svWaitServer: [1391, "SV_WaitServer()"],
        assertHandler: [170, "Assert_MyHandler(char const*, int, int, char const*, ...)"],
        cachedTagUpdate: [4317, "CachedTag_UpdateTagInternal(centity_s const*, cached_client_tag_t*, unsigned int, int, bool)"],
        comError: [179, "Com_Error(errorParm_t, char const*, ...)"],
        clCreateCmd: [6552, "CL_CreateCmd(usercmd_s*, int)"],
        cgScriptSndLengthNotify: [6587, "CG_ScriptSndLengthNotify(int, int)"]
      },
      // Same-length byte edits, each required to match exactly once inside its function (hex, wasm opcodes).
      bytePatches: [
        {
          // With a menu or the chat open, the client flags its usercmds (button_bits[1] |= 4). Other players then draw
          // an "in a menu" marker over that player whose material zombies never loads, and crash in
          // Material_GetTechnique called from fx_drawCallback. Turning the `i32.const 4` into 0 keeps the flag off.
          fn: "clCreateCmd",
          find: "10 dc 06 41 07 46 0d 00 20 05 20 05 28 02 04 41 04 72 36 02 04",
          replace: "10 dc 06 41 07 46 0d 00 20 05 20 05 28 02 04 41 00 72 36 02 04"
        },
        {
          // Guests only. Script sounds report their length to the server with the reliable command "sl", meant to come
          // from the listen-server player alone (checked via com_sv_running == 1). A guest's own idle server still
          // counts as running, so guests sent it too; while the host waits in the lobby nothing acknowledges them and
          // the guest drops with EXE_ERR_CLIENT_CMD_OVERFLOW. Comparing with 2 instead makes the check always fail.
          fn: "cgScriptSndLengthNotify",
          role: "guest",
          find: "41 c8 f8 a9 c0 00 28 02 00 2d 00 18 41 01 46 04 40",
          replace: "41 c8 f8 a9 c0 00 28 02 00 2d 00 18 41 02 46 04 40"
        }
      ],
      // Three unused, zero-filled words in the engine's static data, used as mailboxes between the page and the engine
      // threads: a pending console command (char*), a "hold the local server" flag, and the extra inbound ring index.
      mailbox: { command: 148263172, freeze: 148263176, inboundRing: 148263180 },
      // The engine's two loopback queues (index 0: server to local client, 1: clients to server). Each holds 16 slots of
      // { data[1264], length, port } followed by its read and write counters. When the server sends to loopback port P
      // it writes into queue P without a bounds check, which is what lets extra queues live elsewhere in memory.
      loopback: { base: 135783616, stride: 20360, slots: 16, slotSize: 1272, dataMax: 1264, offLen: 1264, offPort: 1268, offGet: 20352, offSend: 20356 },
      // 0 and 1 are the engine's own queues; 1773 is a port the server treats specially in this build.
      reservedPorts: [0, 1, 1773],
      server: {
        allowNetPackets: 142494258,
        // u8: the server thread reads the inbound queue only while this is 1
        clientsPtr: 142360860,
        // client_t* svs.clients
        clientStride: 544120,
        clientState: 0,
        // i32: 0 free, 1 zombie, 2 reconnecting, 3 connected, 4 loading, 5 active
        clientAddrType: 32,
        // i32 netadr_t.type
        clientAddrPort: 40
        // u16 netadr_t.port
      },
      client: {
        connectionState: 13391960,
        // i32: 5 challenging ... 10 active
        clcPtr: 43783020,
        // clientConnection_t*
        serverAddressPort: 24,
        // u16, inside clientConnection_t
        lastPacketTime: 12,
        // i32, inside clientConnection_t; 0 disables the client's timeout check
        // f32 com_codeTimeScale: the game's slow motion, set by the "X" server command (game over slows it to 0.1).
        // Written as 1.0 by SP_TemporaryReloadMap, which only runs where the server is.
        codeTimeScale: 134905048
      },
      // Each entry points to a dvar_s whose current value sits at +dvarValue.
      dvars: { comSvRunning: 134904904, svPaused: 134904892, clPaused: 134904896, comMaxClients: 134904752 },
      dvarValue: 24,
      // vel.gg's page layer: 1 while the map waits behind the "click to start" screen.
      introState: 148263168,
      loopbackAddressType: 2,
      // NA_LOOPBACK
      // Fun mode panel. Read from this build's code and checked in a running game: g_entities and its stride
      // (Cmd_God_f / SV_GameSendServerCommand), gentity fields (ClientCommand's god/demigod/notarget toggles), gclient
      // fields (noclip/ufo toggles, ScrCmd_SetMoveSpeedScale, BG_GetAmmoPool / BG_GetAmmoClip), score (HUD-verified).
      fun: {
        entities: 87604176,
        entitySize: 760,
        ent: { client: 324, flags: 372, health: 404 },
        entFlags: { god: 1, demigod: 2, notarget: 4 },
        client: { ammoPools: 832, ammoClips: 952, ammoSlots: 15, speedScale: 10088, score: 10276, flags: 10396 },
        clientFlags: { noclip: 1, ufo: 2 },
        cheatsDvar: 86987848
        // g_cheats; the panel's console commands need it on (devmap maps have it on)
      }
    }
  };
  var CONNECTION = Object.freeze({ disconnected: 0, connecting: 4, challenging: 5, connected: 6, loading: 8, primed: 9, active: 10 });
  var SLOT = Object.freeze({ free: 0, zombie: 1, reconnecting: 2, connected: 3, loading: 4, active: 5 });

  // src/game/page.js
  var BASE = "/bo1z/";
  var MAP_SLUGS = {
    zombie_pentagon: "five",
    zombie_theater: "kino",
    zombie_cod5_factory: "riese",
    zombie_cod5_prototype: "nacht",
    zombie_cod5_asylum: "verruckt",
    zombie_cod5_sumpf: "shinonuma",
    zombie_cosmodrome: "ascension",
    zombie_coast: "cotd",
    zombie_temple: "shangrila",
    zombie_moon: "moon"
  };
  var MAP_NAMES = {
    five: "Five",
    kino: "Kino der Toten",
    riese: "Der Riese",
    nacht: "Nacht der Untoten",
    verruckt: "Verrückt",
    shinonuma: "Shi No Numa",
    ascension: "Ascension",
    cotd: "Call of the Dead",
    shangrila: "Shangri-La",
    moon: "Moon"
  };
  var screen = () => window.five?.screen;
  function currentZone() {
    const zone = document.documentElement?.dataset.map;
    if (zone) return zone;
    const slug = currentSlug();
    return Object.keys(MAP_SLUGS).find((z) => MAP_SLUGS[z] === slug) ?? null;
  }
  function currentSlug() {
    const zone = document.documentElement?.dataset.map;
    if (zone && MAP_SLUGS[zone]) return MAP_SLUGS[zone];
    const match = location.pathname.match(/^\/(?:bo1z\/)?([a-z]+)\/?$/);
    return match && Object.values(MAP_SLUGS).includes(match[1]) ? match[1] : null;
  }
  var currentHorde = () => document.documentElement?.dataset.mode === "horde" || new URLSearchParams(location.search).get("horde") === "1";
  var currentGuns = () => new URLSearchParams(location.search).get("guns") === "cs" ? "cs" : "classic";
  function keepSinglePlayer(room) {
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
      history[name] = function(state, title, url) {
        return original.call(this, state, title, url == null ? url : fix(String(url)));
      };
    }
    Object.defineProperty(globalThis, "__kisakMode", { configurable: true, get: () => "single", set() {
    } });
    const style = document.createElement("style");
    style.textContent = "#coop-mode-label { display: none !important; }";
    document.documentElement.append(style);
  }
  function latestView() {
    const view2 = window.five?.views?.at(-1);
    return view2 && Array.isArray(view2.origin) && view2.origin.length === 3 && view2.origin.every(Number.isFinite) ? view2 : null;
  }
  var go = (url) => location.assign(url);
  var GAME_SETTINGS = /^(fs_mods|horde_[a-z_]+|kisak_mod_[a-z_]+|r_mod_[a-z_]+|r_dobjLimit|cg_mod_[a-z_]+|zinfo|noperks)$/i;
  function devmapZone(args) {
    const i = args.indexOf("+devmap");
    return i >= 0 ? args[i + 1] : null;
  }
  function insertBeforeDevmap(args, extra) {
    const i = args.indexOf("+devmap");
    args.splice(i < 0 ? args.length : i, 0, ...extra);
  }
  function gameSettings(args) {
    const out = [];
    for (let i = 0; i + 2 < args.length; i += 1) if (args[i] === "+set" && GAME_SETTINGS.test(args[i + 1])) out.push([args[i + 1], args[i + 2]]);
    return out;
  }
  function applyGameSettings(args, settings) {
    for (let i = args.length - 3; i >= 0; i -= 1) if (args[i] === "+set" && GAME_SETTINGS.test(args[i + 1])) args.splice(i, 3);
    const safe = settings.filter(([k, v]) => typeof k === "string" && GAME_SETTINGS.test(k) && typeof v === "string" && /^[\w .-]{0,64}$/.test(v));
    insertBeforeDevmap(args, safe.flatMap(([k, v]) => ["+set", k, v]));
  }

  // src/input/gamepad.js
  var BUTTON = { cross: 0, circle: 1, square: 2, triangle: 3, l1: 4, r1: 5, l2: 6, r2: 7, share: 8, options: 9, l3: 10, r3: 11, up: 12, down: 13, left: 14, right: 15 };
  var HELD_ACTIONS = /* @__PURE__ */ new Map([
    [BUTTON.cross, "gostand"],
    // jump
    [BUTTON.square, "usereload"],
    // reload; hold to use, buy or revive
    [BUTTON.l1, "smoke"],
    // special grenade
    [BUTTON.r1, "frag"],
    // grenade
    [BUTTON.l2, "speed_throw"],
    // aim down sights
    [BUTTON.r2, "attack"],
    // fire
    [BUTTON.share, "scores"],
    [BUTTON.r3, "melee"]
  ]);
  var DPAD_SLOTS = /* @__PURE__ */ new Map([[BUTTON.up, 1], [BUTTON.down, 2], [BUTTON.left, 3], [BUTTON.right, 4]]);
  var KEY = { escape: 27, up: 154, down: 155, left: 156, right: 157, mouse1: 200 };
  var AXIS_KEY = { forward: 301, back: 302, moveleft: 303, moveright: 304 };
  var INPUT = { key: 0, mouseMove: 2, cursor: 4 };
  var MOVE_DEADZONE = 0.16;
  var LOOK_DEADZONE = 0.12;
  var TRIGGER_THRESHOLD = 0.35;
  var PRONE_HOLD_MS = 350;
  var MAX_COMMAND_LENGTH = 900;
  var AIM_SPEEDS = [400, 600, 800, 1e3, 1250, 1500, 1800, 2100, 2500, 3e3];
  var clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  function stick(pad, xAxis, yAxis, deadzone) {
    const x = pad.axes[xAxis] ?? 0;
    const y = pad.axes[yAxis] ?? 0;
    const magnitude = Math.hypot(x, y);
    if (magnitude < deadzone) return [0, 0];
    const scaled = Math.min(1, (magnitude - deadzone) / (1 - deadzone));
    return [x / magnitude * scaled, y / magnitude * scaled];
  }
  var Gamepad = class {
    /**
     * @param engine () => { Module, command(text) } while the player is in a game, otherwise null
     * @param canvasSize () => { width, height }
     */
    constructor({ engine, canvasSize, aimLevel = 4 }) {
      this.engine = engine;
      this.canvasSize = canvasSize;
      this.aimLevel = aimLevel;
      this.status = "none";
      this.name = "";
      this.previous = [];
      this.held = /* @__PURE__ */ new Set();
      this.movement = { forward: 0, back: 0, moveleft: 0, moveright: 0 };
      this.sprinting = false;
      this.circleDownAt = 0;
      this.wentProne = false;
      this.lookRemainder = [0, 0];
      this.cursor = null;
      this.commands = [];
      this.lastFrame = 0;
      this.running = false;
    }
    start() {
      if (this.running) return;
      this.running = true;
      const frame = (time) => {
        if (!this.running) return;
        try {
          this.update(time);
        } catch (error) {
          this.status = `error: ${error.message}`;
        }
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
      addEventListener("blur", () => this.releaseAll());
    }
    findPad() {
      const pads = [...navigator.getGamepads?.() ?? []].filter((pad) => pad?.connected);
      return pads.find((pad) => pad.mapping === "standard") ?? pads[0] ?? null;
    }
    update(time) {
      const dt = this.lastFrame ? Math.min(0.1, (time - this.lastFrame) / 1e3) : 0;
      this.lastFrame = time;
      const pad = this.findPad();
      if (!pad) {
        if (this.status !== "none") this.releaseAll();
        this.status = "none";
        return;
      }
      this.name = pad.id;
      const engine = this.engine();
      if (!engine) {
        this.status = "waiting";
        return;
      }
      this.status = "active";
      const down = pad.buttons.map((button, i) => i === BUTTON.l2 || i === BUTTON.r2 ? button.value > TRIGGER_THRESHOLD : button.pressed);
      const pressed = (i) => down[i] && !this.previous[i];
      const released = (i) => !down[i] && this.previous[i];
      if (engine.Module._KB_UIState?.() & 1) {
        this.releaseGameplay();
        this.menuInput(engine, pad, pressed, released, dt);
      } else {
        this.cursor = null;
        this.gameInput(engine, pad, down, pressed, released, dt);
      }
      this.previous = down;
      this.flush(engine);
    }
    gameInput(engine, pad, down, pressed, released, dt) {
      for (const [button, action] of HELD_ACTIONS) {
        if (pressed(button)) this.press(action);
        if (released(button)) this.release(action);
      }
      for (const [button, slot] of DPAD_SLOTS) {
        if (pressed(button)) this.commands.push(`+actionslot ${slot}`);
        if (released(button)) this.commands.push(`-actionslot ${slot}`);
      }
      if (pressed(BUTTON.triangle)) this.commands.push("weapnext");
      if (pressed(BUTTON.options)) this.tap(engine, KEY.escape);
      if (pressed(BUTTON.circle)) {
        this.circleDownAt = performance.now();
        this.wentProne = false;
      }
      if (down[BUTTON.circle] && !this.wentProne && performance.now() - this.circleDownAt > PRONE_HOLD_MS) {
        this.commands.push("toggleprone");
        this.wentProne = true;
      }
      if (released(BUTTON.circle) && !this.wentProne) this.commands.push("togglecrouch");
      const [mx, my] = stick(pad, 0, 1, MOVE_DEADZONE);
      this.setMovement("forward", Math.max(0, -my));
      this.setMovement("back", Math.max(0, my));
      this.setMovement("moveleft", Math.max(0, -mx));
      this.setMovement("moveright", Math.max(0, mx));
      if (pressed(BUTTON.l3) && !this.sprinting) {
        this.commands.push("+breath_sprint");
        this.sprinting = true;
      }
      if (this.sprinting && Math.hypot(mx, my) < 0.3) {
        this.commands.push("-breath_sprint");
        this.sprinting = false;
      }
      const [lx, ly] = stick(pad, 2, 3, LOOK_DEADZONE);
      const tilt = Math.hypot(lx, ly);
      if (tilt > 0) {
        const speed = AIM_SPEEDS[this.aimLevel] * tilt ** 1.6 / tilt * (down[BUTTON.l2] ? 0.5 : 1);
        this.lookRemainder[0] += lx * speed * dt;
        this.lookRemainder[1] += ly * speed * dt;
        const dx = Math.trunc(this.lookRemainder[0]);
        const dy = Math.trunc(this.lookRemainder[1]);
        this.lookRemainder[0] -= dx;
        this.lookRemainder[1] -= dy;
        if (dx || dy) engine.Module._KB_Input(INPUT.mouseMove, dx, dy);
      }
    }
    menuInput(engine, pad, pressed, released, dt) {
      const size = this.canvasSize();
      this.cursor ??= [size.width / 2, size.height / 2];
      const [ax, ay] = stick(pad, 0, 1, MOVE_DEADZONE);
      const [bx, by] = stick(pad, 2, 3, LOOK_DEADZONE);
      const vx = ax || bx;
      const vy = ay || by;
      if (vx || vy) {
        const speed = size.height * 1.1;
        this.cursor[0] = clamp(this.cursor[0] + vx * speed * dt, 0, size.width - 1);
        this.cursor[1] = clamp(this.cursor[1] + vy * speed * dt, 0, size.height - 1);
        engine.Module._KB_Input(INPUT.cursor, Math.round(this.cursor[0]), Math.round(this.cursor[1]));
      }
      if (pressed(BUTTON.cross)) engine.Module._KB_Input(INPUT.key, KEY.mouse1, 1);
      if (released(BUTTON.cross)) engine.Module._KB_Input(INPUT.key, KEY.mouse1, 0);
      if (pressed(BUTTON.circle) || pressed(BUTTON.options)) this.tap(engine, KEY.escape);
      for (const [button, key] of [[BUTTON.up, KEY.up], [BUTTON.down, KEY.down], [BUTTON.left, KEY.left], [BUTTON.right, KEY.right]]) {
        if (pressed(button)) this.tap(engine, key);
      }
    }
    press(action) {
      if (this.held.has(action)) return;
      this.held.add(action);
      this.commands.push(`+${action}`);
    }
    release(action) {
      if (this.held.delete(action)) this.commands.push(`-${action}`);
    }
    tap(engine, key) {
      engine.Module._KB_Input(INPUT.key, key, 1);
      engine.Module._KB_Input(INPUT.key, key, 0);
    }
    /** Analog movement: "+forward <key> 0 <amount>" with the amount rounded to 5% steps to limit traffic. */
    setMovement(direction, amount) {
      const rounded = Math.round(amount * 20) / 20;
      if (rounded === this.movement[direction]) return;
      this.movement[direction] = rounded;
      this.commands.push(rounded > 0 ? `+${direction} ${AXIS_KEY[direction]} 0 ${rounded}` : `-${direction} ${AXIS_KEY[direction]}`);
    }
    releaseGameplay() {
      for (const action of [...this.held]) this.release(action);
      for (const direction of Object.keys(this.movement)) this.setMovement(direction, 0);
      if (this.sprinting) {
        this.commands.push("-breath_sprint");
        this.sprinting = false;
      }
    }
    releaseAll() {
      this.releaseGameplay();
      this.previous = [];
      const engine = this.engine();
      if (engine) this.flush(engine);
    }
    /** Sends queued commands as one ";"-joined line per frame; kept for later while the previous line is pending. */
    flush(engine) {
      if (!this.commands.length) return;
      if (this.commands.length > 200) this.commands.splice(0, this.commands.length - 200);
      let count = 0;
      let length = 0;
      while (count < this.commands.length && length + this.commands[count].length + 1 < MAX_COMMAND_LENGTH) length += this.commands[count++].length + 1;
      if (engine.command(this.commands.slice(0, count).join(";"))) this.commands.splice(0, count);
    }
  };

  // src/net/pump.js
  function startPump(session, onControl2) {
    const url = URL.createObjectURL(new Blob(['(() => {\n  // relay/src/protocol.js\n  var PROTOCOL_VERSION = 3;\n  var ROLES = Object.freeze(["host", "guest"]);\n  var RELAY_MESSAGE_TYPES = Object.freeze(["welcome", "peer", "error"]);\n  var MAX_GUESTS = 4;\n  var MAX_TEXT_BYTES = 4096;\n  var MAX_BINARY_BYTES = 65536;\n  var MAX_PACKET_BYTES = 1264;\n  function relaySocketUrl(relayBase, room, role, guestId) {\n    const url = new URL(relayBase);\n    url.protocol = url.protocol === "http:" || url.protocol === "ws:" ? "ws:" : "wss:";\n    url.pathname = `/v1/rooms/${encodeURIComponent(room)}`;\n    url.search = `?role=${role}&v=${PROTOCOL_VERSION}${role === "guest" ? `&id=${guestId}` : ""}`;\n    return url.toString();\n  }\n  var BATCH_VERSION = 1;\n  var KIND_PACKETS = 1;\n  var KIND_SEAT_PACKETS = 2;\n  function writeBatch(kind, items, seatOf, packetOf) {\n    const header = kind === KIND_SEAT_PACKETS ? 3 : 2;\n    let size = 4;\n    for (const item of items) size += header + packetOf(item).byteLength;\n    if (items.length > 65535 || size > MAX_BINARY_BYTES) throw new RangeError("packet batch too large");\n    const out = new Uint8Array(size);\n    const view = new DataView(out.buffer);\n    out[0] = BATCH_VERSION;\n    out[1] = kind;\n    view.setUint16(2, items.length, true);\n    let at = 4;\n    for (const item of items) {\n      const packet = packetOf(item);\n      if (packet.byteLength > MAX_PACKET_BYTES) throw new RangeError("packet too large");\n      if (kind === KIND_SEAT_PACKETS) out[at++] = seatOf(item);\n      view.setUint16(at, packet.byteLength, true);\n      out.set(packet, at + 2);\n      at += 2 + packet.byteLength;\n    }\n    return out;\n  }\n  function readBatch(kind, data) {\n    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);\n    if (bytes.byteLength < 4 || bytes[0] !== BATCH_VERSION || bytes[1] !== kind) return null;\n    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);\n    const count = view.getUint16(2, true);\n    const items = [];\n    let at = 4;\n    for (let i = 0; i < count; i += 1) {\n      let seat = 0;\n      if (kind === KIND_SEAT_PACKETS) {\n        if (at + 1 > bytes.byteLength) return null;\n        seat = bytes[at++];\n        if (seat < 1 || seat > MAX_GUESTS) return null;\n      }\n      if (at + 2 > bytes.byteLength) return null;\n      const length = view.getUint16(at, true);\n      at += 2;\n      if (length > MAX_PACKET_BYTES || at + length > bytes.byteLength) return null;\n      items.push({ seat, packet: bytes.subarray(at, at + length) });\n      at += length;\n    }\n    return at === bytes.byteLength ? items : null;\n  }\n  var encodePackets = (packets) => writeBatch(KIND_PACKETS, packets, null, (p) => p);\n  var decodePackets = (data) => readBatch(KIND_PACKETS, data)?.map((item) => item.packet) ?? null;\n  var encodeSeatPackets = (items) => writeBatch(KIND_SEAT_PACKETS, items, (i) => i.seat, (i) => i.packet);\n  var decodeSeatPackets = (data) => readBatch(KIND_SEAT_PACKETS, data);\n  function parseControl(text) {\n    if (typeof text !== "string" || text.length > MAX_TEXT_BYTES) return null;\n    let value;\n    try {\n      value = JSON.parse(text);\n    } catch {\n      return null;\n    }\n    const ok = value && typeof value === "object" && !Array.isArray(value) && typeof value.t === "string" && value.t.length <= 32;\n    return ok ? value : null;\n  }\n\n  // src/net/queues.js\n  var QueueReader = class {\n    constructor(buffer, loopback, base, { consume = false } = {}) {\n      this.i32 = new Int32Array(buffer);\n      this.u8 = new Uint8Array(buffer);\n      this.lb = loopback;\n      this.base = base;\n      this.readIndex = base + loopback.offGet >> 2;\n      this.writeIndex = base + loopback.offSend >> 2;\n      this.consume = consume;\n      this.cursor = Atomics.load(this.i32, this.writeIndex);\n      this.lost = 0;\n    }\n    /** Forgets everything written so far. */\n    skip() {\n      this.cursor = Atomics.load(this.i32, this.writeIndex);\n      if (this.consume) Atomics.store(this.i32, this.readIndex, this.cursor);\n    }\n    /** New packets since the last call. Slots the engine overwrote before we got to them count as lost. */\n    poll(out = []) {\n      const { slots, slotSize, offLen, dataMax } = this.lb;\n      let written = Atomics.load(this.i32, this.writeIndex);\n      if (written - this.cursor > slots - 1) {\n        this.lost += written - (slots - 1) - this.cursor;\n        this.cursor = written - (slots - 1);\n      }\n      while (this.cursor < written) {\n        const slot = this.base + (this.cursor & slots - 1) * slotSize;\n        const length = this.i32[slot + offLen >> 2];\n        const packet = length > 0 && length <= dataMax ? this.u8.slice(slot, slot + length) : null;\n        written = Atomics.load(this.i32, this.writeIndex);\n        if (written - this.cursor > slots - 1) this.lost += 1;\n        else if (packet) out.push(packet);\n        this.cursor += 1;\n      }\n      if (this.consume) Atomics.store(this.i32, this.readIndex, this.cursor);\n      return out;\n    }\n  };\n  var QueueWriter = class {\n    constructor(buffer, loopback, base) {\n      this.i32 = new Int32Array(buffer);\n      this.u8 = new Uint8Array(buffer);\n      this.lb = loopback;\n      this.base = base;\n      this.readIndex = base + loopback.offGet >> 2;\n      this.writeIndex = base + loopback.offSend >> 2;\n    }\n    hasRoom() {\n      return Atomics.load(this.i32, this.writeIndex) - Atomics.load(this.i32, this.readIndex) < this.lb.slots - 1;\n    }\n    /** False, without writing, when the engine has not caught up yet; the caller retries later. */\n    push(packet, port) {\n      const { slots, slotSize, offLen, offPort, dataMax } = this.lb;\n      if (packet.byteLength === 0 || packet.byteLength > dataMax) return true;\n      if (!this.hasRoom()) return false;\n      const written = Atomics.load(this.i32, this.writeIndex);\n      const slot = this.base + (written & slots - 1) * slotSize;\n      this.u8.set(packet, slot);\n      Atomics.store(this.i32, slot + offLen >> 2, packet.byteLength);\n      Atomics.store(this.i32, slot + offPort >> 2, port);\n      Atomics.add(this.i32, this.writeIndex, 1);\n      return true;\n    }\n  };\n  function connectionlessCommand(packet) {\n    if (packet.byteLength < 5 || packet[0] !== 255 || packet[1] !== 255 || packet[2] !== 255 || packet[3] !== 255) return null;\n    let end = 4;\n    while (end < packet.byteLength && end < 64 && packet[end] !== 0 && packet[end] !== 32 && packet[end] !== 10) end += 1;\n    return String.fromCharCode(...packet.subarray(4, end));\n  }\n\n  // src/net/pump-worker.js\n  var POLL_MS = 1;\n  var FLUSH_MS = 4;\n  var INBOX_LIMIT = 512;\n  var PING_MS = 2e3;\n  var state = {\n    role: null,\n    url: null,\n    socket: null,\n    closed: false,\n    retries: 0,\n    readers: [],\n    writer: null,\n    ports: {},\n    reading: false,\n    injecting: false,\n    dropUntilConnect: false,\n    dropCommands: [],\n    inbox: [],\n    outbox: [],\n    lastFlush: 0,\n    looping: false,\n    stats: { packetsOut: 0, packetsIn: 0, bytesOut: 0, bytesIn: 0, framesOut: 0, framesIn: 0, dropped: 0, lost: 0, rtt: null, rtts: {} }\n  };\n  var hosting = () => state.role === "host";\n  var post = (message) => self.postMessage(message);\n  self.onmessage = ({ data: message }) => {\n    switch (message.type) {\n      case "connect":\n        state.role = message.role;\n        state.url = relaySocketUrl(message.relay, message.room, message.role, message.guestId);\n        open();\n        loop();\n        break;\n      case "attach":\n        state.readers = message.reads.map(({ seat, base }) => ({ seat, queue: new QueueReader(message.buffer, message.loopback, base, { consume: true }) }));\n        state.writer = new QueueWriter(message.buffer, message.loopback, message.writeBase);\n        state.ports = message.ports;\n        state.reading = Boolean(message.reading);\n        state.injecting = Boolean(message.injecting);\n        state.dropCommands = message.dropCommands ?? [];\n        break;\n      case "read":\n        for (const { queue } of state.readers) queue.skip();\n        state.dropUntilConnect = Boolean(message.dropUntilConnect);\n        state.reading = true;\n        break;\n      case "inject":\n        state.injecting = Boolean(message.on);\n        if (message.clearInbox) state.inbox.length = 0;\n        break;\n      case "send":\n        sendText(message.message);\n        break;\n      case "close":\n        state.closed = true;\n        try {\n          state.socket?.close(1e3, "bye");\n        } catch {\n        }\n        break;\n    }\n  };\n  function open() {\n    if (state.closed) return;\n    let socket;\n    try {\n      socket = new WebSocket(state.url);\n    } catch (error) {\n      post({ type: "socket", state: "error", reason: String(error?.message ?? error) });\n      retry();\n      return;\n    }\n    socket.binaryType = "arraybuffer";\n    state.socket = socket;\n    post({ type: "socket", state: "connecting" });\n    socket.onopen = () => {\n      state.retries = 0;\n      post({ type: "socket", state: "open" });\n    };\n    socket.onmessage = ({ data }) => typeof data === "string" ? onText(data) : onBinary(data);\n    socket.onclose = (event) => {\n      if (state.socket === socket) state.socket = null;\n      post({ type: "socket", state: "closed", code: event.code, reason: event.reason });\n      if (event.code === 4001 || event.code === 4004) state.closed = true;\n      else if (event.code === 4005) setTimeout(open, 6e4);\n      else retry();\n    };\n    socket.onerror = () => {\n    };\n  }\n  function retry() {\n    if (state.closed) return;\n    setTimeout(open, Math.min(5e3, 250 * 2 ** state.retries));\n    state.retries += 1;\n  }\n  function onBinary(data) {\n    const items = hosting() ? decodeSeatPackets(data) : decodePackets(data)?.map((packet) => ({ seat: 0, packet }));\n    if (!items) return;\n    state.stats.framesIn += 1;\n    for (const item of items) {\n      state.stats.packetsIn += 1;\n      state.stats.bytesIn += item.packet.byteLength;\n      const command = connectionlessCommand(item.packet);\n      if (command && state.dropCommands.includes(command)) continue;\n      state.inbox.push(item);\n    }\n    if (state.inbox.length > INBOX_LIMIT) {\n      state.stats.dropped += state.inbox.length - INBOX_LIMIT;\n      state.inbox.splice(0, state.inbox.length - INBOX_LIMIT);\n    }\n    pump();\n  }\n  function onText(text) {\n    const message = parseControl(text);\n    if (!message) return;\n    if (message.t === "ping") {\n      sendText(hosting() ? { t: "pong", ts: message.ts, to: message.from } : { t: "pong", ts: message.ts });\n    } else if (message.t === "pong") {\n      if (typeof message.ts !== "number") return;\n      const rtt = Math.max(0, performance.now() - message.ts);\n      if (hosting()) {\n        if (Number.isInteger(message.from)) state.stats.rtts[message.from] = rtt;\n        state.stats.rtt = Math.max(0, ...Object.values(state.stats.rtts));\n      } else {\n        state.stats.rtt = rtt;\n      }\n    } else {\n      post({ type: "control", message });\n    }\n  }\n  function sendText(message) {\n    if (state.socket?.readyState !== WebSocket.OPEN) return false;\n    state.socket.send(JSON.stringify(message));\n    return true;\n  }\n  function flush(now) {\n    if (!state.outbox.length) return;\n    const socket = state.socket;\n    if (socket?.readyState !== WebSocket.OPEN) {\n      state.stats.dropped += state.outbox.length;\n    } else {\n      const seats = hosting();\n      const perPacket = seats ? 3 : 2;\n      let batch = [];\n      let size = 4;\n      const send = () => {\n        if (!batch.length) return;\n        socket.send(seats ? encodeSeatPackets(batch) : encodePackets(batch.map((item) => item.packet)));\n        state.stats.framesOut += 1;\n        batch = [];\n        size = 4;\n      };\n      for (const item of state.outbox) {\n        const bytes = perPacket + item.packet.byteLength;\n        if (size + bytes > MAX_BINARY_BYTES) send();\n        batch.push(item);\n        size += bytes;\n        state.stats.packetsOut += 1;\n        state.stats.bytesOut += item.packet.byteLength;\n      }\n      send();\n    }\n    state.outbox.length = 0;\n    state.lastFlush = now;\n  }\n  function pump() {\n    const now = performance.now();\n    if (state.reading) {\n      let lost = 0;\n      for (const { seat, queue } of state.readers) {\n        let packets = queue.poll([]);\n        lost += queue.lost;\n        if (state.dropUntilConnect && packets.length) {\n          const first = packets.findIndex((packet) => connectionlessCommand(packet) === "connect");\n          packets = first < 0 ? [] : packets.slice(first);\n          if (first >= 0) state.dropUntilConnect = false;\n        }\n        for (const packet of packets) state.outbox.push({ seat, packet });\n      }\n      state.stats.lost = lost;\n    }\n    if (state.outbox.length && now - state.lastFlush >= FLUSH_MS) flush(now);\n    if (state.writer && state.injecting) {\n      while (state.inbox.length && state.writer.push(state.inbox[0].packet, state.ports[state.inbox[0].seat] ?? 0)) state.inbox.shift();\n    }\n  }\n  async function loop() {\n    if (state.looping) return;\n    state.looping = true;\n    const tick = new Int32Array(new SharedArrayBuffer(4));\n    let lastPing = 0;\n    let lastStats = 0;\n    while (!state.closed) {\n      pump();\n      const now = performance.now();\n      if (now - lastPing >= PING_MS) {\n        lastPing = now;\n        sendText({ t: "ping", ts: now });\n      }\n      if (now - lastStats >= 1e3) {\n        lastStats = now;\n        post({ type: "stats", stats: { ...state.stats, rtts: { ...state.stats.rtts }, inbox: state.inbox.length } });\n      }\n      const wait = Atomics.waitAsync ? Atomics.waitAsync(tick, 0, 0, POLL_MS) : null;\n      if (wait?.async) await wait.value;\n      else await new Promise((resolve) => setTimeout(resolve, POLL_MS));\n    }\n  }\n})();\n'], { type: "text/javascript" }));
    const worker = new Worker(url, { name: "bo1-coop-pump" });
    worker.onmessage = ({ data: message }) => {
      if (message.type === "socket") session.onSocket(message);
      else if (message.type === "control") onControl2(session, message.message);
      else if (message.type === "stats") session.stats = message.stats;
    };
    worker.onerror = (event) => session.fail("workerFailed", event.message);
    worker.postMessage({ type: "connect", relay: session.relay, room: session.room, role: session.mode, guestId: session.guestId });
    return worker;
  }
  function send(session, message) {
    session.pump?.postMessage({ type: "send", message });
  }

  // src/engine/memory.js
  var NORMAL_SPEED = 0.999;
  var EngineMemory = class {
    constructor(Module, build) {
      this.Module = Module;
      this.build = build;
      this.buffer = Module.HEAPF32.buffer;
      this.i32 = new Int32Array(this.buffer);
      this.u16 = new Uint16Array(this.buffer);
      this.u8 = new Uint8Array(this.buffer);
      this.commandBuffer = 0;
    }
    int(address) {
      return Atomics.load(this.i32, address >> 2);
    }
    setInt(address, value) {
      Atomics.store(this.i32, address >> 2, value);
    }
    byte(address) {
      return Atomics.load(this.u8, address);
    }
    /** Current integer value of a known dvar, or null before the engine registered it. */
    dvar(name) {
      const dvar = this.int(this.build.dvars[name]);
      return dvar ? this.int(dvar + this.build.dvarValue) : null;
    }
    setDvar(name, value) {
      const dvar = this.int(this.build.dvars[name]);
      if (dvar) this.setInt(dvar + this.build.dvarValue, value);
      return Boolean(dvar);
    }
    /** The mailboxes must start empty; anything else means this is not the memory layout we expect. */
    mailboxesIdle() {
      const { command, freeze, inboundRing } = this.build.mailbox;
      return this.int(command) === 0 && this.int(freeze) === 0 && this.int(inboundRing) === 0;
    }
    /** Hands a console command to the server thread. False while the previous command has not been picked up yet. */
    command(text) {
      const { command } = this.build.mailbox;
      if (this.int(command) !== 0) return false;
      const bytes = new TextEncoder().encode(`${text}
`);
      if (bytes.length >= 1024) throw new RangeError("command too long");
      if (!this.commandBuffer) this.commandBuffer = this.Module._malloc(1024);
      this.u8.set(bytes, this.commandBuffer);
      this.u8[this.commandBuffer + bytes.length] = 0;
      return Atomics.compareExchange(this.i32, command >> 2, 0, this.commandBuffer) === 0;
    }
    /** While held, this engine's own server skips its frames (a guest plays on the host's server instead). */
    holdServer(on) {
      this.setInt(this.build.mailbox.freeze, on ? 1 : 0);
    }
    serverReadsPackets() {
      return this.byte(this.build.server.allowNetPackets) === 1;
    }
    connectionState() {
      return this.int(this.build.client.connectionState);
    }
    clientConnection() {
      return this.int(this.build.client.clcPtr);
    }
    /** Makes the local client talk to loopback `port`; a guest uses 0, where the host's packets get injected. */
    pointClientAt(port) {
      const clc = this.clientConnection();
      if (!clc) return false;
      Atomics.store(this.u16, clc + this.build.client.serverAddressPort >> 1, port);
      return true;
    }
    clientServerPort() {
      const clc = this.clientConnection();
      return clc ? Atomics.load(this.u16, clc + this.build.client.serverAddressPort >> 1) : null;
    }
    /** Resets the client's "last packet" clock; while it reads 0 the engine never declares the server timed out. */
    keepClientAlive() {
      const clc = this.clientConnection();
      if (clc) this.setInt(clc + this.build.client.lastPacketTime, 0);
    }
    /** The game's slow-motion factor (1 = normal speed). */
    codeTimeScale() {
      return new Float32Array(this.buffer, this.build.client.codeTimeScale, 1)[0];
    }
    setCodeTimeScale(value) {
      new Float32Array(this.buffer, this.build.client.codeTimeScale, 1)[0] = value;
    }
    /** True while a game menu (pause, options, ...) has the cursor. */
    menuOpen() {
      return Boolean(this.Module._KB_UIState?.() & 1);
    }
    /** Occupied server slots: [{ slot, state, loopback, port }]. */
    serverSlots() {
      const s = this.build.server;
      const clients = this.int(s.clientsPtr);
      const out = [];
      if (!clients) return out;
      const count = Math.min(this.dvar("comMaxClients") ?? 0, 64);
      for (let slot = 0; slot < count; slot += 1) {
        const base = clients + slot * s.clientStride;
        const state = this.int(base + s.clientState);
        if (state === SLOT.free) continue;
        out.push({
          slot,
          state,
          loopback: this.int(base + s.clientAddrType) === this.build.loopbackAddressType,
          port: Atomics.load(this.u16, base + s.clientAddrPort >> 1)
        });
      }
      return out;
    }
    /** Byte address of loopback queue `port` (it may lie outside the engine's two real queues). */
    queueAt(port) {
      const lb = this.build.loopback;
      return lb.base + port * lb.stride;
    }
    /**
     * Host only. Allocates one block holding `guests + 1` extra loopback queues and returns their ports: seat s sends
     * through port first + s - 1 (the server writes its packets for that guest there), and every guest's packets come
     * in through port first + guests. Since the server addresses queue P at base + P * stride, the first port is chosen
     * so all queues land inside the block. The block is never freed.
     */
    createGuestQueues(guests) {
      const lb = this.build.loopback;
      for (let attempt = 0; attempt < 4; attempt += 1) {
        const size = (guests + 2) * lb.stride + 64;
        const block = this.Module._malloc(size);
        if (!block) throw new Error("out of engine memory");
        this.u8.fill(0, block, block + size);
        const first = Math.ceil((block - lb.base) / lb.stride);
        const inbound = first + guests;
        const ports = Array.from({ length: guests }, (_, i) => first + i);
        const fits = this.queueAt(inbound + 1) <= block + size;
        const clash = [...ports, inbound].some((p) => this.build.reservedPorts.includes(p));
        if (first >= 2 && inbound <= 65535 && fits && !clash) {
          const seats = {};
          ports.forEach((port, i) => seats[i + 1] = { port, base: this.queueAt(port) });
          return { seats, inbound: { port: inbound, base: this.queueAt(inbound) } };
        }
      }
      throw new Error("could not place the guest queues in engine memory");
    }
    /** Tells the patched NET_GetLoopPacket which extra queue the server should read (0: none). */
    useInboundQueue(port) {
      this.setInt(this.build.mailbox.inboundRing, port);
    }
  };

  // src/ui/strings.js
  var LANG = /^pt\b/i.test(navigator.language ?? "") ? "pt" : "en";
  var STRINGS = {
    en: {
      tagline: "up to 4 players",
      chip: { solo: "Solo", hosting: "Hosting", joining: "Joining", lobby: "Lobby", ingame: "In game", paused: "Paused", offline: "Offline", error: "Error", ended: "Disconnected" },
      intro: "Play zombies with up to 3 friends. One player hosts, the others join with the invite link. Everyone needs this extension.",
      host: "Host a game",
      joinLabel: "Join a friend",
      joinPlaceholder: "Room code or invite link",
      join: "Join",
      room: "Room",
      inviteAside: (n) => `${n} free seat${n === 1 ? "" : "s"}`,
      copy: "Copy link",
      copyCode: "Copy code",
      copied: "Copied!",
      players: "Lobby",
      playersAside: (n, max) => `${n}/${max} connected`,
      freeHint: "Send someone the link",
      player: (n) => `Player ${n}`,
      you: "you",
      hostTag: "host",
      st: {
        free: "Free seat",
        left: "Left",
        reconnecting: "Reconnecting…",
        disconnected: "Disconnected · can rejoin",
        ingame: "In game",
        ready: "Ready",
        joining: "Joining…",
        turn: "Next in line",
        loading: "Loading the map…",
        picking: "Picking a map",
        lobby: "In the lobby",
        opening: "Opening the room…",
        away: "Not in the room"
      },
      map: "Map",
      noMap: "Not picked yet",
      mapSubHost: "Everyone follows you to this map",
      mapSubGuest: "Picked by the host",
      hell: "Hell mode",
      stepsGuest: ["Room", "Map", "Load", "Join", "Play"],
      stepsHost: ["Map", "Load", "Lobby", "Play"],
      pickMap: "Pick a map in the game menu. Everyone follows you to it.",
      gate: "Players are on the way. Your start waits for them, so everyone spawns together.",
      startNow: "Start now",
      allIn: "Everyone is in. Click the game to start.",
      latecomers: "Players who join after the start watch until the next round (the BO1 rule for latecomers).",
      pausedYou: "Paused. Everyone is paused too.",
      pausedBy: "Paused by another player.",
      waitingHost: "Waiting for the host…",
      hostPicking: "Waiting for the host to pick a map…",
      opening: (m) => `Opening ${m}…`,
      pressKey: "Press any key on the page to load the map.",
      loadingMap: "Loading the map…",
      hostLoading: "Waiting for the host to finish loading…",
      nextInLine: "Another player is joining. You are next.",
      connecting: "Connecting to the host…",
      joiningGame: "Joining the host's game…",
      waitingStart: "You are in. Waiting for the host to start.",
      clickToPlay: "You are in. Click the game to play.",
      lateJoin: "The host had already started: you watch until the next round, then spawn.",
      ended: "Disconnected from the host. You can rejoin while the host keeps playing.",
      failed: "Could not join. Try again.",
      rejoin: "Rejoin",
      goToHost: "Go to the host",
      leave: "Leave co-op",
      otherRelay: (h) => `This invite uses another relay (${h}). Switch to it to join.`,
      useRelay: "Use this relay",
      settings: "Settings",
      yourName: "Your name",
      namePlaceholder: "Shown in the lobby",
      save: "Save",
      connection: "Connection",
      relay: "Relay",
      relayState: { open: "Connected", connecting: "Connecting…", closed: "Reconnecting…", idle: "Starting…" },
      ping: "Ping",
      dropped: "Packets dropped",
      relayDefault: "Default relay",
      relayCustom: (h) => `Custom (${h})`,
      relayNote: "Free Cloudflare plan: a few hours of play a day, shared by everyone on this relay. For a group that plays often, create your own (5 minutes, free).",
      changeRelay: "Change relay",
      useDefault: "Use the default relay",
      cancel: "Cancel",
      relayEditNote: "Everyone must use the same relay. Your invite links carry it.",
      relayPlaceholder: "https://your-relay.workers.dev",
      usage: (p, t) => `Today: ${p}% of the free allowance used · resets at ${t}`,
      usedUp: (t) => `Today's allowance is used up · resets at ${t}`,
      controller: "Controller",
      ctrl: { off: "Off", unavailable: "Unavailable", press: "Press any button on it", later: (n) => `${n} · works in game`, active: (n, a, max) => `${n} · aim ${a}/${max}` },
      aimDown: "Aim −",
      aimUp: "Aim +",
      turnOff: "Turn off",
      turnOn: "Turn on",
      credits: "Game: vel.gg by MisaDev4 · Co-op: BO1 Zombies Co-op",
      notRoomCode: "That is not a room code. Paste the invite link or the 16-letter code.",
      notRelay: "That is not a relay address. It looks like https://something.workers.dev",
      controllerReload: "Reload the page to apply the controller setting.",
      engineUpdated: "vel.gg updated its game engine, and this version of the extension does not know it yet: co-op and the controller are off.",
      enginePatchFailed: (m) => `Could not prepare the engine (${m}): co-op and the controller are off.`,
      replaced: "This room was opened in another tab or window.",
      full: (n) => `This game is full (${n} players).`,
      workerFailed: (m) => `Co-op worker failed: ${m}`,
      unexpectedMemory: "Unexpected engine memory: co-op is off.",
      hostNoAnswer: "The host did not answer. Check that their game page is open, then reload.",
      versionMismatch: "You and the host have different versions of the game. Reload both pages.",
      hostPlaying: (m) => `The host is playing ${m}. Reload this page.`,
      connectFailed: "Could not start the connection to the host. Reload both pages.",
      notLetIn: "The host did not let us in. Reload both pages and try again.",
      hostLeft: "The host left the game.",
      updateAvailable: (v) => `Version ${v} is out. Updating takes about a minute.`,
      updateHow: "How to update",
      relayOverQuota: (t) => `This relay used up today's free allowance${t ? ` (it comes back at ${t})` : ""}. With your own relay, free and set up in 5 minutes, your group plays now.`,
      relayGuide: "Create my relay",
      relayPitch: "Co-op runs through a relay. The shared one is free but small: a few hours of play a day for everyone together, and it runs out when many people play. Your own relay is free too, takes 5 minutes to create, and is only for your group.",
      relayPitchHost: "You are on the shared relay, which can run out on busy days. With your own (free, 5 minutes) your group never waits.",
      relayHaveOne: "I already have one"
    },
    pt: {
      tagline: "até 4 jogadores",
      chip: { solo: "Solo", hosting: "Hospedando", joining: "Entrando", lobby: "Lobby", ingame: "Em jogo", paused: "Pausado", offline: "Offline", error: "Erro", ended: "Desconectado" },
      intro: "Jogue zombies com até 3 amigos. Um jogador hospeda e os outros entram pelo link de convite. Todos precisam desta extensão.",
      host: "Hospedar partida",
      joinLabel: "Entrar na partida de um amigo",
      joinPlaceholder: "Código da sala ou link",
      join: "Entrar",
      room: "Sala",
      inviteAside: (n) => `${n} vaga${n === 1 ? "" : "s"} livre${n === 1 ? "" : "s"}`,
      copy: "Copiar link",
      copyCode: "Copiar código",
      copied: "Copiado!",
      players: "Lobby",
      playersAside: (n, max) => `${n}/${max} conectados`,
      freeHint: "Mande o link para alguém",
      player: (n) => `Jogador ${n}`,
      you: "você",
      hostTag: "host",
      st: {
        free: "Vaga livre",
        left: "Saiu",
        reconnecting: "Reconectando…",
        disconnected: "Desconectou · pode voltar",
        ingame: "Em jogo",
        ready: "Pronto",
        joining: "Entrando…",
        turn: "Na fila para entrar",
        loading: "Carregando o mapa…",
        picking: "Escolhendo o mapa",
        lobby: "No lobby",
        opening: "Abrindo a sala…",
        away: "Fora da sala"
      },
      map: "Mapa",
      noMap: "Ainda não escolhido",
      mapSubHost: "Todos vão seguir você para este mapa",
      mapSubGuest: "Escolhido pelo host",
      hell: "Hell mode",
      stepsGuest: ["Sala", "Mapa", "Carregar", "Entrar", "Jogar"],
      stepsHost: ["Mapa", "Carregar", "Lobby", "Jogar"],
      pickMap: "Escolha um mapa no menu do jogo. Todos vão seguir você.",
      gate: "Tem jogadores a caminho. Seu início espera por eles, para todos nascerem juntos.",
      startNow: "Começar agora",
      allIn: "Todos entraram. Clique no jogo para começar.",
      latecomers: "Quem entrar depois do início assiste até a próxima rodada (regra do BO1 para quem chega atrasado).",
      pausedYou: "Pausado. Todos estão pausados também.",
      pausedBy: "Pausado por outro jogador.",
      waitingHost: "Esperando o host…",
      hostPicking: "Esperando o host escolher o mapa…",
      opening: (m) => `Abrindo ${m}…`,
      pressKey: "Aperte qualquer tecla na página para carregar o mapa.",
      loadingMap: "Carregando o mapa…",
      hostLoading: "Esperando o host terminar de carregar…",
      nextInLine: "Outro jogador está entrando. Você é o próximo.",
      connecting: "Conectando ao host…",
      joiningGame: "Entrando na partida do host…",
      waitingStart: "Você entrou. Esperando o host começar.",
      clickToPlay: "Você entrou. Clique no jogo para jogar.",
      lateJoin: "O host já tinha começado: você assiste até a próxima rodada e então nasce.",
      ended: "Desconectado do host. Você pode voltar enquanto o host continuar jogando.",
      failed: "Não deu para entrar. Tente de novo.",
      rejoin: "Voltar para a partida",
      goToHost: "Ir até o host",
      leave: "Sair do co-op",
      otherRelay: (h) => `Este convite usa outro relay (${h}). Troque para ele para entrar.`,
      useRelay: "Usar este relay",
      settings: "Configurações",
      yourName: "Seu nome",
      namePlaceholder: "Aparece no lobby",
      save: "Salvar",
      connection: "Conexão",
      relay: "Relay",
      relayState: { open: "Conectado", connecting: "Conectando…", closed: "Reconectando…", idle: "Iniciando…" },
      ping: "Ping",
      dropped: "Pacotes perdidos",
      relayDefault: "Relay padrão",
      relayCustom: (h) => `Personalizado (${h})`,
      relayNote: "Plano grátis da Cloudflare: algumas horas de jogo por dia, divididas por todos que usam este relay. Para um grupo que joga sempre, crie o seu (5 minutos, grátis).",
      changeRelay: "Trocar relay",
      useDefault: "Usar o relay padrão",
      cancel: "Cancelar",
      relayEditNote: "Todos precisam usar o mesmo relay. Seus links de convite já levam ele.",
      relayPlaceholder: "https://seu-relay.workers.dev",
      usage: (p, t) => `Hoje: ${p}% da cota grátis usada · renova às ${t}`,
      usedUp: (t) => `Cota de hoje esgotada · renova às ${t}`,
      controller: "Controle",
      ctrl: { off: "Desligado", unavailable: "Indisponível", press: "Aperte qualquer botão nele", later: (n) => `${n} · funciona no jogo`, active: (n, a, max) => `${n} · mira ${a}/${max}` },
      aimDown: "Mira −",
      aimUp: "Mira +",
      turnOff: "Desligar",
      turnOn: "Ligar",
      credits: "Jogo: vel.gg por MisaDev4 · Co-op: BO1 Zombies Co-op",
      notRoomCode: "Isso não é um código de sala. Cole o link de convite ou o código de 16 letras.",
      notRelay: "Isso não é um endereço de relay. Ele parece com https://algo.workers.dev",
      controllerReload: "Recarregue a página para aplicar a configuração do controle.",
      engineUpdated: "O vel.gg atualizou o motor do jogo e esta versão da extensão ainda não o conhece: co-op e controle desligados.",
      enginePatchFailed: (m) => `Não deu para preparar o motor do jogo (${m}): co-op e controle desligados.`,
      replaced: "Esta sala foi aberta em outra aba ou janela.",
      full: (n) => `Esta partida está cheia (${n} jogadores).`,
      workerFailed: (m) => `O worker do co-op falhou: ${m}`,
      unexpectedMemory: "Memória do motor inesperada: co-op desligado.",
      hostNoAnswer: "O host não respondeu. Confira se a página do jogo dele está aberta e recarregue.",
      versionMismatch: "Você e o host estão com versões diferentes do jogo. Recarreguem as duas páginas.",
      hostPlaying: (m) => `O host está jogando ${m}. Recarregue esta página.`,
      connectFailed: "Não deu para iniciar a conexão com o host. Recarreguem as duas páginas.",
      notLetIn: "O host não deixou entrar. Recarreguem as duas páginas e tentem de novo.",
      hostLeft: "O host saiu da partida.",
      updateAvailable: (v) => `Saiu a versão ${v}. Atualizar leva cerca de 1 minuto.`,
      updateHow: "Como atualizar",
      relayOverQuota: (t) => `Este relay usou toda a cota grátis de hoje${t ? ` (ela volta às ${t})` : ""}. Com o seu próprio relay, grátis e criado em 5 minutos, o seu grupo joga agora.`,
      relayGuide: "Criar meu relay",
      relayPitch: "O co-op passa por um relay. O compartilhado é grátis, mas pequeno: algumas horas de jogo por dia para todo mundo junto, e acaba quando muita gente joga. O seu próprio relay também é grátis, leva 5 minutos para criar e é só do seu grupo.",
      relayPitchHost: "Você está no relay compartilhado, que pode acabar nos dias cheios. Com o seu (grátis, 5 minutos) o seu grupo nunca espera.",
      relayHaveOne: "Já tenho um"
    }
  };
  var T = STRINGS[LANG];

  // src/util/settings.js
  var PREFIX = "bo1coop.";
  function readSetting(key, fallback) {
    try {
      return localStorage.getItem(PREFIX + key) ?? fallback;
    } catch {
      return fallback;
    }
  }
  function saveSetting(key, value) {
    try {
      if (value === "" || value == null) localStorage.removeItem(PREFIX + key);
      else localStorage.setItem(PREFIX + key, value);
    } catch {
    }
  }
  function guestIdFor(room) {
    const key = `${PREFIX}guest:${room}`;
    try {
      const saved = sessionStorage.getItem(key);
      if (saved && GUEST_ID_PATTERN.test(saved)) return saved;
      const id = createGuestId();
      sessionStorage.setItem(key, id);
      return id;
    } catch {
      return createGuestId();
    }
  }
  var cleanName = (text) => String(text ?? "").replace(/[^\p{L}\p{N} _.-]/gu, "").replace(/\s+/g, " ").trim().slice(0, 16);

  // src/util/relay.js
  var DEFAULT_RELAY = "https://bo1z-coop-4p-relay.allanlotta.workers.dev";
  function normalizeRelay(text) {
    try {
      const url = new URL(String(text).trim());
      if (url.protocol === "wss:") url.protocol = "https:";
      return url.protocol === "https:" && url.hostname.includes(".") ? url.origin : "";
    } catch {
      return "";
    }
  }
  function isLoopback(url) {
    try {
      return ["127.0.0.1", "localhost", "[::1]"].includes(new URL(url).hostname);
    } catch {
      return false;
    }
  }
  function pickRelay(override) {
    if (override && isLoopback(override)) return override;
    return normalizeRelay(readSetting("relay", "")) || DEFAULT_RELAY;
  }
  function inviteLink(session) {
    const relay = session.relay !== DEFAULT_RELAY && !session.relayParam ? `&relay=${encodeURIComponent(session.relay)}` : "";
    return `${location.origin}${BASE}?coop=join&coopRoom=${session.room}${session.relayParam}${relay}`;
  }

  // src/session/session.js
  var VERSION = "2.2.1";
  var AIM_LEVELS = 10;
  function createSession(search = location.search) {
    const params = new URLSearchParams(search);
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
      // network
      socket: "idle",
      pump: null,
      stats: null,
      usage: null,
      /** Host: some guest is in the room. Guest: the host is in the room. */
      peer: false,
      // host
      queues: null,
      guests: /* @__PURE__ */ new Map(),
      // seat -> what the host knows about that guest
      joinTurn: null,
      // the seat currently allowed to connect
      joinTurnAt: 0,
      gate: false,
      // the host's start waits for players on their way
      startAlone: false,
      // guest
      phase: "idle",
      guestId: null,
      seat: null,
      hostInfo: null,
      // map and settings, from the host
      hostState: null,
      // the host's view of this guest (ready, slot state, join turn)
      lobby: null,
      // the room as the host last described it
      hostPos: null,
      // card
      update: null,
      // { version, url } when a newer release is out
      overQuota: null,
      // { resetsAt } while the relay is out of its daily allowance
      error: null,
      notice: null,
      editRelay: false,
      showSettings: false,
      copiedLinkAt: 0,
      copiedCodeAt: 0,
      log: []
    };
    session.note = (text) => {
      session.log.push(`${(/* @__PURE__ */ new Date()).toISOString().slice(11, 23)} ${text}`);
      if (session.log.length > 200) session.log.shift();
    };
    session.fail = (key, ...args) => {
      const text = T[key];
      session.error = typeof text === "function" ? text(...args) : text ?? key;
    };
    session.onSocket = ({ state, code }) => {
      session.socket = state;
      if (state === "closed" && code === 4005) session.overQuota ??= { resetsAt: null };
      if (state !== "open") {
        session.peer = false;
        for (const guest2 of session.guests.values()) {
          if (guest2.present) guest2.leftAt = Date.now();
          guest2.present = false;
        }
      }
      if (state === "closed" && code === 4001) session.fail("replaced");
      if (state === "closed" && code === 4004) session.fail("full", MAX_GUESTS + 1);
      session.note(`relay ${state}${code ? ` ${code}` : ""}`);
    };
    return session;
  }
  var validSeat = (seat) => Number.isInteger(seat) && seat >= 1 && seat <= MAX_GUESTS;

  // src/session/messages.js
  function onControl(session, message) {
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
        if (Array.isArray(message.o) && message.o.length === 3 && message.o.every(Number.isFinite)) session.hostPos = { origin: message.o, at: Date.now() };
        break;
      case "error":
        session.note(`relay error ${message.code}`);
        if (message.code === "room_full") session.fail("full", MAX_GUESTS + 1);
        if (message.code === "over_quota") session.overQuota = { resetsAt: message.resetsAt ?? null };
        break;
    }
  }
  function guest(session, seat) {
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
    Object.assign(record, { present: true, state: null, pause: false, sent: {}, sentPause: void 0 });
    session.sentLobby = null;
    sendGameInfo(session, seat);
  }
  function guestLeft(session, seat) {
    const record = guest(session, seat);
    Object.assign(record, { present: false, leftAt: Date.now(), pause: false });
    session.note(`player ${seat + 1} left the room`);
  }
  function introduce(session) {
    send(session, { t: "state", phase: session.phase, v: VERSION, name: session.name });
    send(session, { t: "pause", on: Boolean(session.menuOpen) });
    session.sentPhase = session.phase;
    session.sentPhaseAt = Date.now();
  }
  function sendGameInfo(session, to) {
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
      ...to ? { to } : {}
    });
  }

  // src/session/guest.js
  var HOST_GONE_MS = 1e4;
  var STATE_REPEAT_MS = 2e3;
  var SPAWN_JUMP = 400;
  var NEAR_HOST = 300;
  var HOST_POS_MAX_AGE_MS = 6e3;
  var SPAWN_CHECK_MS = 2e3;
  var SPAWN_TRIES = 2;
  var EYE_HEIGHT = 62;
  var guestQport = (seat) => 1e3 + 1e4 * (seat - 1) + 1 + Math.floor(Math.random() * 9999);
  function followHostMap(session) {
    const info = session.hostInfo;
    if (!info?.slug || session.engine) return;
    const guns = info.guns === "cs" ? "cs" : "classic";
    if (currentSlug() === info.slug && currentHorde() === Boolean(info.horde) && currentGuns() === guns) return;
    session.phase = "following";
    go(`${BASE}${info.slug}?coop=join&coopRoom=${session.room}&mode=single&guns=${guns}${info.horde ? "&horde=1" : ""}${session.relayParam}`);
  }
  async function prepareGuest(session, Module, args) {
    const info = await until(() => session.hostInfo?.zone ? session.hostInfo : null, 3e4);
    if (!info) throw new Error("hostNoAnswer");
    if (info.hash && info.hash !== session.hash) throw new Error("versionMismatch");
    const zone = devmapZone(args);
    if (zone !== info.zone) throw new Error(`hostPlaying:${MAP_NAMES[info.slug] ?? info.zone}`);
    if (Array.isArray(info.gameArgs)) applyGameSettings(args, info.gameArgs);
    insertBeforeDevmap(args, ["+set", "kisak_web_coop", "1", "+set", "kisak_coop_players", "1"]);
    const engine = new EngineMemory(Module, session.build);
    if (!engine.mailboxesIdle()) throw new Error("unexpectedMemory");
    session.engine = engine;
    session.zone = zone;
    session.pump.postMessage({
      type: "attach",
      buffer: engine.buffer,
      loopback: session.build.loopback,
      reads: [{ seat: 0, base: engine.queueAt(1) }],
      // our client's outgoing packets, for the host
      writeBase: engine.queueAt(0),
      // the host's packets, for our client
      ports: { 0: 0 },
      reading: false,
      injecting: false
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
  function guestTick(session) {
    const screen2 = screen();
    const engine = session.engine;
    if (screen2 === "error" && !["ended", "failed"].includes(session.phase)) {
      session.phase = "ended";
      session.note("engine stopped");
    }
    if (engine && ["freezing", "connect"].includes(session.phase)) engine.keepClientAlive();
    if (engine && ["challenging", "joining"].includes(session.phase)) {
      if (engine.dvar("clPaused")) engine.setDvar("clPaused", 0);
      if (engine.dvar("svPaused")) engine.setDvar("svPaused", 0);
    }
    if (session.peer && (session.phase !== session.sentPhase || Date.now() - (session.sentPhaseAt ?? 0) > STATE_REPEAT_MS)) introduce(session);
    if (!session.peer) session.sentPhase = null;
    const step2 = STEPS[session.phase];
    if (step2) step2(session, engine, screen2);
  }
  var STEPS = {
    loading(session, engine, screen2) {
      if (screen2 === "ready" || screen2 === "playing") session.phase = "waiting-host";
    },
    "waiting-host"(session, engine) {
      if (session.peer && session.hostState?.ready && session.hostState.turn && validSeat(session.seat)) {
        engine.holdServer(true);
        session.heldAt = Date.now();
        session.phase = "freezing";
        session.note("parking the local server");
      }
    },
    freezing(session, engine) {
      if (engine.serverReadsPackets() && Date.now() - session.heldAt <= 5e3) return;
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
      session.connectWaitAt ??= Date.now();
      if ((session.hostState?.slot ?? 0) >= SLOT.connected && Date.now() - session.connectWaitAt < 2e4) return;
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
      } else if (Date.now() - session.connectAt > 15e3) {
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
      } else if (Date.now() - session.connectAt > 9e4) {
        session.fail("notLetIn");
        session.phase = "failed";
      }
    },
    connected(session, engine, screen2) {
      if (engine.connectionState() < CONNECTION.challenging) {
        session.phase = "ended";
        session.note("disconnected");
      } else if (!session.peer && session.hostLeftAt && Date.now() - session.hostLeftAt > HOST_GONE_MS) {
        session.phase = "ended";
        session.fail("hostLeft");
        engine.command("disconnect");
      } else {
        syncGuestPause(session, engine, screen2);
        if (session.hostState?.screen !== "playing") engine.keepClientAlive();
        stayNearHost(session);
        restoreSpeed(session, engine);
      }
    }
  };
  var SLOW_AFTER_HOST_MS = 1500;
  function restoreSpeed(session, engine) {
    if (!session.hostState?.normalSpeed || engine.codeTimeScale() >= NORMAL_SPEED) {
      session.slowSince = null;
      return;
    }
    session.slowSince ??= Date.now();
    if (Date.now() - session.slowSince < SLOW_AFTER_HOST_MS || !engine.command("set hud_missionFailed 0")) return;
    engine.setCodeTimeScale(1);
    session.slowSince = null;
    session.note("back to normal speed after the host's restart");
  }
  function syncGuestPause(session, engine, screen2) {
    const menuOpen = engine.menuOpen() && screen2 === "playing";
    if (menuOpen !== session.menuOpen) {
      session.menuOpen = menuOpen;
      if (session.peer) send(session, { t: "pause", on: menuOpen });
    }
    const paused = menuOpen || session.peer && Boolean(session.remotePause);
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
  var distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  function stayNearHost(session) {
    if (session.hostState?.screen !== "playing") return;
    const view2 = latestView();
    if (view2 && view2.ms !== session.lastViewMs) {
      const previous = session.lastViewOrigin;
      session.lastViewMs = view2.ms;
      session.lastViewOrigin = view2.origin;
      if (!previous || distance(previous, view2.origin) > SPAWN_JUMP) session.spawn ??= { tries: 0, sentAt: 0 };
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
  function moveToHost(session, why) {
    const engine = session.engine;
    const host = session.hostPos;
    if (!engine || session.phase !== "connected" || !host) return false;
    if (Date.now() - (session.movedAt ?? 0) < 1e3) return false;
    const target = [host.origin[0], host.origin[1], host.origin[2] + EYE_HEIGHT];
    if (!engine.command(`setviewpos ${target.map((v) => v.toFixed(1)).join(" ")}`)) return false;
    session.movedAt = Date.now();
    session.note(`moved next to the host (${why})`);
    return true;
  }

  // src/engine/wasm.js
  function encodeU32(value) {
    const out = [];
    let n = value >>> 0;
    do {
      let byte = n & 127;
      n >>>= 7;
      if (n) byte |= 128;
      out.push(byte);
    } while (n);
    return out;
  }
  function encodeI32(value) {
    const out = [];
    let n = value | 0;
    for (; ; ) {
      const byte = n & 127;
      n >>= 7;
      const last = n === 0 && !(byte & 64) || n === -1 && byte & 64;
      out.push(last ? byte : byte | 128);
      if (last) return out;
    }
  }
  function readU32(bytes, at) {
    let value = 0;
    let shift = 0;
    let byte;
    do {
      byte = bytes[at++];
      value |= (byte & 127) << shift;
      shift += 7;
    } while (byte & 128);
    return [value >>> 0, at];
  }
  function readI32(bytes, at) {
    let value = 0;
    let shift = 0;
    let byte;
    do {
      byte = bytes[at++];
      value |= (byte & 127) << shift;
      shift += 7;
    } while (byte & 128);
    if (shift < 32 && byte & 64) value |= -1 << shift;
    return [value, at];
  }
  var op = {
    unreachable: 0,
    if: [4, 64],
    end: 11,
    return: 15,
    drop: 26,
    i32Eq: 70,
    i32GeU: 79,
    i32Add: 106,
    i32Sub: 107,
    globalGet: 35,
    globalSet: 36,
    i32Load: [40, 2, 0],
    atomicLoad: [254, 16, 2, 0],
    atomicExchange: [254, 65, 2, 0],
    i32: (value) => [65, ...encodeI32(value)],
    call: (index) => [16, ...encodeU32(index)],
    get: (local) => [32, ...encodeU32(local)],
    set: (local) => [33, ...encodeU32(local)],
    tee: (local) => [34, ...encodeU32(local)]
  };
  var SECTION = { custom: 0, import: 2, code: 10 };
  function countFunctionImports(bytes, at) {
    let [count, p] = readU32(bytes, at);
    let functions = 0;
    const skipName = () => {
      const [length, next] = readU32(bytes, p);
      p = next + length;
    };
    const skipLimits = () => {
      const flags = bytes[p++];
      p = readU32(bytes, p)[1];
      if (flags & 1) p = readU32(bytes, p)[1];
    };
    for (let i = 0; i < count; i += 1) {
      skipName();
      skipName();
      const kind = bytes[p++];
      if (kind === 0) {
        functions += 1;
        p = readU32(bytes, p)[1];
      } else if (kind === 1) {
        p += 1;
        skipLimits();
      } else if (kind === 2) {
        skipLimits();
      } else if (kind === 3) {
        p += 2;
      } else if (kind === 4) {
        p += 1;
        p = readU32(bytes, p)[1];
      } else {
        throw new Error(`unknown import kind ${kind}`);
      }
    }
    return functions;
  }
  function readModule(bytes) {
    if (bytes[0] !== 0 || bytes[1] !== 97 || bytes[2] !== 115 || bytes[3] !== 109) throw new Error("not a wasm module");
    const sections = [];
    let importedFunctions = 0;
    let names = null;
    for (let at = 8; at < bytes.length; ) {
      const id = bytes[at];
      const [size, body] = readU32(bytes, at + 1);
      const section = { id, start: at, body, end: body + size };
      sections.push(section);
      if (id === SECTION.import) importedFunctions = countFunctionImports(bytes, body);
      if (id === SECTION.custom) {
        const [length, nameAt] = readU32(bytes, body);
        if (new TextDecoder().decode(bytes.subarray(nameAt, nameAt + length)) === "name") names = { at: nameAt + length, end: section.end };
      }
      at = section.end;
    }
    const code = sections.find((s) => s.id === SECTION.code);
    if (!code) throw new Error("no code section");
    return { sections, code, importedFunctions, names };
  }
  function functionNames(bytes, module, wanted) {
    const result = /* @__PURE__ */ new Map();
    if (!module.names) return result;
    const want = new Set(wanted);
    for (let at = module.names.at; at < module.names.end; ) {
      const kind = bytes[at++];
      const [size, body] = readU32(bytes, at);
      if (kind === 1) {
        let [count, p] = readU32(bytes, body);
        for (let i = 0; i < count && result.size < want.size; i += 1) {
          let index, length;
          [index, p] = readU32(bytes, p);
          [length, p] = readU32(bytes, p);
          if (want.has(index)) result.set(index, new TextDecoder().decode(bytes.subarray(p, p + length)));
          p += length;
        }
      }
      at = body + size;
    }
    return result;
  }
  function localsEnd(body, params, index) {
    let [groups, p] = readU32(body, 0);
    let next = params;
    let type = null;
    for (let g = 0; g < groups; g += 1) {
      let count;
      [count, p] = readU32(body, p);
      if (index >= next && index < next + count) type = body[p];
      next += count;
      p += 1;
    }
    return { at: p, type };
  }
  function rewriteFunctions(bytes, module, edits) {
    const { code } = module;
    let [count, at] = readU32(bytes, code.body);
    const parts2 = [Uint8Array.from(encodeU32(count))];
    let applied = 0;
    for (let i = 0; i < count; i += 1) {
      const [size, start2] = readU32(bytes, at);
      const end = start2 + size;
      const edit = edits.get(i);
      if (edit) {
        const body = edit(bytes.subarray(start2, end));
        parts2.push(Uint8Array.from(encodeU32(body.length)), body);
        applied += 1;
      } else {
        parts2.push(bytes.subarray(at, end));
      }
      at = end;
    }
    if (applied !== edits.size) throw new Error(`patched ${applied} of ${edits.size} functions`);
    const length = parts2.reduce((sum, part) => sum + part.length, 0);
    const header = Uint8Array.from([10, ...encodeU32(length)]);
    const out = new Uint8Array(code.start + header.length + length + (bytes.length - code.end));
    out.set(bytes.subarray(0, code.start), 0);
    let o = code.start;
    out.set(header, o);
    o += header.length;
    for (const part of parts2) {
      out.set(part, o);
      o += part.length;
    }
    out.set(bytes.subarray(code.end), o);
    return out;
  }
  var hex = (text) => text.trim().split(/\s+/).map((byte) => parseInt(byte, 16));
  async function sha256(bytes) {
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  }

  // src/engine/patch.js
  function serverFrameHook(build, scratch) {
    const { mailbox, functions } = build;
    return [
      ...op.i32(mailbox.command),
      ...op.i32(0),
      ...op.atomicExchange,
      ...op.tee(scratch),
      ...op.if,
      ...op.i32(0),
      ...op.get(scratch),
      ...op.call(functions.cbufAddText[0]),
      op.end,
      ...op.i32(0),
      ...op.set(scratch),
      ...op.i32(mailbox.freeze),
      ...op.atomicLoad,
      ...op.if,
      ...op.call(functions.svWaitServer[0]),
      ...op.get(0),
      op.return,
      op.end
    ];
  }
  function loopPacketHook(build, scratch) {
    const { mailbox, loopback } = build;
    const serverQueue = loopback.base + loopback.stride;
    return [
      ...op.get(0),
      ...op.i32(1),
      op.i32Eq,
      ...op.if,
      ...op.i32(mailbox.inboundRing),
      ...op.atomicLoad,
      ...op.tee(scratch),
      ...op.if,
      ...op.i32(serverQueue + loopback.offGet),
      ...op.i32Load,
      ...op.i32(serverQueue + loopback.offSend),
      ...op.i32Load,
      op.i32GeU,
      ...op.if,
      ...op.get(scratch),
      ...op.set(0),
      op.end,
      op.end,
      ...op.i32(0),
      ...op.set(scratch),
      op.end
    ];
  }
  var prepend = (code, params, scratch) => (body) => {
    const { at, type } = localsEnd(body, params, scratch);
    if (type !== 127) throw new Error(`local ${scratch} is not an i32`);
    const out = new Uint8Array(body.length + code.length);
    out.set(body.subarray(0, at), 0);
    out.set(code, at);
    out.set(body.subarray(at), at + code.length);
    return out;
  };
  var assertsContinue = (params) => (body) => {
    let [groups, p] = readU32(body, 0);
    for (let g = 0; g < groups; g += 1) p = readU32(body, p)[1] + 1;
    const expect = (ok, what) => {
      if (!ok) throw new Error(`assert handler: ${what}`);
    };
    expect(body[p] === op.globalGet, "no stack frame");
    const [stackPointer, a] = readU32(body, p + 1);
    expect(body[a] === 65, "no frame size");
    const [frameSize, b] = readI32(body, a + 1);
    expect(body[b] === op.i32Sub && body[b + 1] === 34, "unexpected prologue");
    const [frameLocal, c] = readU32(body, b + 2);
    expect(frameLocal >= params && body[c] === op.globalSet && readU32(body, c + 1)[0] === stackPointer, "unexpected prologue");
    const end = body.length;
    expect(body[end - 1] === op.end && body[end - 2] === op.unreachable, "does not end in unreachable");
    const epilogue = [...op.get(frameLocal), ...op.i32(frameSize), op.i32Add, op.globalSet, ...encodeU32(stackPointer), ...op.i32(1), op.return, op.end];
    const out = new Uint8Array(end - 2 + epilogue.length);
    out.set(body.subarray(0, end - 2), 0);
    out.set(epilogue, end - 2);
    return out;
  };
  var dropCalls = (callee, args, expected) => (body) => {
    const call = op.call(callee);
    if (call.length !== args) throw new Error("call and drops differ in size");
    const out = Uint8Array.from(body);
    let found = 0;
    for (let i = 0; i + call.length <= out.length; i += 1) {
      if (call.every((byte, k) => out[i + k] === byte)) {
        out.fill(op.drop, i, i + call.length);
        found += 1;
        i += call.length - 1;
      }
    }
    if (found !== expected) throw new Error(`found ${found} calls to replace, expected ${expected}`);
    return out;
  };
  var replaceOnce = ({ fn, find, replace }) => (body) => {
    const from = hex(find);
    const to = hex(replace);
    if (from.length !== to.length) throw new Error(`${fn}: replacement changes the length`);
    let at = -1;
    let found = 0;
    for (let i = 0; i + from.length <= body.length; i += 1) {
      if (from.every((byte, k) => body[i + k] === byte)) {
        at = i;
        found += 1;
      }
    }
    if (found !== 1) throw new Error(`${fn}: pattern found ${found} times, expected once`);
    const out = Uint8Array.from(body);
    out.set(to, at);
    return out;
  };
  function patchEngine(input, build, role = null) {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    const module = readModule(bytes);
    const { functions } = build;
    const names = functionNames(bytes, module, Object.values(functions).map(([index]) => index));
    for (const [index, name] of Object.values(functions)) {
      if (names.get(index) !== name) throw new Error(`function ${index} is ${names.get(index)}, expected ${name}`);
    }
    const slot = (key) => functions[key][0] - module.importedFunctions;
    const edits = /* @__PURE__ */ new Map([
      [slot("svFrame"), prepend(serverFrameHook(build, 1), 1, 1)],
      [slot("netGetLoopPacket"), prepend(loopPacketHook(build, 4), 3, 4)],
      [slot("assertHandler"), assertsContinue(4)],
      // Attaching effects and weapons to another player's model fails fatally if that model is not loaded yet, which
      // solo never runs into: leave the attachment as it was instead.
      [slot("cachedTagUpdate"), dropCalls(functions.comError[0], 3, 2)]
    ]);
    for (const patch of build.bytePatches) {
      if (!patch.role || patch.role === role) edits.set(slot(patch.fn), replaceOnce(patch));
    }
    return rewriteFunctions(bytes, module, edits);
  }

  // src/session/lobby.js
  var roundPing = (rtt) => Number.isFinite(rtt) ? Math.round(rtt) : null;
  var LEFT_VISIBLE_MS = 6e4;
  function hostRoster(session) {
    const screen2 = screen();
    const playing = screen2 === "playing";
    const [hostStatus, hostTone] = playing ? ["ingame", "ok"] : screen2 === "ready" ? ["lobby", "ok"] : session.engine || screen2 === "loading" || screen2 === "download" ? ["loading", "wait"] : ["picking", "wait"];
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
    if (!g || !g.present && !g.slot && (!g.leftAt || Date.now() - g.leftAt > LEFT_VISIBLE_MS)) return ["free", ""];
    if (!g.present) return g.slot ? ["reconnecting", "wait"] : ["left", "bad"];
    if (["ended", "failed"].includes(phase)) return ["disconnected", "bad"];
    if (g.slot?.state === SLOT.active) return playing ? ["ingame", "ok"] : ["ready", "ok"];
    if (session.joinTurn === seat || g.slot || CONNECTING.includes(phase)) return ["joining", "wait"];
    if (phase === "waiting-host" && session.engine) return ["turn", "wait"];
    if (phase === "joining-room" && !session.engine) return ["opening", "wait"];
    return ["loading", "wait"];
  }
  function broadcastLobby(session) {
    if (!session.peer) {
      session.sentLobby = null;
      return;
    }
    const lobby = hostRoster(session);
    const key = JSON.stringify(lobby);
    if (key === session.sentLobby && Date.now() - (session.sentLobbyAt ?? 0) <= 5e3) return;
    session.sentLobby = key;
    session.sentLobbyAt = Date.now();
    send(session, lobby);
  }
  function guestRoster(session) {
    let players = Array.isArray(session.lobby?.players) ? session.lobby.players.slice(0, MAX_GUESTS + 1) : [];
    if (!players.length) {
      players = [{ n: 1, name: "", host: true, status: session.peer ? "loading" : "away", tone: session.peer ? "wait" : "" }];
      for (let seat = 1; seat <= MAX_GUESTS; seat += 1) players.push({ n: seat + 1, name: "", status: "free", tone: "" });
    }
    if (!validSeat(session.seat)) return players;
    const [status, tone] = ownStatus(session);
    return players.map((p) => p.n === session.seat + 1 ? { ...p, name: session.name, ping: roundPing(session.stats?.rtt), status, tone } : p);
  }
  function ownStatus(session) {
    const phase = session.phase;
    if (phase === "connected") return session.lobby?.playing || session.hostState?.screen === "playing" ? ["ingame", "ok"] : ["ready", "ok"];
    if (["ended", "failed"].includes(phase)) return ["disconnected", "bad"];
    if (CONNECTING.includes(phase)) return ["joining", "wait"];
    if (phase === "waiting-host" && session.hostState?.ready && !session.hostState.turn) return ["turn", "wait"];
    return ["loading", "wait"];
  }

  // src/session/host.js
  var HOST_QPORT = 7;
  var CONNECTING = ["freezing", "connect", "challenging", "joining"];
  var JOIN_TURN_MS = 6e4;
  var STATE_REPEAT_MS2 = 2e3;
  var KICK_AFTER_LEFT_MS = 15e3;
  var KICK_SPACING_MS = 15e3;
  var MAX_KICKS = 4;
  var FIXED_CAMERA = 1024;
  function prepareHost(session, Module, args) {
    const engine = new EngineMemory(Module, session.build);
    if (!engine.mailboxesIdle()) throw new Error("unexpectedMemory");
    const queues = engine.createGuestQueues(MAX_GUESTS);
    engine.useInboundQueue(queues.inbound.port);
    session.engine = engine;
    session.queues = queues;
    insertBeforeDevmap(args, ["+setqport", String(HOST_QPORT)]);
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
      dropCommands: ["rcon"]
      // nobody but the host gets to run server commands
    });
    session.note(`guest queues: ${Object.values(ports).join(", ")}, inbound ${queues.inbound.port}`);
    if (session.peer) sendGameInfo(session);
  }
  function hostTick(session) {
    const screen2 = screen();
    const engine = session.engine;
    const now = Date.now();
    const ready = Boolean(engine) && (screen2 === "ready" || screen2 === "playing");
    if (ready && !session.maxClientsProbed) {
      session.maxClientsProbed = true;
      const text = `5P-PROBE comMaxClients=${engine.dvar("comMaxClients")}`;
      session.note(text);
      console.log(text);
    }
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
      const normalSpeed = !engine || engine.codeTimeScale() >= NORMAL_SPEED;
      const state = { t: "state", to: g.seat, ready, slot: g.slot?.state ?? 0, screen: screen2, turn: session.joinTurn === g.seat, normalSpeed };
      sendWhenChanged(session, g, "state", state, now);
    }
    session.gate = screen2 === "ready" && !session.startAlone && present.some((g) => !active(g) && !["ended", "failed"].includes(phase(g)));
    const joining = present.some((g) => ["waiting-host", ...CONNECTING].includes(phase(g)));
    if (engine && joining && screen2 === "ready" && !session.introReleased && engine.int(session.build.introState) === 1) {
      session.introReleased = true;
      engine.Module._KB_Input?.(7, 1, 0);
      session.note("released the start screen so players can connect");
    }
    coopWait(session, screen2 === "playing" ? 0 : 1);
    syncPause(session, present, active, phase, screen2);
    broadcastLobby(session);
    const view2 = latestView();
    if (present.some(active) && view2 && view2.ms !== session.sentViewMs && !(view2.flags & FIXED_CAMERA)) {
      session.sentViewMs = view2.ms;
      send(session, { t: "pos", o: view2.origin, a: view2.angles });
    }
    for (const g of all) kickIfStale(session, g, phase(g), now);
  }
  function coopWait(session, mask) {
    const wait = session.engine?.Module._KB_CoopWait;
    if (!wait || session.coopWaitMask === mask) return;
    wait(mask);
    session.coopWaitMask = mask;
    session.note(mask ? "level start held for the host's click" : "level start released");
  }
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
  function sendWhenChanged(session, g, kind, message, now) {
    const key = JSON.stringify(message);
    const last = g.sent[kind];
    if (last?.key === key && now - last.at <= STATE_REPEAT_MS2) return;
    g.sent[kind] = { key, at: now };
    send(session, message);
  }
  function syncPause(session, present, active, phase, screen2) {
    const engine = session.engine;
    const menuOpen = Boolean(engine?.menuOpen()) && screen2 === "playing";
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
  function kickIfStale(session, g, phase, now) {
    const slot = g.slot;
    const stale = slot && slot.state >= SLOT.connected && (g.present && phase && !["challenging", "joining", "connected"].includes(phase) || !g.present && g.leftAt && now - g.leftAt > KICK_AFTER_LEFT_MS);
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

  // src/session/hooks.js
  var ENGINE_URL = /\/artifacts\/KisakBlack-web\.wasm(\?|$)/;
  var ENGINE_MIN_BYTES = 5e6;
  function hookWasm(session) {
    const instantiate = WebAssembly.instantiate;
    const instantiateStreaming = WebAssembly.instantiateStreaming;
    const wanted = () => (session.mode || session.controller) && !session.hash;
    async function prepare(bytes) {
      session.hash = await sha256(bytes);
      session.build = BUILDS[session.hash] ?? null;
      if (!session.build) {
        session.fail("engineUpdated");
        session.note(`unknown engine ${session.hash}`);
        return bytes;
      }
      try {
        const patched = patchEngine(bytes, session.build, session.mode);
        session.patched = true;
        session.note("engine patched");
        return patched;
      } catch (error) {
        session.fail("enginePatchFailed", error.message);
        session.note(`patch failed: ${error.stack ?? error}`);
        return bytes;
      }
    }
    WebAssembly.instantiateStreaming = async function(source, imports) {
      if (!wanted()) return instantiateStreaming.call(WebAssembly, source, imports);
      const response = await source;
      if (!ENGINE_URL.test(response.url ?? "")) return instantiateStreaming.call(WebAssembly, response, imports);
      const bytes = new Uint8Array(await response.arrayBuffer());
      return instantiate.call(WebAssembly, await prepare(bytes), imports);
    };
    WebAssembly.instantiate = function(source, imports) {
      const bytes = source instanceof ArrayBuffer ? new Uint8Array(source) : ArrayBuffer.isView(source) ? new Uint8Array(source.buffer, source.byteOffset, source.byteLength) : null;
      if (wanted() && bytes && bytes.byteLength > ENGINE_MIN_BYTES) return prepare(bytes.slice()).then((ready) => instantiate.call(WebAssembly, ready, imports));
      return instantiate.call(WebAssembly, source, imports);
    };
  }
  function hookMain(session) {
    Object.defineProperty(Object.prototype, "callMain", {
      configurable: true,
      enumerable: false,
      set(original) {
        delete Object.prototype.callMain;
        const Module = this;
        Object.defineProperty(Module, "callMain", {
          configurable: true,
          enumerable: true,
          writable: true,
          value(args) {
            if (!session.mode && session.patched) session.engine = new EngineMemory(Module, session.build);
            if (!session.mode || !session.patched) return original.call(this, args);
            return (async () => {
              try {
                if (session.mode === "host") prepareHost(session, Module, args);
                else await prepareGuest(session, Module, args);
              } catch (error) {
                const [key, argument] = String(error.message).split(/:(.*)/s);
                if (T[key]) session.fail(key, argument);
                else session.error = error.message;
                session.note(`setup failed: ${error.stack ?? error}`);
                session.engine?.useInboundQueue(0);
              }
              return original.call(this, args);
            })();
          }
        });
      }
    });
  }
  function holdStart(session, card) {
    const block = (event) => {
      if (!session.gate || event.composedPath?.().includes(card)) return;
      event.stopImmediatePropagation();
      event.preventDefault();
    };
    for (const type of ["keydown", "keyup", "mousedown", "mouseup", "click", "pointerdown", "pointerup"]) window.addEventListener(type, block, true);
  }

  // src/ui/styles.js
  var STYLE = `
:host { all: initial; position: fixed; top: 12px; right: 12px; z-index: 2147483647; font: 13px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: var(--fg);
  --bg: #121110; --bg2: #1b1917; --bg3: #24211e; --line: #34302b; --fg: #ece6dc; --muted: #9d958a; --dim: #6f685f;
  --accent: #e2552f; --accent2: #f07a4f; --ok: #63d471; --wait: #f4c542; --bad: #ff6b5a; }
* { box-sizing: border-box; }
.card { width: 312px; max-height: calc(100vh - 24px); overflow: auto; background: var(--bg); border: 1px solid var(--line); border-radius: 10px;
  box-shadow: 0 12px 40px rgba(0,0,0,.55); scrollbar-width: thin; scrollbar-color: var(--line) transparent; }
.head { display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: linear-gradient(180deg, #1d1a17, var(--bg)); border-bottom: 1px solid var(--line); position: sticky; top: 0; z-index: 1; }
.mark { display: grid; grid-template-columns: 6px 6px; gap: 2px; flex: none; }
.mark i { width: 6px; height: 6px; border-radius: 1.5px; opacity: .9; }
.title { flex: 1; min-width: 0; }
.title b { display: block; font-size: 13px; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; }
.title span { display: block; font-size: 11px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.chip { flex: none; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 99px; background: var(--bg3); color: var(--muted); border: 1px solid var(--line); white-space: nowrap; }
.chip.ok { color: var(--ok); border-color: rgba(99,212,113,.35); background: rgba(99,212,113,.08); }
.chip.wait { color: var(--wait); border-color: rgba(244,197,66,.35); background: rgba(244,197,66,.08); }
.chip.bad { color: var(--bad); border-color: rgba(255,107,90,.4); background: rgba(255,107,90,.08); }
.chip.live::before { content: ""; display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: currentColor; margin-right: 5px; vertical-align: 1px; animation: pulse 1.6s ease-in-out infinite; }
@keyframes pulse { 50% { opacity: .25; } }
button.icon { all: unset; cursor: pointer; color: var(--muted); width: 22px; height: 22px; display: grid; place-items: center; border-radius: 5px; font-size: 15px; }
button.icon:hover { background: var(--bg3); color: var(--fg); }
.body { padding: 12px; display: grid; gap: 10px; }
:host(.collapsed) .body { display: none; }
:host(.collapsed) .head { border-bottom: 0; }
.muted { color: var(--muted); } .small { font-size: 12px; } .error { color: var(--bad); }
.label { font-size: 10.5px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--dim); margin-bottom: 6px; display: flex; justify-content: space-between; align-items: baseline; }
.label em { font-style: normal; letter-spacing: 0; text-transform: none; font-weight: 600; color: var(--muted); font-size: 11px; }
.panel { background: var(--bg2); border: 1px solid var(--line); border-radius: 8px; padding: 10px; }
.panel .code { font: 700 17px/1.2 ui-monospace, "SF Mono", Menlo, Consolas, monospace; letter-spacing: .05em; color: #fff; user-select: all; white-space: nowrap; margin-bottom: 9px; }
.map { display: flex; align-items: center; gap: 10px; }
.map .glyph { width: 34px; height: 34px; border-radius: 6px; flex: none; display: grid; place-items: center; background: radial-gradient(circle at 30% 30%, #3a2a22, #1a1411); border: 1px solid #4a3328; color: var(--accent2); font-weight: 900; font-size: 15px; }
.map .name { font-weight: 700; font-size: 14px; }
.map .sub { font-size: 11.5px; color: var(--muted); }
.tag { display: inline-block; font-size: 9.5px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; padding: 1px 5px; border-radius: 4px; vertical-align: 1px; margin-left: 5px; }
.tag.host { background: rgba(226,85,47,.18); color: var(--accent2); }
.tag.you { background: rgba(255,255,255,.1); color: var(--fg); }
.tag.hell { background: rgba(255,107,90,.15); color: var(--bad); }
.players { display: grid; gap: 6px; }
.player { display: flex; align-items: center; gap: 10px; padding: 7px 9px; border-radius: 7px; background: var(--bg3); border: 1px solid transparent; }
.player.me { border-color: var(--line); }
.player.empty { background: transparent; border: 1px dashed var(--line); }
.badge { width: 26px; height: 26px; border-radius: 50%; flex: none; display: grid; place-items: center; font-weight: 800; font-size: 12px; color: #111; position: relative; }
.player.empty .badge { background: transparent !important; color: var(--dim); box-shadow: inset 0 0 0 1.5px var(--line); }
.who { flex: 1; min-width: 0; }
.who .name { font-weight: 650; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.player.empty .who .name { color: var(--dim); font-weight: 500; }
.who .st { font-size: 11.5px; color: var(--muted); display: flex; align-items: center; gap: 5px; }
.dot { width: 7px; height: 7px; border-radius: 50%; background: var(--dim); flex: none; }
.dot.ok { background: var(--ok); } .dot.wait { background: var(--wait); animation: pulse 1.6s ease-in-out infinite; } .dot.bad { background: var(--bad); }
.ping { flex: none; text-align: right; font: 600 11px ui-monospace, Menlo, monospace; color: var(--muted); display: grid; justify-items: end; gap: 2px; }
.bars { display: flex; gap: 2px; align-items: flex-end; height: 10px; }
.bars i { width: 3px; border-radius: 1px; background: var(--line); }
.bars i:nth-child(1) { height: 4px; } .bars i:nth-child(2) { height: 7px; } .bars i:nth-child(3) { height: 10px; }
.bars.q3 i { background: var(--ok); } .bars.q2 i:nth-child(-n+2) { background: var(--wait); } .bars.q1 i:nth-child(1) { background: var(--bad); }
.steps { display: flex; align-items: flex-start; }
.step { flex: 1; display: grid; justify-items: center; gap: 4px; position: relative; font-size: 10.5px; color: var(--dim); text-align: center; }
.step::before { content: ""; position: absolute; top: 6px; left: -50%; width: 100%; height: 2px; background: var(--line); z-index: 0; }
.step:first-child::before { display: none; }
.step i { width: 14px; height: 14px; border-radius: 50%; background: var(--bg); border: 2px solid var(--line); z-index: 1; }
.step.done { color: var(--muted); } .step.done::before { background: var(--accent); } .step.done i { background: var(--accent); border-color: var(--accent); }
.step.now { color: var(--fg); font-weight: 700; } .step.now::before { background: var(--accent); } .step.now i { border-color: var(--accent2); box-shadow: 0 0 0 3px rgba(226,85,47,.25); }
.step.now.fail i { border-color: var(--bad); box-shadow: 0 0 0 3px rgba(255,107,90,.2); }
.call { border-radius: 8px; padding: 9px 10px; background: var(--bg2); border: 1px solid var(--line); border-left: 3px solid var(--muted); display: grid; gap: 8px; }
.call.info { border-left-color: #5aa8ff; } .call.ok { border-left-color: var(--ok); } .call.wait { border-left-color: var(--wait); } .call.bad { border-left-color: var(--bad); background: rgba(255,107,90,.06); }
.call b { font-weight: 700; }
.row { display: flex; gap: 6px; } .row > * { flex: 1; }
button.act { all: unset; box-sizing: border-box; text-align: center; cursor: pointer; padding: 8px 10px; border: 1px solid var(--line); border-radius: 7px; background: var(--bg3); color: var(--fg); font-weight: 650; font-size: 12.5px; transition: background .12s, border-color .12s; }
button.act:hover, button.act:focus-visible { background: #2e2a26; border-color: #4a443d; }
button.act.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
button.act.primary:hover { background: var(--accent2); border-color: var(--accent2); }
button.act.ghost { background: transparent; color: var(--muted); }
button.act.ghost:hover { color: var(--fg); }
button.act.done { background: rgba(99,212,113,.15); border-color: rgba(99,212,113,.4); color: var(--ok); }
button.act.slim { flex: 0 0 auto; padding: 6px 10px; }
button.act[disabled] { opacity: .5; cursor: default; }
input { all: unset; box-sizing: border-box; padding: 7px 9px; border: 1px solid var(--line); border-radius: 7px; background: #0c0b0a; color: var(--fg); font: 12.5px ui-monospace, Menlo, monospace; min-width: 0; flex: 1; }
input:focus { border-color: var(--accent); }
input::placeholder { color: var(--dim); }
.kv { display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; font-size: 12px; margin: 0; }
.kv dt { color: var(--muted); } .kv dd { margin: 0; text-align: right; }
.meter { height: 5px; border-radius: 3px; background: var(--bg3); overflow: hidden; margin-top: 5px; }
.meter > span { display: block; height: 100%; background: var(--ok); }
.meter.warn > span { background: var(--wait); } .meter.full > span { background: var(--bad); }
.section { border-top: 1px solid var(--line); padding-top: 10px; display: grid; gap: 10px; }
.section > button.toggle { all: unset; cursor: pointer; display: flex; justify-content: space-between; align-items: center; font-size: 10.5px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--dim); }
.section > button.toggle:hover { color: var(--muted); }
.section > button.toggle::after { content: "\\25BE"; font-size: 12px; transition: transform .15s; }
.section.closed > button.toggle::after { transform: rotate(-90deg); }
.credits { font-size: 11px; color: var(--dim); text-align: center; }
.chips { display: flex; flex-wrap: wrap; gap: 5px; }
button.tchip { all: unset; cursor: pointer; font-size: 11.5px; font-weight: 650; padding: 4px 9px; border-radius: 99px; border: 1px solid var(--line); background: var(--bg3); color: var(--muted); }
button.tchip:hover { color: var(--fg); border-color: #4a443d; }
button.tchip.on { background: rgba(226,85,47,.2); border-color: var(--accent); color: #fff; }
button.tchip.plain { border-style: dashed; }
.stepper { display: flex; align-items: center; gap: 6px; font-size: 12px; }
.stepper .flabel { flex: 1; }
.sval { min-width: 46px; text-align: center; font: 600 12px ui-monospace, Menlo, monospace; color: var(--fg); }
button.sbtn { all: unset; cursor: pointer; width: 24px; height: 22px; display: grid; place-items: center; border-radius: 6px; background: var(--bg3); border: 1px solid var(--line); color: var(--fg); font-weight: 700; }
button.sbtn:hover { border-color: var(--accent); }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; }
button.act.tiny { padding: 5px 6px; font-size: 11.5px; font-weight: 600; }
.fplayer { display: grid; gap: 7px; padding: 9px; border-radius: 8px; background: var(--bg2); border: 1px solid var(--line); }
.fhead { display: flex; align-items: center; gap: 8px; }
.fhead b { flex: 1; font-weight: 700; }
.fbadge { width: 20px; height: 20px; border-radius: 50%; display: grid; place-items: center; font-size: 11px; font-weight: 800; color: #111; flex: none; }
.fmoney { font: 600 12px ui-monospace, Menlo, monospace; color: var(--ok); }
.frow { display: flex; align-items: center; gap: 5px; }
.frow .flabel { flex: 1; font-size: 12px; }
.flabel { color: var(--muted); }
.pill { display: none; }
:host(.compact) .card { display: none; }
:host(.compact) .pill { display: flex; align-items: center; gap: 8px; pointer-events: none; background: rgba(12,11,10,.72); border: 1px solid rgba(255,255,255,.08); border-radius: 99px; padding: 4px 10px; font: 600 11.5px system-ui, sans-serif; color: #ddd; backdrop-filter: blur(4px); }
:host(.compact) .pill:empty { display: none; }
.pill .pd { width: 9px; height: 9px; border-radius: 50%; box-shadow: inset 0 0 0 1.5px currentColor; color: var(--dim); }
.pill .pd.on { background: currentColor; }
.pill .sep { width: 1px; height: 12px; background: rgba(255,255,255,.15); }
`;

  // src/ui/card.js
  var PLAYER_COLORS = ["#f2efe9", "#5aa8ff", "#f4c542", "#63d471", "#b48cff"];
  var Card = class {
    constructor(handlers) {
      this.handlers = handlers;
      this.host = document.createElement("bo1-coop-card");
      this.root = this.host.attachShadow({ mode: "closed" });
      const mark = PLAYER_COLORS.slice(0, 4).map((c) => `<i style="background:${c}"></i>`).join("");
      this.root.innerHTML = `<style>${STYLE}</style><div class="card"><div class="head"><span class="mark">${mark}</span><span class="title"><b>Co-op</b><span class="tagline"></span></span><span class="chip"></span><button class="icon" data-act="collapse" title="Minimise">–</button></div><div class="body"></div></div><div class="pill"></div>`;
      this.body = this.root.querySelector(".body");
      this.chip = this.root.querySelector(".chip");
      this.tagline = this.root.querySelector(".tagline");
      this.pill = this.root.querySelector(".pill");
      this.collapseButton = this.root.querySelector('[data-act="collapse"]');
      this.view = null;
      for (const type of ["keydown", "keyup", "keypress", "click", "mousedown", "mouseup", "pointerdown", "pointerup", "wheel"]) {
        this.host.addEventListener(type, (event) => event.stopPropagation());
      }
      this.root.addEventListener("click", (event) => {
        const button = event.target.closest?.("[data-act]");
        if (!button || button.disabled) return;
        const act = button.dataset.act;
        if (act === "collapse") {
          const collapsed = this.host.classList.toggle("collapsed");
          this.collapseButton.textContent = collapsed ? "+" : "–";
          return;
        }
        const field = button.dataset.field ? this.root.querySelector(`input[data-field="${button.dataset.field}"]`) : null;
        this.handlers[act]?.(field ? field.value : button.dataset.arg);
      });
      this.root.addEventListener("keydown", (event) => {
        const input = event.target.matches?.("input[data-act]") ? event.target : null;
        if (event.key === "Enter" && input) this.handlers[input.dataset.act]?.(input.value);
      });
    }
    mount() {
      const attach = () => {
        if (!this.host.isConnected) document.documentElement.append(this.host);
      };
      if (document.documentElement) attach();
      else document.addEventListener("readystatechange", attach, { once: true });
    }
    /** Re-renders only when the view changes, so typing in an input is never interrupted. */
    render(view2) {
      const key = JSON.stringify(view2);
      if (key === this.view) return;
      const focused = this.root.activeElement?.dataset?.field;
      const previous = new Map([...this.root.querySelectorAll("input[data-field]")].map((i) => [i.dataset.field, i.value]));
      this.view = key;
      this.chip.className = `chip ${view2.chip?.tone ?? ""}`;
      this.chip.textContent = view2.chip?.text ?? "";
      this.tagline.textContent = view2.tagline ?? "";
      this.host.classList.toggle("compact", Boolean(view2.compact));
      this.pill.replaceChildren(...this.pillParts(view2.pill));
      this.body.replaceChildren(...view2.blocks.map((block) => this.block(block)));
      for (const input of this.root.querySelectorAll("input[data-field]")) {
        if (previous.has(input.dataset.field)) input.value = previous.get(input.dataset.field);
        if (input.dataset.field === focused) input.focus();
      }
    }
    toggleChip(c) {
      const e = document.createElement("button");
      e.className = `tchip ${c.on ? "on" : ""} ${c.plain ? "plain" : ""}`;
      e.textContent = c.label;
      e.dataset.act = c.act;
      if (c.arg != null) e.dataset.arg = c.arg;
      return e;
    }
    stepper(s) {
      const box = document.createElement("div");
      box.className = "stepper";
      const label = document.createElement("span");
      label.className = "flabel";
      label.textContent = s.label;
      const value = document.createElement("span");
      value.className = "sval";
      value.textContent = s.value;
      const make = (b, text) => {
        const e = document.createElement("button");
        e.className = "sbtn";
        e.textContent = text;
        e.dataset.act = b.act;
        e.dataset.arg = b.arg;
        return e;
      };
      box.append(label, make(s.dec, "−"), value, make(s.inc, "+"));
      return box;
    }
    pillParts(pill) {
      if (!pill) return [];
      const parts2 = [];
      for (const p of pill.players ?? []) {
        const d = document.createElement("span");
        d.className = `pd ${p.on ? "on" : ""}`;
        d.style.color = PLAYER_COLORS[p.n - 1];
        parts2.push(d);
      }
      for (const text of pill.texts ?? []) {
        if (parts2.length) parts2.push(Object.assign(document.createElement("span"), { className: "sep" }));
        parts2.push(document.createTextNode(text));
      }
      return parts2;
    }
    block(block) {
      const el = (tag, cls, text) => {
        const e = document.createElement(tag);
        if (cls) e.className = cls;
        if (text != null) e.textContent = text;
        return e;
      };
      const button = (b) => {
        const e = el("button", `act ${b.style ?? ""}`, b.label);
        e.dataset.act = b.act;
        if (b.arg != null) e.dataset.arg = b.arg;
        if (b.field) e.dataset.field = b.field;
        if (b.disabled) e.disabled = true;
        return e;
      };
      switch (block.kind) {
        case "text":
          return el("div", block.cls ?? "", block.text);
        case "label": {
          const box = el("div", "label", block.text);
          if (block.aside) box.append(el("em", "", block.aside));
          return box;
        }
        case "room": {
          const box = el("div", "panel");
          const label = el("div", "label", block.label);
          if (block.aside) label.append(el("em", "", block.aside));
          box.append(label, el("div", "code", block.code));
          if (block.buttons?.length) {
            const row = el("div", "row");
            for (const b of block.buttons) row.append(button(b));
            box.append(row);
          }
          return box;
        }
        case "map": {
          const box = el("div", "map");
          box.append(el("div", "glyph", block.glyph ?? "?"));
          const info = el("div");
          const name = el("div", "name", block.name);
          if (block.tag) name.append(el("span", "tag hell", block.tag));
          info.append(name, el("div", "sub", block.sub ?? ""));
          box.append(info);
          return box;
        }
        case "players": {
          const box = el("div");
          const label = el("div", "label", block.label);
          if (block.aside) label.append(el("em", "", block.aside));
          const list = el("div", "players");
          for (const p of block.players) {
            const row = el("div", `player ${p.empty ? "empty" : ""} ${p.me ? "me" : ""}`);
            const badge = el("div", "badge", String(p.n));
            badge.style.background = PLAYER_COLORS[p.n - 1];
            const who = el("div", "who");
            const name = el("div", "name", p.name);
            for (const t of p.tags ?? []) name.append(el("span", `tag ${t.cls}`, t.text));
            const st = el("div", "st");
            if (p.status) st.append(el("span", `dot ${p.tone ?? ""}`), document.createTextNode(p.status));
            who.append(name, st);
            row.append(badge, who);
            if (p.ping != null) {
              const ping = el("div", "ping");
              const bars = el("span", `bars q${p.ping < 80 ? 3 : p.ping < 180 ? 2 : 1}`);
              bars.append(el("i"), el("i"), el("i"));
              ping.append(bars, el("span", "", `${p.ping} ms`));
              row.append(ping);
            }
            list.append(row);
          }
          box.append(label, list);
          return box;
        }
        case "steps": {
          const box = el("div", "steps");
          block.steps.forEach((text, i) => {
            const state = i < block.current ? "done" : i === block.current ? `now ${block.fail ? "fail" : ""}` : "";
            const step2 = el("div", `step ${state}`);
            step2.append(el("i"), el("span", "", text));
            box.append(step2);
          });
          return box;
        }
        case "callout": {
          const box = el("div", `call ${block.tone ?? ""}`);
          const text = el("div");
          if (block.title) text.append(el("b", "", `${block.title} `));
          text.append(document.createTextNode(block.text ?? ""));
          box.append(text);
          if (block.buttons?.length) {
            const row = el("div", "row");
            for (const b of block.buttons) row.append(button(b));
            box.append(row);
          }
          return box;
        }
        case "buttons": {
          const row = el("div", "row");
          for (const b of block.buttons) row.append(button(b));
          return row;
        }
        case "input": {
          const box = el("div");
          if (block.label) box.append(el("div", "label", block.label));
          const row = el("div", "row");
          const input = el("input");
          input.placeholder = block.placeholder ?? "";
          input.spellcheck = false;
          if (block.maxLength) input.maxLength = block.maxLength;
          input.dataset.field = block.field;
          input.dataset.act = block.act;
          if (block.value) input.value = block.value;
          row.append(input, button({ act: block.act, label: block.button, field: block.field, style: `${block.style ?? ""} slim` }));
          box.append(row);
          return box;
        }
        case "kv": {
          const box = el("dl", "kv");
          for (const [k, v, cls] of block.items) box.append(el("dt", "", k), el("dd", cls ?? "", v));
          return box;
        }
        case "meter": {
          const box = el("div", "small muted");
          box.append(document.createTextNode(block.label));
          const bar = el("div", `meter ${block.fraction >= 1 ? "full" : block.fraction >= 0.75 ? "warn" : ""}`);
          const fill = el("span");
          fill.style.width = `${Math.round(Math.min(1, Math.max(0, block.fraction)) * 100)}%`;
          bar.append(fill);
          box.append(bar);
          return box;
        }
        case "section": {
          const box = el("div", `section ${block.open ? "" : "closed"}`);
          const toggle = el("button", "toggle", block.title);
          toggle.dataset.act = block.act;
          box.append(toggle);
          if (block.open) for (const child of block.blocks) box.append(this.block(child));
          return box;
        }
        case "credits":
          return el("div", "credits", block.text);
        case "chips": {
          const box = el("div", "chips");
          for (const c of block.chips) box.append(this.toggleChip(c));
          return box;
        }
        case "stepper":
          return this.stepper(block);
        case "grid": {
          const box = el("div", "grid");
          for (const b of block.buttons) box.append(button({ ...b, style: `${b.style ?? ""} tiny` }));
          return box;
        }
        case "funPlayer": {
          const box = el("div", "fplayer");
          const head = el("div", "fhead");
          const badge = el("span", "fbadge", block.n ? String(block.n) : "★");
          badge.style.background = block.n ? PLAYER_COLORS[block.n - 1] : "var(--accent)";
          head.append(badge, el("b", "", block.name));
          if (block.money?.value) head.append(el("span", "fmoney", `$${block.money.value}`));
          box.append(head);
          const chips = el("div", "chips");
          for (const c of block.chips) chips.append(this.toggleChip(c));
          box.append(chips, this.stepper(block.speed));
          const money = el("div", "frow");
          money.append(el("span", "flabel", block.money.label));
          for (const b of block.money.buttons) money.append(button({ ...b, style: "tiny" }));
          box.append(money);
          return box;
        }
        default:
          return el("div");
      }
    }
  };

  // src/fun/fun.js
  var TEXT = {
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
      cheatsOff: "This map has cheats off: the commands won't work."
    },
    pt: {
      title: "Modo diversão",
      note: "Só o host. Vale para todo mundo na sua partida.",
      pause: "Dica: aperte Esc no jogo para abrir este cartão.",
      flyHint: "Voa e Atravessa passam por paredes: desligue com os pés no chão, senão o jogador cai para fora do mapa.",
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
      cheatsOff: "Este mapa está com cheats desligados: os comandos não vão funcionar."
    }
  };
  var F = TEXT[LANG];
  var PLAYER_TOGGLES = ["god", "demigod", "notarget", "noclip", "ufo"];
  var SPEEDS = [0.5, 0.75, 1, 1.5, 2, 3];
  var TIMESCALES = [0.25, 0.5, 0.75, 1, 1.5, 2];
  var JUMPS = [39, 80, 150, 300, 600];
  var GRAVITIES = [800, 600, 400, 200, 100];
  var STOCK = 999;
  var WEAPONS = [
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
    ["claymore_zm", "Claymores"]
  ];
  function createFun() {
    return {
      open: false,
      players: {},
      // slot -> { god, demigod, notarget, noclip, ufo, speed }
      infiniteClip: false,
      infiniteStock: false,
      oneHit: false,
      passive: false,
      timescale: 1,
      jump: 39,
      gravity: 800,
      queue: [],
      // console commands waiting for the engine's mailbox
      notice: null,
      noticeAt: 0,
      lastStockAt: 0,
      lastZombiesAt: 0
    };
  }
  var playerState = (fun, slot) => fun.players[slot] ??= { god: false, demigod: false, notarget: false, noclip: false, ufo: false, speed: 1 };
  function funPlayers(session) {
    const players = [{ slot: 0, n: 1, name: session.name || (LANG === "pt" ? "Você" : "You") }];
    if (session.mode === "host") {
      for (const g of session.guests.values()) {
        if (g.present && g.slot?.state === SLOT.active) players.push({ slot: g.slot.slot, n: g.seat + 1, name: g.state?.name || `${LANG === "pt" ? "Jogador" : "Player"} ${g.seat + 1}` });
      }
    }
    return players;
  }
  var funAvailable = (session) => session.mode !== "guest";
  function addresses(session) {
    const f = session.build?.fun;
    const engine = session.engine;
    if (!f || !engine) return null;
    return {
      f,
      engine,
      ent: (slot) => f.entities + slot * f.entitySize,
      client: (slot) => engine.int(f.entities + slot * f.entitySize + f.ent.client)
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
  function funTick(session) {
    const fun = session.fun;
    if (fun.notice && Date.now() - fun.noticeAt > 6e3) fun.notice = null;
    const a = addresses(session);
    if (!a || !funAvailable(session) || screen() !== "playing") {
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
      if (p.speed !== 1) new Float32Array(engine.buffer)[client + f.client.speedScale >> 2] = p.speed;
    }
    if (fun.infiniteStock && now - fun.lastStockAt > 500) {
      fun.lastStockAt = now;
      refillStock(session, a);
    }
    if ((fun.oneHit || fun.passive) && now - fun.lastZombiesAt > 1500) {
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
  function watchConsole(session) {
    for (const level of ["log", "warn", "error"]) {
      const original = console[level];
      console[level] = function(...args) {
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
    const at = i < 0 ? list.indexOf(list.reduce((best, v) => Math.abs(v - value) < Math.abs(best - value) ? v : best, list[0])) : i;
    return list[Math.max(0, Math.min(list.length - 1, at + direction))];
  }
  function funActions(session) {
    const fun = session.fun;
    const engineReady = () => Boolean(addresses(session));
    const togglePlayer = (key, slot) => {
      const a = addresses(session);
      const p = playerState(fun, slot);
      p[key] = !p[key];
      if (!p[key] && a) {
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
      if (client) new Float32Array(a.engine.buffer)[client + a.f.client.speedScale >> 2] = value;
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
    const forSlots = (slot) => slot === "all" ? funPlayers(session).map((p) => p.slot) : [slot];
    return {
      fun: () => fun.open = !fun.open,
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
      }
    };
  }
  var fmt = (v) => Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/0$/, "");
  function funSection(session) {
    const fun = session.fun;
    const blocks = [];
    const a = addresses(session);
    if (!a || !["ready", "playing"].includes(screen())) {
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
      const on = (key) => state ? state[key] : allOn(key);
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
            { act: "funPoints", arg: `zero:${p.slot}`, label: "0" }
          ]
        }
      });
    }
    if (players.some((p) => fun.players[p.slot]?.noclip || fun.players[p.slot]?.ufo)) blocks.push({ kind: "callout", tone: "wait", text: F.flyHint });
    blocks.push({ kind: "label", text: F.ammo });
    blocks.push({
      kind: "chips",
      chips: [
        { act: "funAmmo", arg: "clip", label: F.infiniteClip, on: fun.infiniteClip },
        { act: "funAmmo", arg: "stock", label: F.infiniteStock, on: fun.infiniteStock },
        { act: "funAmmo", arg: "refill", label: F.refill, on: false, plain: true }
      ]
    });
    blocks.push({ kind: "label", text: F.zombies });
    blocks.push({
      kind: "chips",
      chips: [
        { act: "funZombies", arg: "onehit", label: F.oneHit, on: fun.oneHit },
        { act: "funZombies", arg: "passive", label: F.passive, on: fun.passive },
        { act: "funZombies", arg: "clear", label: F.clear, on: false, plain: true }
      ]
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

  // src/ui/view.js
  var COPIED_MS = 2e3;
  var CONNECTED = ["ingame", "ready", "lobby"];
  var ON_THE_WAY = ["joining", "turn", "loading", "opening", "reconnecting"];
  function view(session) {
    const screen2 = screen();
    const playing = screen2 === "playing" && !session.engine?.menuOpen();
    const blocks = [];
    if (session.error) blocks.push({ kind: "callout", tone: "bad", text: session.error });
    if (session.notice) blocks.push({ kind: "callout", tone: "info", text: session.notice });
    if (session.overQuota) {
      const at = session.overQuota.resetsAt ? new Date(session.overQuota.resetsAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null;
      blocks.push({ kind: "callout", tone: "bad", text: T.relayOverQuota(at), buttons: [{ act: "openRelayGuide", label: T.relayGuide, style: "primary" }, { act: "editRelayNow", label: T.changeRelay }] });
    }
    if (session.update) blocks.push({ kind: "callout", tone: "ok", text: T.updateAvailable(session.update.version), buttons: [{ act: "openUpdate", label: T.updateHow, style: "primary" }] });
    if (!session.mode) return soloView(session, blocks, playing);
    const hosting = session.mode === "host";
    const roster = hosting ? hostRoster(session).players : guestRoster(session);
    const chip = hosting ? hostSection(session, blocks, roster, screen2) : guestSection(session, blocks, screen2);
    const me = hosting ? 1 : validSeat(session.seat) ? session.seat + 1 : 0;
    const connected = roster.filter((p) => CONNECTED.includes(p.status)).length;
    blocks.push({ kind: "players", label: T.players, aside: T.playersAside(connected, MAX_GUESTS + 1), players: playerRows(session, roster, me) });
    const actions2 = [];
    if (!hosting && session.phase === "connected" && session.hostPos) actions2.push({ act: "goToHost", label: T.goToHost });
    actions2.push({ act: "leave", label: T.leave, style: "ghost" });
    blocks.push({ kind: "buttons", buttons: actions2 });
    if (funAvailable(session)) blocks.push(funSection(session));
    blocks.push(settingsSection(session, true));
    const ping = session.stats?.rtt != null ? `${Math.round(session.stats.rtt)} ms` : "–";
    const pill = {
      players: roster.map((p) => ({ n: p.n, on: CONNECTED.includes(p.status) })),
      texts: [session.paused ? T.chip.paused : ping, ...session.gamepad?.status === "active" ? ["🎮"] : []]
    };
    return { chip, tagline: `${T.room} ${session.room}`, blocks, compact: playing && !session.error, pill };
  }
  function soloView(session, blocks, playing) {
    blocks.push({ kind: "text", cls: "muted", text: T.intro });
    blocks.push({ kind: "buttons", buttons: [{ act: "host", label: T.host, style: "primary" }] });
    blocks.push({ kind: "input", label: T.joinLabel, field: "join", placeholder: T.joinPlaceholder, act: "join", button: T.join });
    if (onSharedRelay(session)) blocks.push({ kind: "callout", tone: "info", text: T.relayPitch, buttons: relayButtons() });
    if (session.engine) blocks.push(funSection(session));
    blocks.push(settingsSection(session, false));
    const pill = session.gamepad?.status === "active" ? { texts: ["🎮"] } : null;
    return { chip: { text: T.chip.solo }, tagline: T.tagline, blocks, compact: playing && !session.error && !session.notice, pill };
  }
  function hostSection(session, blocks, roster, screen2) {
    const freeSeats = roster.filter((p) => p.status === "free").length;
    const onTheWay = roster.some((p) => !p.host && ON_THE_WAY.includes(p.status));
    const mapOpen = Boolean(session.engine) || screen2 === "loading" || screen2 === "download";
    const step2 = screen2 === "playing" ? 3 : screen2 === "ready" ? 2 : mapOpen ? 1 : 0;
    const linkCopied = Date.now() - session.copiedLinkAt < COPIED_MS;
    const codeCopied = Date.now() - session.copiedCodeAt < COPIED_MS;
    blocks.push({
      kind: "room",
      label: T.room,
      aside: T.inviteAside(freeSeats),
      code: session.room,
      buttons: [
        { act: "copyLink", label: linkCopied ? T.copied : T.copy, style: linkCopied ? "done" : "primary" },
        { act: "copyCode", label: codeCopied ? T.copied : T.copyCode, style: codeCopied ? "done" : "" }
      ]
    });
    blocks.push({ kind: "steps", steps: T.stepsHost, current: step2 });
    if (!mapOpen) blocks.push({ kind: "callout", tone: "info", text: T.pickMap });
    else if (session.gate) blocks.push({ kind: "callout", tone: "wait", text: T.gate, buttons: [{ act: "startNow", label: T.startNow }] });
    else if (screen2 === "ready" && !onTheWay && roster.some((p) => !p.host && p.status === "ready")) blocks.push({ kind: "callout", tone: "ok", text: T.allIn });
    else if (onTheWay && screen2 === "playing") blocks.push({ kind: "callout", tone: "info", text: T.latecomers });
    if (session.paused) blocks.push({ kind: "callout", tone: "wait", text: session.menuOpen ? T.pausedYou : T.pausedBy });
    if (onSharedRelay(session) && screen2 !== "playing") blocks.push({ kind: "callout", tone: "info", text: T.relayPitchHost, buttons: relayButtons() });
    blocks.push(mapBlock(MAP_SLUGS[session.zone ?? currentZone()] ?? null, currentHorde(), T.mapSubHost));
    if (session.error) return { text: T.chip.error, tone: "bad" };
    if (session.paused) return { text: T.chip.paused, tone: "wait" };
    return screen2 === "playing" ? { text: T.chip.ingame, tone: "ok live" } : { text: T.chip.hosting, tone: "wait live" };
  }
  var GUEST_STEP = { "joining-room": 0, following: 1, loading: 2, "waiting-host": 3, freezing: 3, connect: 3, challenging: 3, joining: 3, connected: 4 };
  function guestSection(session, blocks, screen2) {
    const phase = session.phase;
    const failed = ["ended", "failed"].includes(phase);
    const slug = session.lobby?.slug ?? session.hostInfo?.slug ?? null;
    const mapName = slug ? MAP_NAMES[slug] : null;
    let step2 = GUEST_STEP[phase] ?? session.lastStep ?? 0;
    if (phase === "joining-room" && session.hostInfo?.slug) step2 = 1;
    if (!failed) session.lastStep = step2;
    if (session.inviteRelay && session.inviteRelay !== session.relay) {
      blocks.push({ kind: "callout", tone: "wait", text: T.otherRelay(new URL(session.inviteRelay).hostname), buttons: [{ act: "useInviteRelay", label: T.useRelay, style: "primary" }] });
    }
    blocks.push({ kind: "steps", steps: T.stepsGuest, current: step2, fail: failed });
    const onHostMap = session.hostInfo?.slug && currentSlug() === session.hostInfo.slug;
    if ((phase === "loading" || phase === "joining-room" && onHostMap) && screen2 === "landing") {
      blocks.push({ kind: "callout", tone: "wait", title: "⌨", text: T.pressKey });
    } else {
      const text = guestMessage(session, phase, mapName, screen2);
      if (text) blocks.push({ kind: "callout", tone: failed ? "bad" : phase === "connected" ? "ok" : "info", text, buttons: failed ? [{ act: "rejoin", label: T.rejoin, style: "primary" }] : [] });
    }
    if (session.joinedLate && ["joining", "connected"].includes(phase)) blocks.push({ kind: "callout", tone: "info", text: T.lateJoin });
    if (phase === "connected" && session.paused) blocks.push({ kind: "callout", tone: "wait", text: session.menuOpen ? T.pausedYou : T.pausedBy });
    blocks.push(mapBlock(slug, session.lobby?.horde ?? session.hostInfo?.horde, T.mapSubGuest));
    if (session.error) return { text: T.chip.error, tone: "bad" };
    if (failed) return { text: T.chip.ended, tone: "bad" };
    if (session.paused) return { text: T.chip.paused, tone: "wait" };
    if (phase === "connected") return screen2 === "playing" ? { text: T.chip.ingame, tone: "ok live" } : { text: T.chip.lobby, tone: "ok" };
    return { text: T.chip.joining, tone: "wait live" };
  }
  function guestMessage(session, phase, mapName, screen2) {
    switch (phase) {
      case "joining-room":
        return session.peer ? mapName ? T.opening(mapName) : T.hostPicking : T.waitingHost;
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
        if (screen2 === "playing") return null;
        return session.hostState?.screen === "playing" || screen2 === "ready" && session.lobby?.playing ? T.clickToPlay : T.waitingStart;
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
        status: empty ? session.mode === "host" ? T.freeHint : "" : T.st[p.status] ?? T.st.away,
        tone: p.tone ?? "",
        ping: empty || p.host || !Number.isFinite(p.ping) ? null : p.ping
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
        [T.ping, session.stats?.rtt != null ? `${Math.round(session.stats.rtt)} ms` : "–"]
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
    const buttons = session.controller && pad?.status !== "none" ? [{ act: "aimDown", label: T.aimDown }, { act: "aimUp", label: T.aimUp }, { act: "controller", label: T.turnOff, style: "ghost" }] : [{ act: "controller", label: session.controller ? T.turnOff : T.turnOn, style: "ghost" }];
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
      const buttons = [{ act: "editRelay", label: T.changeRelay, style: "ghost" }];
      if (!custom) buttons.unshift({ act: "openRelayGuide", label: T.relayGuide });
      blocks.push({ kind: "buttons", buttons });
    }
    return blocks;
  }
  var onSharedRelay = (session) => session.relay === DEFAULT_RELAY && !session.overQuota;
  var relayButtons = () => [{ act: "openRelayGuide", label: T.relayGuide }, { act: "editRelayNow", label: T.relayHaveOne, style: "ghost" }];

  // src/util/updates.js
  var LATEST = "https://api.github.com/repos/AllanLotta/bo1-zombies-coop/releases/latest";
  var UPDATE_GUIDE = "https://allanlotta.github.io/bo1-zombies-coop/#update";
  var RELAY_GUIDE = "https://allanlotta.github.io/bo1-zombies-coop/#relay";
  var CHECK_EVERY_MS = 6 * 3600 * 1e3;
  var parts = (version) => String(version).replace(/^v/, "").split(".").map((n) => parseInt(n, 10) || 0);
  function isNewer(latest, current) {
    const a = parts(latest);
    const b = parts(current);
    for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
      if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
    }
    return false;
  }
  async function checkForUpdate(session) {
    let cached = null;
    try {
      cached = JSON.parse(readSetting("update", "null"));
    } catch {
    }
    let latest = cached?.latest;
    if (!cached || Date.now() - cached.checkedAt > CHECK_EVERY_MS) {
      try {
        const response = await fetch(LATEST, { headers: { accept: "application/vnd.github+json" } });
        if (response.ok) latest = (await response.json()).tag_name;
        saveSetting("update", JSON.stringify({ checkedAt: Date.now(), latest }));
      } catch {
        return;
      }
    }
    if (latest && isNewer(latest, session.version)) session.update = { version: String(latest).replace(/^v/, ""), url: UPDATE_GUIDE };
  }

  // src/main.js
  var TICK_MS = 50;
  var LANG_QUERY = LANG === "pt" ? "?lang=pt#" : "#";
  var USAGE_REFRESH_MS = 6e5;
  if (!window.__bo1Coop) start();
  function start() {
    const session = createSession();
    window.__bo1Coop = session;
    session.fun = createFun();
    watchConsole(session);
    if (session.mode) keepSinglePlayer(session.room);
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
        aimLevel: session.aimLevel
      });
      session.gamepad.start();
    }
    const refreshUsage = () => fetch(`${session.relay}/usage`).then((r) => r.ok ? r.json() : null).then((usage) => session.usage = Number.isFinite(usage?.fraction) ? usage : null).catch(() => session.usage = null);
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
  function reportHidden(session) {
    const input = session.engine?.Module._KB_Input;
    if (!input || session.reportedHidden === document.hidden) return;
    input(8, Number(document.hidden), 0);
    session.reportedHidden = document.hidden;
  }
  var copy = (session, text, stamp) => navigator.clipboard?.writeText(text).then(
    () => session[stamp] = Date.now(),
    () => session.notice = text
  );
  var reloadWithRelay = (relay) => {
    saveSetting("relay", relay);
    location.reload();
  };
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
      startNow: () => session.startAlone = true,
      rejoin: () => location.reload(),
      openUpdate: () => window.open(session.update?.url, "_blank", "noopener"),
      openRelayGuide: () => window.open(`${RELAY_GUIDE.replace("#", LANG_QUERY)}`, "_blank", "noopener"),
      goToHost: () => moveToHost(session, "button"),
      settings: () => session.showSettings = !session.showSettings,
      saveName: (text) => {
        session.name = cleanName(text);
        saveSetting("name", session.name);
        session.sentPhaseAt = 0;
      },
      editRelay: () => session.editRelay = !session.editRelay,
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
      ...funActions(session)
    };
  }
  function setAim(session, level) {
    session.aimLevel = Math.max(0, Math.min(AIM_SPEEDS.length - 1, level));
    if (session.gamepad) session.gamepad.aimLevel = session.aimLevel;
    saveSetting("aim", String(session.aimLevel));
  }
})();
