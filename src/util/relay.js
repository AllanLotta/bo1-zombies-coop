// Which relay to use. Everyone in a room must be on the same one: the default, one saved in settings, or (for local
// testing only) a loopback address passed in the page URL.
import { BASE } from "../game/page.js";
import { readSetting } from "./settings.js";

export const DEFAULT_RELAY = "https://bo1z-coop-4p-relay.allanlotta.workers.dev";

/** "https://host" for a usable relay address, "" otherwise. */
export function normalizeRelay(text) {
  try {
    const url = new URL(String(text).trim());
    if (url.protocol === "wss:") url.protocol = "https:";
    return url.protocol === "https:" && url.hostname.includes(".") ? url.origin : "";
  } catch {
    return "";
  }
}

export function isLoopback(url) {
  try {
    return ["127.0.0.1", "localhost", "[::1]"].includes(new URL(url).hostname);
  } catch {
    return false;
  }
}

export function pickRelay(override) {
  if (override && isLoopback(override)) return override;
  return normalizeRelay(readSetting("relay", "")) || DEFAULT_RELAY;
}

/** The link guests open. A custom relay travels with it, so guests can switch to it with one click. */
export function inviteLink(session) {
  const relay = session.relay !== DEFAULT_RELAY && !session.relayParam ? `&relay=${encodeURIComponent(session.relay)}` : "";
  return `${location.origin}${BASE}?coop=join&coopRoom=${session.room}${session.relayParam}${relay}`;
}
