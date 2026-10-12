// Per-browser preferences in localStorage. Every access is guarded: storage can be unavailable (private windows,
// blocked site data) and the extension must keep working with defaults.
import { createGuestId, GUEST_ID_PATTERN } from "../../shared/protocol.js";

const PREFIX = "bo1coop.";

export function readSetting(key, fallback) {
  try {
    return localStorage.getItem(PREFIX + key) ?? fallback;
  } catch {
    return fallback;
  }
}

export function saveSetting(key, value) {
  try {
    if (value === "" || value == null) localStorage.removeItem(PREFIX + key);
    else localStorage.setItem(PREFIX + key, value);
  } catch {
    // ignore
  }
}

/** This tab's guest id for a room. Kept in sessionStorage, so a reload keeps the same seat but a new tab does not. */
export function guestIdFor(room) {
  const key = `${PREFIX}guest:${room}`;
  try {
    const saved = sessionStorage.getItem(key);
    if (saved && GUEST_ID_PATTERN.test(saved)) return saved;
    const id = createGuestId();
    sessionStorage.setItem(key, id);
    return id;
  } catch {
    return createGuestId();
  }
}

/** Lobby names: letters, digits, spaces and . _ -, at most 16 characters. */
export const cleanName = (text) => String(text ?? "").replace(/[^\p{L}\p{N} _.-]/gu, "").replace(/\s+/g, " ").trim().slice(0, 16);
