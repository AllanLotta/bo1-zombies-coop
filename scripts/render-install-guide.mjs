// Screenshots for the install guide: chrome://extensions with the thing to click highlighted, in English and Portuguese.
//   node scripts/render-install-guide.mjs   -> docs/images/install/{en,pt}-{1,2,3}.png
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";

const extension = path.resolve("extension");
const BUNDLE = "com.google.chrome.for.testing";
const OUT = "docs/images/install";
mkdirSync(OUT, { recursive: true });
const HIGHLIGHT = "outline: 4px solid #e2552f; outline-offset: 5px; border-radius: 8px; box-shadow: 0 0 0 12px rgba(226,85,47,.18);";

async function shoot(lang, step, { loaded, devMode, target, clip }) {
  const profile = `/tmp/bo1-guide-${lang}-${step}`;
  rmSync(profile, { recursive: true, force: true });
  const args = [`--lang=${lang}`, "--hide-crash-restore-bubble"];
  // macOS ignores --lang: the UI follows AppleLanguages, set here for the test browser's bundle only.
  if (process.platform === "darwin") execFileSync("defaults", ["write", BUNDLE, "AppleLanguages", "-array", lang]);
  if (loaded) args.push(`--disable-extensions-except=${extension}`, `--load-extension=${extension}`);
  const ctx = await chromium.launchPersistentContext(profile, { headless: false, locale: lang, viewport: { width: 1180, height: 760 }, deviceScaleFactor: 2, args });
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  await page.goto("chrome://extensions");
  await page.waitForTimeout(1200);
  const toggle = page.locator("#devMode");
  const on = (await toggle.getAttribute("aria-pressed")) === "true" || (await toggle.evaluate((el) => el.checked));
  if (devMode !== on) await toggle.click();
  await page.waitForTimeout(800);
  await page.mouse.click(700, 600); // drop the search box's focus ring
  const element = page.locator(target).first();
  await element.evaluate((el, style) => el.setAttribute("style", `${el.getAttribute("style") ?? ""};${style}`), HIGHLIGHT);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${lang.slice(0, 2)}-${step}.png`, clip });
  await ctx.close();
}

for (const lang of ["en-US", "pt-BR"]) {
  await shoot(lang, 1, { loaded: false, devMode: false, target: "#devMode", clip: { x: 0, y: 0, width: 1180, height: 230 } });
  await shoot(lang, 2, { loaded: false, devMode: true, target: "#loadUnpacked", clip: { x: 0, y: 0, width: 1180, height: 230 } });
  await shoot(lang, 3, { loaded: true, devMode: true, target: "extensions-item", clip: { x: 0, y: 0, width: 1180, height: 470 } });
}
if (process.platform === "darwin") execFileSync("defaults", ["delete", BUNDLE, "AppleLanguages"]);
console.log("rendered install guide screenshots");
