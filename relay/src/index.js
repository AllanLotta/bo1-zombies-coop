// Relay entry point (Cloudflare Worker). Routes every room to its own Durable Object, which forwards packets between
// the players; the Worker itself only validates requests.
import { PROTOCOL_VERSION, ROLES, ROOM_ID_PATTERN } from "../../shared/protocol.js";
import { json } from "./http.js";

export { RoomRelay } from "./room.js";
export { UsageCounter } from "./usage.js";

const allowedOrigins = (env) => String(env.ALLOWED_ORIGINS ?? "").split(",").map((o) => o.trim()).filter(Boolean);

// Browsers always send Origin with a WebSocket upgrade; command-line tools and tests usually do not.
function originAllowed(request, env) {
  const origin = request.headers.get("Origin");
  return !origin || allowedOrigins(env).includes(origin);
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin");
  if (!origin || !originAllowed(request, env)) return {};
  return { "access-control-allow-origin": origin, vary: "Origin", "access-control-allow-methods": "GET, OPTIONS" };
}

function roomFromPath(pathname) {
  const match = pathname.match(/^\/v1\/rooms\/([^/]+)$/);
  if (!match) return null;
  try {
    const room = decodeURIComponent(match[1]);
    return ROOM_ID_PATTERN.test(room) ? room : null;
  } catch {
    return null;
  }
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") return json({ ok: true, protocol: PROTOCOL_VERSION }, 200, cors);
    if (request.method === "GET" && url.pathname === "/usage") {
      const counter = env.USAGE.get(env.USAGE.idFromName("global"));
      const usage = await (await counter.fetch("https://usage/read")).json();
      return json(usage, 200, { ...cors, "cache-control": "public, max-age=60" });
    }

    const room = roomFromPath(url.pathname);
    if (!room) return json({ error: "not_found" }, 404, cors);
    if (!originAllowed(request, env)) return json({ error: "origin_not_allowed" }, 403, cors);
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") return json({ error: "websocket_upgrade_required" }, 426, cors);

    const role = url.searchParams.get("role");
    if (!ROLES.includes(role)) return json({ error: "invalid_role" }, 400, cors);
    if (Number(url.searchParams.get("v") ?? PROTOCOL_VERSION) !== PROTOCOL_VERSION) {
      return json({ error: "protocol_mismatch", protocol: PROTOCOL_VERSION }, 400, cors);
    }

    // The room object trusts these headers, so they are always set here and never taken from the client.
    const headers = new Headers(request.headers);
    headers.set("x-room", room);
    headers.set("x-role", role);
    headers.set("x-guest-id", role === "guest" ? url.searchParams.get("id") ?? "" : "");
    const stub = env.ROOM_RELAY.get(env.ROOM_RELAY.idFromName(`room:${room}`));
    return stub.fetch(new Request(request, { headers }));
  },
};
