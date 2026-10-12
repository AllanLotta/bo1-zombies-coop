// Just enough of the WebAssembly binary format to find function bodies by name and rewrite some of them.

export function encodeU32(value) {
  const out = [];
  let n = value >>> 0;
  do {
    let byte = n & 0x7f;
    n >>>= 7;
    if (n) byte |= 0x80;
    out.push(byte);
  } while (n);
  return out;
}

export function encodeI32(value) {
  const out = [];
  let n = value | 0;
  for (;;) {
    const byte = n & 0x7f;
    n >>= 7;
    const last = (n === 0 && !(byte & 0x40)) || (n === -1 && byte & 0x40);
    out.push(last ? byte : byte | 0x80);
    if (last) return out;
  }
}

/** [value, next offset] */
export function readU32(bytes, at) {
  let value = 0;
  let shift = 0;
  let byte;
  do {
    byte = bytes[at++];
    value |= (byte & 0x7f) << shift;
    shift += 7;
  } while (byte & 0x80);
  return [value >>> 0, at];
}

/** [value, next offset] */
export function readI32(bytes, at) {
  let value = 0;
  let shift = 0;
  let byte;
  do {
    byte = bytes[at++];
    value |= (byte & 0x7f) << shift;
    shift += 7;
  } while (byte & 0x80);
  if (shift < 32 && byte & 0x40) value |= -1 << shift;
  return [value, at];
}

/** Opcodes and small instruction builders used by the patches. */
export const op = {
  unreachable: 0x00,
  if: [0x04, 0x40],
  end: 0x0b,
  return: 0x0f,
  drop: 0x1a,
  i32Eq: 0x46,
  i32GeU: 0x4f,
  i32Add: 0x6a,
  i32Sub: 0x6b,
  globalGet: 0x23,
  globalSet: 0x24,
  i32Load: [0x28, 2, 0],
  atomicLoad: [0xfe, 0x10, 2, 0],
  atomicExchange: [0xfe, 0x41, 2, 0],
  i32: (value) => [0x41, ...encodeI32(value)],
  call: (index) => [0x10, ...encodeU32(index)],
  get: (local) => [0x20, ...encodeU32(local)],
  set: (local) => [0x21, ...encodeU32(local)],
  tee: (local) => [0x22, ...encodeU32(local)],
};

const SECTION = { custom: 0, import: 2, code: 10 };

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
    skipName(); // module
    skipName(); // field
    const kind = bytes[p++];
    if (kind === 0) {
      functions += 1;
      p = readU32(bytes, p)[1];
    } else if (kind === 1) {
      p += 1; // element type
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

/** Section layout, the number of imported functions, and where the "name" custom section is. */
export function readModule(bytes) {
  if (bytes[0] !== 0 || bytes[1] !== 0x61 || bytes[2] !== 0x73 || bytes[3] !== 0x6d) throw new Error("not a wasm module");
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

/** Names of the wanted function indices, read from the "name" section (a Map; missing entries are absent). */
export function functionNames(bytes, module, wanted) {
  const result = new Map();
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

/** Offset just past a function body's local declarations, and the type of local `index` (null if not declared). */
export function localsEnd(body, params, index) {
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

/**
 * Rebuilds the module with some function bodies replaced. `edits` maps a code-section index (function index minus
 * imports) to a function (body bytes) => new body bytes. Throws unless every edit was applied.
 */
export function rewriteFunctions(bytes, module, edits) {
  const { code } = module;
  let [count, at] = readU32(bytes, code.body);
  const parts = [Uint8Array.from(encodeU32(count))];
  let applied = 0;
  for (let i = 0; i < count; i += 1) {
    const [size, start] = readU32(bytes, at);
    const end = start + size;
    const edit = edits.get(i);
    if (edit) {
      const body = edit(bytes.subarray(start, end));
      parts.push(Uint8Array.from(encodeU32(body.length)), body);
      applied += 1;
    } else {
      parts.push(bytes.subarray(at, end));
    }
    at = end;
  }
  if (applied !== edits.size) throw new Error(`patched ${applied} of ${edits.size} functions`);

  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const header = Uint8Array.from([10, ...encodeU32(length)]);
  const out = new Uint8Array(code.start + header.length + length + (bytes.length - code.end));
  out.set(bytes.subarray(0, code.start), 0);
  let o = code.start;
  out.set(header, o);
  o += header.length;
  for (const part of parts) {
    out.set(part, o);
    o += part.length;
  }
  out.set(bytes.subarray(code.end), o);
  return out;
}

export const hex = (text) => text.trim().split(/\s+/).map((byte) => parseInt(byte, 16));

export async function sha256(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
