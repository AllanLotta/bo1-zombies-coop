// Builds extension/coop.js from src/. The pump worker is bundled first and inlined into the main bundle as a string
// (__PUMP_WORKER_SOURCE__), because a page-world content script cannot load extension files at run time.
//   node scripts/build.mjs [--watch]
import { build, context } from "esbuild";
import { readFileSync } from "node:fs";

const { version } = JSON.parse(readFileSync(new URL("../extension/manifest.json", import.meta.url)));
const banner = `// BO1 Zombies Co-op ${version} for vel.gg. Built from src/ with scripts/build.mjs; edit the sources, not this file.`;

async function workerSource() {
  const result = await build({ entryPoints: ["src/net/pump-worker.js"], bundle: true, format: "iife", target: "chrome120", write: false, legalComments: "none" });
  return result.outputFiles[0].text;
}

const options = async () => ({
  entryPoints: ["src/main.js"],
  outfile: "extension/coop.js",
  bundle: true,
  format: "iife",
  target: "chrome120",
  charset: "utf8",
  legalComments: "none",
  banner: { js: banner },
  define: { __PUMP_WORKER_SOURCE__: JSON.stringify(await workerSource()) },
});

if (process.argv.includes("--watch")) {
  const ctx = await context(await options());
  await ctx.watch();
  console.log("watching src/ (the worker is rebuilt on restart)");
} else {
  await build(await options());
  console.log("built extension/coop.js");
}
