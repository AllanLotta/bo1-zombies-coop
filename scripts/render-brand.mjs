// Renders the extension icons and the GitHub social preview from docs/brand/*.svg (run after changing them).
//   node scripts/render-brand.mjs
import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const icon = readFileSync("docs/brand/icon.svg", "utf8");
const browser = await chromium.launch();
const page = await browser.newPage();
for (const size of [16, 32, 48, 128]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>html,body{margin:0;background:transparent}</style>${icon.replace("<svg ", `<svg width="${size}" height="${size}" `)}`);
  await page.screenshot({ path: `extension/icons/icon${size}.png`, omitBackground: true });
}
await page.setViewportSize({ width: 1280, height: 640 });
await page.goto(new URL("../docs/brand/social.html", import.meta.url).href);
await page.waitForTimeout(300);
await page.screenshot({ path: "docs/images/social-preview.png" });
await browser.close();
console.log("rendered icons and social preview");
