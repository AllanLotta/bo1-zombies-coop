// Edits applied to the engine's wasm before the page instantiates it. Every edit is tied to a function verified by
// name, so a different engine build is refused instead of being patched blindly.
import { functionNames, hex, localsEnd, op, readI32, readU32, encodeU32, readModule, rewriteFunctions } from "./wasm.js";

/**
 * Runs at the top of SV_Frame on the server thread:
 *  1. if the page left a console command in the mailbox, take it (atomic exchange with 0) and queue it;
 *  2. while the "freeze" flag is set, skip the frame entirely (SV_WaitServer, then return).
 * Local `scratch` holds the command pointer for a moment and is cleared again afterwards.
 */
function serverFrameHook(build, scratch) {
  const { mailbox, functions } = build;
  return [
    ...op.i32(mailbox.command), ...op.i32(0), ...op.atomicExchange, ...op.tee(scratch),
    ...op.if, ...op.i32(0), ...op.get(scratch), ...op.call(functions.cbufAddText[0]), op.end,
    ...op.i32(0), ...op.set(scratch),
    ...op.i32(mailbox.freeze), ...op.atomicLoad,
    ...op.if, ...op.call(functions.svWaitServer[0]), ...op.get(0), op.return, op.end,
  ];
}

/**
 * Runs at the top of NET_GetLoopPacket(sock, ...): when the server (sock 1) finds its own inbound queue empty and the
 * page has set an extra inbound queue, read that one instead by swapping the `sock` argument.
 */
function loopPacketHook(build, scratch) {
  const { mailbox, loopback } = build;
  const serverQueue = loopback.base + loopback.stride;
  return [
    ...op.get(0), ...op.i32(1), op.i32Eq,
    ...op.if,
    ...op.i32(mailbox.inboundRing), ...op.atomicLoad, ...op.tee(scratch),
    ...op.if,
    ...op.i32(serverQueue + loopback.offGet), ...op.i32Load,
    ...op.i32(serverQueue + loopback.offSend), ...op.i32Load,
    op.i32GeU,
    ...op.if, ...op.get(scratch), ...op.set(0), op.end,
    op.end,
    ...op.i32(0), ...op.set(scratch),
    op.end,
  ];
}

/** Inserts `code` right after the local declarations, checking that `scratch` is an i32 local. */
const prepend = (code, params, scratch) => (body) => {
  const { at, type } = localsEnd(body, params, scratch);
  if (type !== 0x7f) throw new Error(`local ${scratch} is not an i32`);
  const out = new Uint8Array(body.length + code.length);
  out.set(body.subarray(0, at), 0);
  out.set(code, at);
  out.set(body.subarray(at), at + code.length);
  return out;
};

/**
 * The engine's debug-assert handler prints the failure and then hits `unreachable`. Several asserts fire harmlessly
 * once more than one player is around, so the trap is replaced by "restore the stack pointer, return 1 (carry on)".
 * The function's prologue is checked against the expected emscripten shape before anything changes.
 */
const assertsContinue = (params) => (body) => {
  let [groups, p] = readU32(body, 0);
  for (let g = 0; g < groups; g += 1) p = readU32(body, p)[1] + 1;
  const expect = (ok, what) => {
    if (!ok) throw new Error(`assert handler: ${what}`);
  };
  expect(body[p] === op.globalGet, "no stack frame");
  const [stackPointer, a] = readU32(body, p + 1);
  expect(body[a] === 0x41, "no frame size");
  const [frameSize, b] = readI32(body, a + 1);
  expect(body[b] === op.i32Sub && body[b + 1] === 0x22, "unexpected prologue");
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

/**
 * Replaces every `call <callee>` in a body with as many `drop`s as the call has arguments (which only fits when the
 * call instruction is exactly that many bytes). Used to turn fatal errors into "skip and keep going".
 */
const dropCalls = (callee, args, expected) => (body) => {
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

/** Same-length replacement that must match exactly once. */
const replaceOnce = ({ fn, find, replace }) => (body) => {
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

/**
 * Returns the patched module. `role` ("host", "guest" or null for solo) selects role-specific byte patches.
 * Throws when anything does not match this build exactly.
 */
export function patchEngine(input, build, role = null) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const module = readModule(bytes);
  const { functions } = build;

  const names = functionNames(bytes, module, Object.values(functions).map(([index]) => index));
  for (const [index, name] of Object.values(functions)) {
    if (names.get(index) !== name) throw new Error(`function ${index} is ${names.get(index)}, expected ${name}`);
  }

  const slot = (key) => functions[key][0] - module.importedFunctions;
  const edits = new Map([
    [slot("svFrame"), prepend(serverFrameHook(build, 1), 1, 1)],
    [slot("netGetLoopPacket"), prepend(loopPacketHook(build, 4), 3, 4)],
    [slot("assertHandler"), assertsContinue(4)],
    // Attaching effects and weapons to another player's model fails fatally if that model is not loaded yet, which
    // solo never runs into: leave the attachment as it was instead.
    [slot("cachedTagUpdate"), dropCalls(functions.comError[0], 3, 2)],
  ]);
  for (const patch of build.bytePatches) {
    if (!patch.role || patch.role === role) edits.set(slot(patch.fn), replaceOnce(patch));
  }
  return rewriteFunctions(bytes, module, edits);
}
