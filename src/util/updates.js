// Tells players when a newer release is out: an extension loaded from a folder never updates itself. Asks GitHub at
// most every six hours (its API allows 60 anonymous requests an hour per IP) and remembers the answer.
import { readSetting, saveSetting } from "./settings.js";

const LATEST = "https://api.github.com/repos/AllanLotta/bo1-zombies-coop/releases/latest";
export const UPDATE_GUIDE = "https://allanlotta.github.io/bo1-zombies-coop/#update";
export const RELAY_GUIDE = "https://allanlotta.github.io/bo1-zombies-coop/#relay";
const CHECK_EVERY_MS = 6 * 3600 * 1000;

const parts = (version) => String(version).replace(/^v/, "").split(".").map((n) => parseInt(n, 10) || 0);

export function isNewer(latest, current) {
  const a = parts(latest);
  const b = parts(current);
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  }
  return false;
}

export async function checkForUpdate(session) {
  let cached = null;
  try {
    cached = JSON.parse(readSetting("update", "null"));
  } catch {
    // ignore a broken cache
  }
  let latest = cached?.latest;
  if (!cached || Date.now() - cached.checkedAt > CHECK_EVERY_MS) {
    try {
      const response = await fetch(LATEST, { headers: { accept: "application/vnd.github+json" } });
      if (response.ok) latest = (await response.json()).tag_name;
      saveSetting("update", JSON.stringify({ checkedAt: Date.now(), latest }));
    } catch {
      return;
    }
  }
  if (latest && isNewer(latest, session.version)) session.update = { version: String(latest).replace(/^v/, ""), url: UPDATE_GUIDE };
}
