// Zips the extension folder for a GitHub release or the Chrome Web Store: dist/bo1-zombies-coop.zip. The name stays the
// same across versions so .../releases/latest/download/bo1-zombies-coop.zip always works, and it unzips into a folder
// called bo1-zombies-coop with manifest.json right inside (the folder people pick in Chrome).
//   npm run build && node scripts/package.mjs
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync } from "node:fs";

const { version } = JSON.parse(readFileSync("extension/manifest.json", "utf8"));
const out = "dist/bo1-zombies-coop.zip";
mkdirSync("dist", { recursive: true });
rmSync(out, { force: true });
execFileSync("zip", ["-r", "-X", `../${out}`, ".", "-x", ".*"], { cwd: "extension", stdio: "inherit" });
console.log(`packaged ${out} (version ${version})`);
