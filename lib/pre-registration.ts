import { isIP } from "node:net";

const MAX_BODY = 4096;
const WINDOW_MS = 60_000;
const clients = new Map<string, { count: number; until: number }>();
let globalWindow = { count: 0, until: 0 };

export function clientIp(headers: Headers) {
  if (process.env.TRUST_PROXY_CLIENT_IP !== "true") return null;
  const value = headers.get("x-real-ip")?.trim();
  return value && isIP(value) ? value : null;
}

function allowed(headers: Headers) {
  const now = Date.now();
  for (const [key, entry] of clients) if (entry.until <= now) clients.delete(key);
  if (globalWindow.until <= now) globalWindow = { count: 0, until: now + WINDOW_MS };
  if (globalWindow.count >= 120) return false;
  const key = clientIp(headers) ?? "unknown";
  const entry = clients.get(key) ?? { count: 0, until: now + WINDOW_MS };
  if (entry.count >= 5 || !clients.has(key) && clients.size >= 1024) return false;
  entry.count += 1;
  globalWindow.count += 1;
  clients.set(key, entry);
  return true;
}

export function validOrigin(request: Request) {
  const configured = process.env.PRE_REGISTRATION_ORIGIN;
  if (!configured) return false;
  try {
    const origin = new URL(configured);
    if (origin.origin !== configured || origin.username || origin.password) return false;
    if (origin.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && origin.protocol === "http:" && ["localhost", "127.0.0.1"].includes(origin.hostname))) return false;
    return request.headers.get("origin") === origin.origin;
  } catch { return false; }
}

export async function readRegistrationBody(request: Request, timeoutMs = 5000) {
  const length = request.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || Number(length) > MAX_BODY)) {
    void request.body?.cancel();
    throw new Error("body");
  }
  if (!request.body) throw new Error("body");
  const reader = request.body.getReader();
  let total = 0;
  const chunks: Uint8Array[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => { reject(new Error("timeout")); void reader.cancel(); }, timeoutMs);
  });
  try {
    while (true) {
      const { done, value } = await Promise.race([reader.read(), timeout]);
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BODY) throw new Error("body");
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks, total).toString("utf8")) as unknown;
  } catch (error) {
    void reader.cancel();
    throw error;
  } finally {
    clearTimeout(timer);
    reader.releaseLock();
  }
}

export function registrationFields(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("fields");
  const body = value as Record<string, unknown>;
  const limits: Record<string, number> = { page: 2048, createdAt: 40, userAgent: 512, referrer: 1024 };
  const fields: Record<string, string> = {};
  for (const [key, item] of Object.entries(body)) {
    if (key === "event" && item === "participacao_click" || key === "source" && item === "landing_page") continue;
    if (!Object.hasOwn(limits, key) || typeof item !== "string" || item.length > limits[key]) throw new Error("fields");
    fields[key] = item;
  }
  return fields;
}

export async function handlePreRegistration(request: Request) {
  const fail = (status: number) => Response.json({ ok: false, reason: "Não foi possível registrar a solicitação" }, {
    status, headers: { "Cache-Control": "no-store", ...(status === 429 ? { "Retry-After": "60" } : {}) },
  });
  if (!validOrigin(request)) return fail(403);
  if (!allowed(request.headers)) return fail(429);
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") return fail(415);
  let fields: Record<string, string>;
  try { fields = registrationFields(await readRegistrationBody(request)); }
  catch { return fail(400); }
  const webhook = process.env.SUPABASE_WEBHOOK_URL;
  try {
    if (!webhook) return fail(503);
    const url = new URL(webhook);
    if (url.protocol !== "https:" || url.username || url.password) return fail(503);
    const upstream = await fetch(url, {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(5000),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...fields, event: "participacao_click", source: "landing_page", receivedAt: new Date().toISOString(), ip: clientIp(request.headers) }),
    });
    // Never buffer or return the upstream payload, including successful bodies.
    void upstream.body?.cancel();
    if (!upstream.ok) return fail(502);
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch { return fail(502); }
}
