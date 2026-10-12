// Everything the extension knows about a specific KisakBlack-web.wasm, keyed by the file's SHA-256. When vel.gg ships
// a new engine the hash changes and co-op switches itself off until a matching entry is added here.
//
// Addresses are byte offsets into the engine's linear memory; function indices count imported functions too.

export const BUILDS = {
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
    },
    // Each entry points to a dvar_s whose current value sits at +dvarValue.
    dvars: { comSvRunning: 134904904, svPaused: 134904892, clPaused: 134904896, comMaxClients: 134904752 },
    dvarValue: 24,
    // vel.gg's page layer: 1 while the map waits behind the "click to start" screen.
    introState: 148263168,
    loopbackAddressType: 2, // NA_LOOPBACK
  },
};

/** Client connection states (clientUIActive.connectionState). */
export const CONNECTION = Object.freeze({ disconnected: 0, connecting: 4, challenging: 5, connected: 6, loading: 8, primed: 9, active: 10 });
/** Server-side slot states (client_t.state). */
export const SLOT = Object.freeze({ free: 0, zombie: 1, reconnecting: 2, connected: 3, loading: 4, active: 5 });
