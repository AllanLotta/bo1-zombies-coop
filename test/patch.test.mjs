// Patches the real engine for every role and checks the result is valid wasm with the expected content.
//   node test/patch.test.mjs   (downloads the engine once to the OS temp folder)
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BUILDS } from "../src/engine/builds.js";
import { patchEngine } from "../src/engine/patch.js";

const URL = "https://vel.gg/bo1z/artifacts/KisakBlack-web.wasm";
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

const file = join(tmpdir(), "bo1-zombies-engine.wasm");
if (!existsSync(file)) writeFileSync(file, new Uint8Array(await (await fetch(URL)).arrayBuffer()));
const engine = new Uint8Array(readFileSync(file));
const hash = sha256(engine);
const build = BUILDS[hash];
if (!build) {
  console.log(`vel.gg serves an engine this extension does not know (${hash}). Add it to src/engine/builds.js.`);
  process.exit(1);
}

// SHA-256 of the patched engine per role, recorded when the patches were verified in game.
const EXPECTED = {
  "61192df377020627f52fa7e9fd28047bd53662aa46e5e3cd6e7fad0c5c35cc98": {
    solo: "886c6e9001bd4e27df75f45bb852511aba0714993cb48d12f0e9f2d189d700b6",
    host: "886c6e9001bd4e27df75f45bb852511aba0714993cb48d12f0e9f2d189d700b6",
    guest: "8e4e28a7c53c7a0e0560a464af9fc9f8ddf64aaa7544afb74072040810945b47",
  },
};

for (const role of ["solo", "host", "guest"]) {
  const patched = patchEngine(engine, build, role === "solo" ? null : role);
  assert.ok(WebAssembly.validate(patched), `${role}: patched engine is not valid wasm`);
  const digest = sha256(patched);
  const expected = EXPECTED[hash]?.[role];
  if (expected) assert.equal(digest, expected, `${role}: patched engine changed`);
  console.log(`ok  ${role.padEnd(5)} ${digest}`);
}
