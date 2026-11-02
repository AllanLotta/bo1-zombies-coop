// Which relay to use. Everyone in a room must be on the same one: the default, one saved in settings, or (for local
// testing only) a loopback address passed in the page URL.
//
// A relay on the internet must be https (the page is). One on the local network (a friend running `npm run relay:lan`
// at a LAN party) may be plain http on a private address: Chrome only lets the https page reach it once that address
// is listed under chrome://flags/#unsafely-treat-insecure-origin-as-secure, as the README explains.
import { landingUrl } from "../game/page.js";
import { readSetting } from "./settings.js";

export const DEFAULT_RELAY = "https://bo1z-coop-4p-relay.allanlotta.workers.dev";

/** "https://host" (or "http://host:port" on the local network) for a usable relay address, "" otherwise. */
export function normalizeRelay(text) {
  try {
    const url = new URL(String(text).trim());
    if (url.protocol === "wss:") url.protocol = "https:";
    if (url.protocol === "ws:") url.protocol = "http:";
    if (url.protocol === "https:") return url.hostname.includes(".") ? url.origin : "";
    return url.protocol === "http:" && isPrivateHost(url.hostname) ? url.origin : "";
  } catch {
    return "";
  }
}

/** Loopback, a private IPv4 range (10/8, 172.16/12, 192.168/16, 169.254/16) or a .local / .lan / .home name. */
export function isPrivateHost(hostname) {
  const host = hostname.toLowerCase();
  if (["localhost", "127.0.0.1", "[::1]"].includes(host) || /\.(local|lan|home)$/.test(host)) return true;
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254);
}

/** A relay on this machine or the local network: no daily allowance, nothing to report under Usage. */
export const isLocalRelay = (url) => {
  try {
    return new URL(url).protocol === "http:";
  } catch {
    return false;
  }
};

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
  return `${location.origin}${landingUrl(`coop=join&coopRoom=${session.room}${session.relayParam}${relay}`)}`;
}
