// Everything the extension knows about a specific KisakBlack-web.wasm, keyed by the file's SHA-256. When vel.gg ships
// a new engine the hash changes and co-op switches itself off until a matching entry is added here.
//
// Addresses are byte offsets into the engine's linear memory; function indices count imported functions too.

export const BUILDS = {
  // Served at https://vel.gg/bo1z/ since about 2026-10-16 and at https://vel.gg/bsz/ since 2026-10-18, 9,908,677 bytes. A small rebuild of the one below (adds
  // _KB_SetGraphicsQuality): same functions and struct layouts, a few indices and the static data shifted.
  "42be1c35025afa61ed1f0fc4558ca15c45c49b37dfdc458d3ebbe30f8c958036": {
    functions: {
      svFrame: [2963, "__wrap__Z8SV_Frameii"],
      netGetLoopPacket: [4119, "NET_GetLoopPacket(netsrc_t, netadr_t*, msg_t*)"],
      cbufAddText: [286, "Cbuf_AddText(int, char const*)"],
      svWaitServer: [1654, "SV_WaitServer()"],
      assertHandler: [170, "Assert_MyHandler(char const*, int, int, char const*, ...)"],
      cachedTagUpdate: [4410, "CachedTag_UpdateTagInternal(centity_s const*, cached_client_tag_t*, unsigned int, int, bool)"],
      comError: [179, "Com_Error(errorParm_t, char const*, ...)"],
      clCreateCmd: [6686, "CL_CreateCmd(usercmd_s*, int)"],
      cgScriptSndLengthNotify: [6721, "CG_ScriptSndLengthNotify(int, int)"],
    },
    bytePatches: [
      {
        fn: "clCreateCmd",
        find: "10 ef 06 41 07 46 0d 00 20 05 20 05 28 02 04 41 04 72 36 02 04",
        replace: "10 ef 06 41 07 46 0d 00 20 05 20 05 28 02 04 41 00 72 36 02 04",
      },
      {
        fn: "cgScriptSndLengthNotify",
        role: "guest",
        find: "41 d0 db 8a c2 00 28 02 00 2d 00 18 41 01 46 04 40",
        replace: "41 d0 db 8a c2 00 28 02 00 2d 00 18 41 02 46 04 40",
      },
    ],
    // The words after introState are taken by vel.gg's co-op in this build. Linear memory below 1024 (where static
    // data starts) is never used by emscripten, so the mailboxes live there.
    mailbox: { command: 1008, freeze: 1012, inboundRing: 1016 },
    loopback: { base: 139466576, stride: 20360, slots: 16, slotSize: 1272, dataMax: 1264, offLen: 1264, offPort: 1268, offGet: 20352, offSend: 20356 },
    reservedPorts: [0, 1, 1773],
    server: {
      allowNetPackets: 146182322,
      clientsPtr: 146048924,
      clientStride: 544120,
      clientState: 0,
      clientAddrType: 32,
      clientAddrPort: 40,
    },
    client: {
      connectionState: 14090472,
      clcPtr: 44481716,
      serverAddressPort: 24,
      lastPacketTime: 12,
      codeTimeScale: 138587744,
    },
    dvars: { comSvRunning: 138587600, svPaused: 138587588, clPaused: 138587592, comMaxClients: 138587440 },
    dvarValue: 24,
    introState: 151951500,
    loopbackAddressType: 2,
    fun: {
      entities: 91240656,
      entitySize: 760,
      ent: { client: 324, flags: 372, health: 404 },
      entFlags: { god: 1, demigod: 2, notarget: 4 },
      client: { ammoPools: 832, ammoClips: 952, ammoSlots: 15, speedScale: 10088, score: 10276, flags: 10396 },
      clientFlags: { noclip: 1, ufo: 2 },
      cheatsDvar: 90624344,
    },
  },

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
      cgScriptSndLengthNotify: [6720, "CG_ScriptSndLengthNotify(int, int)"],
    },
    bytePatches: [
      {
        fn: "clCreateCmd",
        find: "10 ef 06 41 07 46 0d 00 20 05 20 05 28 02 04 41 04 72 36 02 04",
        replace: "10 ef 06 41 07 46 0d 00 20 05 20 05 28 02 04 41 00 72 36 02 04",
      },
      {
        fn: "cgScriptSndLengthNotify",
        role: "guest",
        find: "41 e0 d1 8a c2 00 28 02 00 2d 00 18 41 01 46 04 40",
        replace: "41 e0 d1 8a c2 00 28 02 00 2d 00 18 41 02 46 04 40",
      },
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
      clientAddrPort: 40,
    },
    client: {
      connectionState: 14090344,
      clcPtr: 44481588,
      serverAddressPort: 24,
      lastPacketTime: 12,
      codeTimeScale: 138586480,
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
      cheatsDvar: 90624216,
    },
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
      cgScriptSndLengthNotify: [6587, "CG_ScriptSndLengthNotify(int, int)"],
    },

    // Same-length byte edits, each required to match exactly once inside its function (hex, wasm opcodes).
    bytePatches: [
      {
        // With a menu or the chat open, the client flags its usercmds (button_bits[1] |= 4). Other players then draw
        // an "in a menu" marker over that player whose material zombies never loads, and crash in
        // Material_GetTechnique called from fx_drawCallback. Turning the `i32.const 4` into 0 keeps the flag off.
        fn: "clCreateCmd",
        find: "10 dc 06 41 07 46 0d 00 20 05 20 05 28 02 04 41 04 72 36 02 04",
        replace: "10 dc 06 41 07 46 0d 00 20 05 20 05 28 02 04 41 00 72 36 02 04",
      },
      {
        // Guests only. Script sounds report their length to the server with the reliable command "sl", meant to come
        // from the listen-server player alone (checked via com_sv_running == 1). A guest's own idle server still
        // counts as running, so guests sent it too; while the host waits in the lobby nothing acknowledges them and
        // the guest drops with EXE_ERR_CLIENT_CMD_OVERFLOW. Comparing with 2 instead makes the check always fail.
        fn: "cgScriptSndLengthNotify",
        role: "guest",
        find: "41 c8 f8 a9 c0 00 28 02 00 2d 00 18 41 01 46 04 40",
        replace: "41 c8 f8 a9 c0 00 28 02 00 2d 00 18 41 02 46 04 40",
      },
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
      allowNetPackets: 142494258, // u8: the server thread reads the inbound queue only while this is 1
      clientsPtr: 142360860, // client_t* svs.clients
      clientStride: 544120,
      clientState: 0, // i32: 0 free, 1 zombie, 2 reconnecting, 3 connected, 4 loading, 5 active
      clientAddrType: 32, // i32 netadr_t.type
      clientAddrPort: 40, // u16 netadr_t.port
    },
    client: {
      connectionState: 13391960, // i32: 5 challenging ... 10 active
      clcPtr: 43783020, // clientConnection_t*
      serverAddressPort: 24, // u16, inside clientConnection_t
      lastPacketTime: 12, // i32, inside clientConnection_t; 0 disables the client's timeout check
      // f32 com_codeTimeScale: the game's slow motion, set by the "X" server command (game over slows it to 0.1).
      // Written as 1.0 by SP_TemporaryReloadMap, which only runs where the server is.
      codeTimeScale: 134905048,
    },
    // Each entry points to a dvar_s whose current value sits at +dvarValue.
    dvars: { comSvRunning: 134904904, svPaused: 134904892, clPaused: 134904896, comMaxClients: 134904752 },
    dvarValue: 24,
    // vel.gg's page layer: 1 while the map waits behind the "click to start" screen.
    introState: 148263168,
    loopbackAddressType: 2, // NA_LOOPBACK

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
      cheatsDvar: 86987848, // g_cheats; the panel's console commands need it on (devmap maps have it on)
    },
  },
};

/** Client connection states (clientUIActive.connectionState). */
export const CONNECTION = Object.freeze({ disconnected: 0, connecting: 4, challenging: 5, connected: 6, loading: 8, primed: 9, active: 10 });
/** Server-side slot states (client_t.state). */
export const SLOT = Object.freeze({ free: 0, zombie: 1, reconnecting: 2, connected: 3, loading: 4, active: 5 });
