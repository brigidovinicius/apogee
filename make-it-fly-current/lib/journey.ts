import "server-only";

import { createHmac } from "node:crypto";
import { ApplicationError, readApplicationConfig } from "@/lib/applications";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EVENT_NAMES = new Set([
  "page_view", "section_view", "scroll_depth", "cta_click", "form_view",
  "form_started", "form_step_completed", "form_validation_error",
  "form_submit_started", "form_submit_succeeded", "form_submit_failed",
]);
const RESPONSE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow",
};

type Environment = Record<string, string | undefined>;
type Fetcher = typeof fetch;
type JourneyEvent = {
  eventId: string;
  journeyId: string;
  eventName: string;
  path: "/" | "/participar";
  context: string;
  step: number | null;
  device: "mobile" | "desktop";
};

function validateEvent(value: unknown): JourneyEvent {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ApplicationError(400, "Evento inválido.");
  const item = value as Record<string, unknown>;
  const allowed = new Set(["eventId", "journeyId", "eventName", "path", "context", "step", "device"]);
  if (Object.keys(item).some((key) => !allowed.has(key))) throw new ApplicationError(400, "Evento inválido.");
  if (!UUID.test(String(item.eventId)) || !UUID.test(String(item.journeyId))) throw new ApplicationError(400, "Evento inválido.");
  if (typeof item.eventName !== "string" || !EVENT_NAMES.has(item.eventName)) throw new ApplicationError(400, "Evento inválido.");
  if (item.path !== "/" && item.path !== "/participar") throw new ApplicationError(400, "Evento inválido.");
  if (typeof item.context !== "string" || item.context.length > 160 || !/^[a-z0-9_,.\-]*$/.test(item.context)) throw new ApplicationError(400, "Evento inválido.");
  if (item.step !== null && (typeof item.step !== "number" || !Number.isInteger(item.step) || item.step < 1 || item.step > 3)) throw new ApplicationError(400, "Evento inválido.");
  if (item.device !== "mobile" && item.device !== "desktop") throw new ApplicationError(400, "Evento inválido.");
  return item as JourneyEvent;
}

async function readEvents(request: Request) {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") throw new ApplicationError(415, "Formato inválido.");
  if (Number(request.headers.get("content-length")) > 12 * 1024) throw new ApplicationError(413, "Eventos excedem o tamanho permitido.");
  const body = await request.text();
  if (Buffer.byteLength(body) > 12 * 1024) throw new ApplicationError(413, "Eventos excedem o tamanho permitido.");
  let parsed: unknown;
  try { parsed = JSON.parse(body); } catch { throw new ApplicationError(400, "Eventos inválidos."); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || Object.keys(parsed).some((key) => key !== "events")) throw new ApplicationError(400, "Eventos inválidos.");
  const events = (parsed as { events?: unknown }).events;
  if (!Array.isArray(events) || !events.length || events.length > 20) throw new ApplicationError(400, "Eventos inválidos.");
  return events.map(validateEvent);
}

export function createJourneyRateLimiter(limit = 60, windowMs = 600_000) {
  const buckets = new Map<string, { count: number; expires: number }>();
  return (key: string, now: number) => {
    for (const [storedKey, bucket] of buckets) if (bucket.expires <= now) buckets.delete(storedKey);
    const bucket = buckets.get(key);
    if (bucket) {
      if (bucket.count >= limit) return false;
      bucket.count += 1;
      return true;
    }
    if (buckets.size >= 5000) return false;
    buckets.set(key, { count: 1, expires: now + windowMs });
    return true;
  };
}

const journeyRateLimiter = createJourneyRateLimiter();

function rateKey(request: Request, config: ReturnType<typeof readApplicationConfig>) {
  const header = config.hostingProvider === "vercel" ? "x-vercel-forwarded-for" : config.hostingProvider === "netlify" ? "x-nf-client-connection-ip" : null;
  const ip = (header ? request.headers.get(header) || "unknown" : "unknown").split(",")[0].trim().slice(0, 200);
  return createHmac("sha256", config.signingSecret).update(`makeitfly:journey-rate:${ip}`).digest("hex");
}

function databaseHeaders(databaseKey: string) {
  const headers: Record<string, string> = { apikey: databaseKey, "Content-Type": "application/json", Prefer: "resolution=ignore-duplicates,return=minimal" };
  if (!databaseKey.startsWith("sb_secret_")) headers.Authorization = `Bearer ${databaseKey}`;
  return headers;
}

async function syncEventsToSheet(events: JourneyEvent[], receivedAt: string, webhookUrl: string, webhookSecret: string, fetcher: Fetcher) {
  if (!webhookUrl) return;
  try {
    await fetcher(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ kind: "journey_events", webhookSecret, events: events.map((event) => ({ ...event, receivedAt })) }),
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(4000),
    });
  } catch { /* Supabase remains the source of truth. */ }
}

type HandlerOptions = {
  env?: Environment;
  fetcher?: Fetcher;
  now?: () => number;
  rateLimiter?: (key: string, now: number) => boolean;
};

export async function handleJourneyPost(request: Request, options: HandlerOptions = {}) {
  try {
    const config = readApplicationConfig(options.env ?? process.env);
    if (request.headers.get("origin") !== config.origin || request.headers.get("sec-fetch-site") === "cross-site") throw new ApplicationError(403, "Origem inválida.");
    const now = options.now?.() ?? Date.now();
    if (!(options.rateLimiter ?? journeyRateLimiter)(rateKey(request, config), now)) throw new ApplicationError(429, "Muitas tentativas.");
    const events = await readEvents(request);
    const rows = events.map((event) => ({
      id: event.eventId,
      journey_id: event.journeyId,
      event_name: event.eventName,
      path: event.path,
      context: event.context || null,
      step: event.step,
      device: event.device,
    }));
    const fetcher = options.fetcher ?? fetch;
    const response = await fetcher(`${config.supabaseUrl}/rest/v1/journey_events`, {
      method: "POST",
      headers: databaseHeaders(config.databaseKey),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(6000),
      body: JSON.stringify(rows),
    });
    if (!response.ok) throw new ApplicationError(503, "Medição indisponível.");
    await syncEventsToSheet(events, new Date(now).toISOString(), config.spreadsheetWebhookUrl, config.spreadsheetWebhookSecret, fetcher);
    return Response.json({ received: true }, { status: 202, headers: RESPONSE_HEADERS });
  } catch (error) {
    const known = error instanceof ApplicationError ? error : new ApplicationError(503, "Medição indisponível.");
    return Response.json({ error: known.message }, { status: known.status, headers: RESPONSE_HEADERS });
  }
}
