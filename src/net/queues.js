// Readers and writers for the engine's loopback queues (circular buffers of fixed-size packet slots in shared
// memory). They run inside the pump worker, polling the engine's counters with atomics.

/** Copies out what the engine wrote into a queue. With `consume`, also advances the queue's read counter. */
export class QueueReader {
  constructor(buffer, loopback, base, { consume = false } = {}) {
    this.i32 = new Int32Array(buffer);
    this.u8 = new Uint8Array(buffer);
    this.lb = loopback;
    this.base = base;
    this.readIndex = (base + loopback.offGet) >> 2;
    this.writeIndex = (base + loopback.offSend) >> 2;
    this.consume = consume;
    this.cursor = Atomics.load(this.i32, this.writeIndex);
    this.lost = 0;
  }

  /** Forgets everything written so far. */
  skip() {
    this.cursor = Atomics.load(this.i32, this.writeIndex);
    if (this.consume) Atomics.store(this.i32, this.readIndex, this.cursor);
  }

  /** New packets since the last call. Slots the engine overwrote before we got to them count as lost. */
  poll(out = []) {
    const { slots, slotSize, offLen, dataMax } = this.lb;
    let written = Atomics.load(this.i32, this.writeIndex);
    if (written - this.cursor > slots - 1) {
      this.lost += written - (slots - 1) - this.cursor;
      this.cursor = written - (slots - 1);
    }
    while (this.cursor < written) {
      const slot = this.base + (this.cursor & (slots - 1)) * slotSize;
      const length = this.i32[(slot + offLen) >> 2];
      const packet = length > 0 && length <= dataMax ? this.u8.slice(slot, slot + length) : null;
      // Re-check after copying: if the engine lapped us meanwhile, the copy may be torn.
      written = Atomics.load(this.i32, this.writeIndex);
      if (written - this.cursor > slots - 1) this.lost += 1;
      else if (packet) out.push(packet);
      this.cursor += 1;
    }
    if (this.consume) Atomics.store(this.i32, this.readIndex, this.cursor);
    return out;
  }
}

/** Puts packets into a queue the engine reads, tagged with the loopback port they appear to come from. */
export class QueueWriter {
  constructor(buffer, loopback, base) {
    this.i32 = new Int32Array(buffer);
    this.u8 = new Uint8Array(buffer);
    this.lb = loopback;
    this.base = base;
    this.readIndex = (base + loopback.offGet) >> 2;
    this.writeIndex = (base + loopback.offSend) >> 2;
  }

  hasRoom() {
    return Atomics.load(this.i32, this.writeIndex) - Atomics.load(this.i32, this.readIndex) < this.lb.slots - 1;
  }

  /** False, without writing, when the engine has not caught up yet; the caller retries later. */
  push(packet, port) {
    const { slots, slotSize, offLen, offPort, dataMax } = this.lb;
    if (packet.byteLength === 0 || packet.byteLength > dataMax) return true;
    if (!this.hasRoom()) return false;
    const written = Atomics.load(this.i32, this.writeIndex);
    const slot = this.base + (written & (slots - 1)) * slotSize;
    this.u8.set(packet, slot);
    Atomics.store(this.i32, (slot + offLen) >> 2, packet.byteLength);
    Atomics.store(this.i32, (slot + offPort) >> 2, port);
    Atomics.add(this.i32, this.writeIndex, 1);
    return true;
  }
}

/** The command word of a connectionless packet (0xFFFFFFFF prefix), such as "connect" or "rcon"; otherwise null. */
export function connectionlessCommand(packet) {
  if (packet.byteLength < 5 || packet[0] !== 255 || packet[1] !== 255 || packet[2] !== 255 || packet[3] !== 255) return null;
  let end = 4;
  while (end < packet.byteLength && end < 64 && packet[end] !== 0 && packet[end] !== 32 && packet[end] !== 10) end += 1;
  return String.fromCharCode(...packet.subarray(4, end));
}
