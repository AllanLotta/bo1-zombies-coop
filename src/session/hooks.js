// Hooks into vel.gg's page that let the extension get at the engine: patching the wasm while it is instantiated,
// running setup code right before the engine's main() starts, and holding the host's click-to-start.
import { BUILDS } from "../engine/builds.js";
import { EngineMemory } from "../engine/memory.js";
import { patchEngine } from "../engine/patch.js";
import { sha256 } from "../engine/wasm.js";
import { T } from "../ui/strings.js";
import { prepareGuest } from "./guest.js";
import { prepareHost } from "./host.js";

const ENGINE_URL = /\/artifacts\/KisakBlack-web\.wasm(\?|$)/;
const ENGINE_MIN_BYTES = 5e6;

/** Swaps in the patched engine. Only touches the engine module, and only when co-op or the controller needs it. */
export function hookWasm(session) {
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

  WebAssembly.instantiateStreaming = async function (source, imports) {
    if (!wanted()) return instantiateStreaming.call(WebAssembly, source, imports);
    const response = await source;
    if (!ENGINE_URL.test(response.url ?? "")) return instantiateStreaming.call(WebAssembly, response, imports);
    const bytes = new Uint8Array(await response.arrayBuffer());
    return instantiate.call(WebAssembly, await prepare(bytes), imports);
  };

  WebAssembly.instantiate = function (source, imports) {
    const bytes = source instanceof ArrayBuffer ? new Uint8Array(source) : ArrayBuffer.isView(source) ? new Uint8Array(source.buffer, source.byteOffset, source.byteLength) : null;
    if (wanted() && bytes && bytes.byteLength > ENGINE_MIN_BYTES) return prepare(bytes.slice()).then((ready) => instantiate.call(WebAssembly, ready, imports));
    return instantiate.call(WebAssembly, source, imports);
  };
}

/**
 * Emscripten assigns Module.callMain once the runtime is ready. A one-shot setter on Object.prototype catches that
 * assignment and wraps it, so host or guest setup can edit the engine's command line before the game starts.
 */
export function hookMain(session) {
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
              // Setup errors carry a string key ("key" or "key:argument") from ui/strings.js.
              const [key, argument] = String(error.message).split(/:(.*)/s);
              if (T[key]) session.fail(key, argument);
              else session.error = error.message;
              session.note(`setup failed: ${error.stack ?? error}`);
              session.engine?.useInboundQueue(0);
            }
            return original.call(this, args);
          })();
        },
      });
    },
  });
}

/** While the host's start is held for incoming players, clicks and keys on the game do nothing (the card still works). */
export function holdStart(session, card) {
  const block = (event) => {
    if (!session.gate || event.composedPath?.().includes(card)) return;
    event.stopImmediatePropagation();
    event.preventDefault();
  };
  for (const type of ["keydown", "keyup", "mousedown", "mouseup", "click", "pointerdown", "pointerup"]) window.addEventListener(type, block, true);
}
