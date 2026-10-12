import { DurableObject } from "cloudflare:workers";

// Cloudflare's free plan allows 100,000 Durable Object requests a day; incoming WebSocket messages count 20 to a
// request. Rooms report what they carried once a minute and GET /usage turns that into an estimate.
export const FREE_DAILY_REQUESTS = 100000;
export const MESSAGES_PER_REQUEST = 20;

const today = () => new Date().toISOString().slice(0, 10);

/** Single instance ("global") holding today's totals; the day key resets them at midnight UTC, like Cloudflare. */
export class UsageCounter extends DurableObject {
  async fetch(request) {
    const day = today();
    const stored = (await this.ctx.storage.get("usage")) ?? {};
    const usage = stored.day === day ? stored : { day, messages: 0, connections: 0, reports: 0 };

    if (request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      usage.messages += Math.max(0, Math.min(1e7, Number(body.messages) || 0));
      usage.connections += Math.max(0, Math.min(1e5, Number(body.connections) || 0));
      usage.reports += 1;
      await this.ctx.storage.put("usage", usage);
      return new Response(null, { status: 204 });
    }

    const requests = Math.ceil(usage.messages / MESSAGES_PER_REQUEST) + usage.connections + usage.reports;
    return Response.json({
      day,
      requests,
      limit: FREE_DAILY_REQUESTS,
      fraction: Math.min(1, requests / FREE_DAILY_REQUESTS),
      resetsAt: new Date(new Date(`${day}T00:00:00Z`).getTime() + 86400000).toISOString(),
      estimate: true,
    });
  }
}

/** Per-room tally, sent to the counter at most once a minute (each report is itself a request). */
export class UsageTally {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.messages = 0;
    this.connections = 0;
    this.since = Date.now();
  }

  add(messages, connections) {
    this.messages += messages;
    this.connections += connections;
    if (Date.now() - this.since >= 60000) this.flush();
  }

  flush() {
    const { messages, connections } = this;
    this.messages = 0;
    this.connections = 0;
    this.since = Date.now();
    if (!messages && !connections) return;
    const counter = this.env.USAGE.get(this.env.USAGE.idFromName("global"));
    const report = counter.fetch("https://usage/add", { method: "POST", body: JSON.stringify({ messages, connections }) }).catch(() => {});
    this.ctx.waitUntil(report);
  }
}
