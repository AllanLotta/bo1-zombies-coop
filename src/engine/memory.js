// Typed access to the running engine's shared memory. All reads and writes are atomic because the engine runs on
// several threads (main, server, renderer) that share this memory with the page.
import { SLOT } from "./builds.js";

/** Code time scale at or above which the game runs at normal speed. */
export const NORMAL_SPEED = 0.999;

export class EngineMemory {
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
    const bytes = new TextEncoder().encode(`${text}\n`);
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
    Atomics.store(this.u16, (clc + this.build.client.serverAddressPort) >> 1, port);
    return true;
  }

  clientServerPort() {
    const clc = this.clientConnection();
    return clc ? Atomics.load(this.u16, (clc + this.build.client.serverAddressPort) >> 1) : null;
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
        port: Atomics.load(this.u16, (base + s.clientAddrPort) >> 1),
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
        ports.forEach((port, i) => (seats[i + 1] = { port, base: this.queueAt(port) }));
        return { seats, inbound: { port: inbound, base: this.queueAt(inbound) } };
      }
    }
    throw new Error("could not place the guest queues in engine memory");
  }

  /** Tells the patched NET_GetLoopPacket which extra queue the server should read (0: none). */
  useInboundQueue(port) {
    this.setInt(this.build.mailbox.inboundRing, port);
  }
}
