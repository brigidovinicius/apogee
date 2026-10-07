import "server-only";

import { createHmac } from "node:crypto";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BODY_BYTES = 16 * 1024;
const RESPONSE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow",
};

type Environment = Record<string, string | undefined>;
type Fetcher = typeof fetch;
type Config = {
  origin: string;
  supabaseUrl: string;
  databaseKey: string;
  signingSecret: string;
  spreadsheetWebhookUrl: string;
  spreadsheetWebhookSecret: string;
  hostingProvider: "vercel" | "netlify" | "caddy" | "unknown";
};
type ValidApplication = {
  name: string;
  email: string;
  phone: string;
  age: number;
  profession: string;
  hasIdea: boolean;
  ideaDescription: string;
  hasLaptop: boolean;
  usesPaidAI: boolean;
  journeyId: string;
  idempotencyKey: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  referrer: string;
};
type StoredApplication = {
  id: string;
  created_at: string;
  eligible: boolean;
  status: "APPROVED" | "NOT_ELIGIBLE" | "CHECKOUT_STARTED" | "PURCHASED";
  payload_hash: string;
};

export class ApplicationError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
  }
}

function unavailable(): never {
  throw new ApplicationError(503, "Não foi possível concluir agora. Seus dados não foram confirmados. Tente novamente em instantes.");
}

export function readApplicationConfig(env: Environment): Config {
  try {
    const origin = new URL(env.APPLICATION_ORIGIN ?? "");
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname);
    if ((origin.protocol !== "https:" && !(origin.protocol === "http:" && local && env.NODE_ENV !== "production")) || origin.username || origin.password || origin.search || origin.hash || origin.pathname !== "/") unavailable();
    const database = new URL(env.SUPABASE_URL ?? "");
    if (database.protocol !== "https:" || !/^[a-z0-9-]+\.supabase\.co$/.test(database.hostname) || database.port || database.username || database.password || database.search || database.hash || database.pathname !== "/") unavailable();
    const databaseKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || "";
    const newSecret = /^sb_secret_[A-Za-z0-9_-]{20,}$/.test(databaseKey);
    if (!newSecret) {
      const segments = databaseKey.split(".");
      if (segments.length !== 3 || JSON.parse(Buffer.from(segments[1], "base64url").toString("utf8")).role !== "service_role") unavailable();
    }
    const signingSecret = env.APPLICATION_SIGNING_SECRET ?? "";
    if (signingSecret.length < 32 || signingSecret.length > 512) unavailable();
    let spreadsheetWebhookUrl = "";
    let spreadsheetWebhookSecret = "";
    if (env.GOOGLE_SHEETS_WEBHOOK_URL) {
      const webhook = new URL(env.GOOGLE_SHEETS_WEBHOOK_URL);
      if (webhook.protocol !== "https:" || webhook.hostname !== "script.google.com" || webhook.port || webhook.username || webhook.password || webhook.search || webhook.hash || !/^\/macros\/s\/[A-Za-z0-9_-]{20,}\/exec$/.test(webhook.pathname)) unavailable();
      spreadsheetWebhookUrl = webhook.href;
      spreadsheetWebhookSecret = env.GOOGLE_SHEETS_WEBHOOK_SECRET ?? "";
      if (spreadsheetWebhookSecret.length < 32 || spreadsheetWebhookSecret.length > 256) unavailable();
    }
    const provider = env.APPLICATION_HOSTING_PROVIDER || (env.VERCEL === "1" ? "vercel" : env.NETLIFY === "true" ? "netlify" : "unknown");
    const hostingProvider = provider === "vercel" || provider === "netlify" || provider === "caddy" ? provider : "unknown";
    return { origin: origin.origin, supabaseUrl: database.origin, databaseKey, signingSecret, spreadsheetWebhookUrl, spreadsheetWebhookSecret, hostingProvider };
  } catch {
    unavailable();
  }
}

export function validateApplication(value: unknown): ValidApplication {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ApplicationError(400, "Confira os campos e tente novamente.");
  const input = value as Record<string, unknown>;
  const errors: Record<string, string> = {};
  const allowed = new Set(["name", "email", "phone", "age", "profession", "hasIdea", "ideaDescription", "hasLaptop", "usesPaidAI", "journeyId", "idempotencyKey", "utmSource", "utmMedium", "utmCampaign", "utmContent", "referrer", "website"]);
  if (Object.keys(input).some((key) => !allowed.has(key))) throw new ApplicationError(400, "O formulário contém campos não reconhecidos. Atualize a página e tente novamente.");
  if (input.website !== undefined && input.website !== "") throw new ApplicationError(400, "Não foi possível validar este envio.");
  const text = (key: string, max: number, optional = false): string => {
    const raw = input[key];
    if (raw === undefined && optional) return "";
    if (typeof raw !== "string" || raw.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(raw)) {
      errors[key] = `Use um texto de até ${max} caracteres.`;
      return "";
    }
    return raw.trim();
  };
  const name = text("name", 120).replace(/\s+/g, " ");
  if (name.length < 2) errors.name = "Informe seu nome, com pelo menos 2 caracteres.";
  const email = text("email", 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(email)) errors.email = "Informe um e-mail válido.";
  const rawPhone = text("phone", 40);
  const phone = rawPhone.replace(/\D/g, "");
  if (!/^\+?[\d\s().-]+$/.test(rawPhone) || !/^\d{10,15}$/.test(phone)) errors.phone = "Informe um telefone com DDD, de 10 a 15 dígitos.";
  const age = input.age;
  if (typeof age !== "number" || !Number.isInteger(age) || age < 1 || age > 120) errors.age = "Informe sua idade em anos completos.";
  const profession = text("profession", 160).replace(/\s+/g, " ");
  if (profession.length < 2) errors.profession = "Informe sua profissão ou área de atuação.";
  if (typeof input.hasIdea !== "boolean") errors.hasIdea = "Escolha Sim ou Não.";
  if (typeof input.hasLaptop !== "boolean") errors.hasLaptop = "Escolha Sim ou Não.";
  if (typeof input.usesPaidAI !== "boolean") errors.usesPaidAI = "Escolha Sim ou Não.";
  const description = text("ideaDescription", 2000, true);
  const journeyId = text("journeyId", 36).toLowerCase();
  if (!UUID.test(journeyId)) errors.journeyId = "Atualize a página antes de enviar novamente.";
  const idempotencyKey = text("idempotencyKey", 36).toLowerCase();
  if (!UUID.test(idempotencyKey)) errors.idempotencyKey = "Atualize a página antes de enviar novamente.";
  const utmSource = text("utmSource", 200, true);
  const utmMedium = text("utmMedium", 200, true);
  const utmCampaign = text("utmCampaign", 200, true);
  const utmContent = text("utmContent", 200, true);
  const rawReferrer = text("referrer", 2048, true);
  let referrer = "";
  if (rawReferrer) {
    try {
      const parsed = new URL(rawReferrer);
      if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error();
      // Do not retain tokens, search terms or personal data from URL queries.
      referrer = parsed.origin;
    } catch {
      errors.referrer = "A origem da visita é inválida. Atualize a página e tente novamente.";
    }
  }
  if (Object.keys(errors).length) throw new ApplicationError(400, "Confira os campos indicados.", errors);
  return { name, email, phone, age: age as number, profession, hasIdea: input.hasIdea as boolean, ideaDescription: input.hasIdea ? description : "", hasLaptop: input.hasLaptop as boolean, usesPaidAI: input.usesPaidAI as boolean, journeyId, idempotencyKey, utmSource, utmMedium, utmCampaign, utmContent, referrer };
}

export function applicationFingerprint(application: ValidApplication, secret: string): string {
  return createHmac("sha256", secret).update("makeitfly:application:v1:").update(JSON.stringify(application)).digest("hex");
}

// Free, best-effort burst protection per warm server process, not a global quota.
// Only keyed hashes are held in memory; IP addresses are not saved to the database.
export function createApplicationRateLimiter(limit = 12, windowMs = 600_000) {
  const buckets = new Map<string, { count: number; expires: number }>();
  return (key: string, now: number): boolean => {
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

const applicationRateLimiter = createApplicationRateLimiter();

function rateLimitKey(request: Request, config: Config) {
  // Trust only the active hosting platform's own overwritten header. A caller
  // cannot select the platform by supplying a header. Unknown hosts share a bucket.
  const header = config.hostingProvider === "vercel" ? "x-vercel-forwarded-for" : config.hostingProvider === "netlify" ? "x-nf-client-connection-ip" : config.hostingProvider === "caddy" ? "x-forwarded-for" : null;
  const ip = (header ? request.headers.get(header) || "unknown" : "unknown").split(",")[0].trim().slice(0, 200);
  return createHmac("sha256", config.signingSecret).update(`makeitfly:rate:${ip}`).digest("hex");
}

async function readBody(request: Request): Promise<unknown> {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") throw new ApplicationError(415, "Envie o formulário em formato JSON.");
  if (Number(request.headers.get("content-length")) > MAX_BODY_BYTES) throw new ApplicationError(413, "O formulário excede o tamanho permitido.");
  if (!request.body) throw new ApplicationError(400, "O formulário está vazio.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new ApplicationError(413, "O formulário excede o tamanho permitido.");
      }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (error) {
    if (error instanceof ApplicationError) throw error;
    throw new ApplicationError(400, "Não foi possível ler o formulário. Tente novamente.");
  } finally {
    reader.releaseLock();
  }
}

function databaseHeaders(config: Config) {
  const headers: Record<string, string> = { apikey: config.databaseKey, "Content-Type": "application/json", Prefer: "return=representation" };
  // New secret keys are opaque API keys; only legacy service_role keys are JWTs.
  if (!config.databaseKey.startsWith("sb_secret_")) headers.Authorization = `Bearer ${config.databaseKey}`;
  return headers;
}

async function databaseRequest(config: Config, fetcher: Fetcher, query: string, init: RequestInit = {}) {
  try {
    return await fetcher(`${config.supabaseUrl}/rest/v1/applications?${query}`, {
      ...init,
      headers: databaseHeaders(config),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    unavailable();
  }
}

const RECORD_FIELDS = "id,created_at,eligible,status,payload_hash";

async function parseRecord(response: Response): Promise<StoredApplication | null> {
  if (!response.ok) unavailable();
  try {
    const rows = await response.json();
    if (!Array.isArray(rows) || rows.length > 1) unavailable();
    if (!rows.length) return null;
    const row = rows[0];
    if (!UUID.test(row.id) || typeof row.created_at !== "string" || Number.isNaN(Date.parse(row.created_at)) || typeof row.eligible !== "boolean" || !["APPROVED", "NOT_ELIGIBLE", "CHECKOUT_STARTED", "PURCHASED"].includes(row.status) || !/^[a-f0-9]{64}$/.test(row.payload_hash)) unavailable();
    return row as StoredApplication;
  } catch {
    unavailable();
  }
}

export async function saveApplication(application: ValidApplication, config: Config, fetcher: Fetcher) {
  const payloadHash = applicationFingerprint(application, config.signingSecret);
  const eligible = application.age >= 18 && application.age <= 35 && application.hasIdea && application.hasLaptop && application.usesPaidAI;
  const response = await databaseRequest(config, fetcher, `select=${RECORD_FIELDS}`, {
    method: "POST",
    body: JSON.stringify({
      name: application.name,
      email: application.email,
      phone: application.phone,
      age: application.age,
      profession: application.profession,
      has_idea: application.hasIdea,
      idea_description: application.ideaDescription || null,
      has_laptop: application.hasLaptop,
      uses_paid_ai: application.usesPaidAI,
      journey_id: application.journeyId,
      status: eligible ? "APPROVED" : "NOT_ELIGIBLE",
      utm_source: application.utmSource || null,
      utm_medium: application.utmMedium || null,
      utm_campaign: application.utmCampaign || null,
      utm_content: application.utmContent || null,
      referrer: application.referrer || null,
      idempotency_key: application.idempotencyKey,
      payload_hash: payloadHash,
    }),
  });
  const duplicate = response.status === 409;
  const record = duplicate
    ? await parseRecord(await databaseRequest(config, fetcher, `idempotency_key=eq.${application.idempotencyKey}&select=${RECORD_FIELDS}&limit=1`))
    : await parseRecord(response);
  if (!record) unavailable();
  if (record.payload_hash !== payloadHash) throw new ApplicationError(409, "Este envio já foi registrado com outros dados. Atualize a página para iniciar um novo envio.");
  if (record.eligible !== eligible) unavailable();
  return { record, duplicate };
}

async function syncApplicationToSheet(application: ValidApplication, record: StoredApplication, config: Config, fetcher: Fetcher) {
  if (!config.spreadsheetWebhookUrl) return;
  try {
    await fetcher(config.spreadsheetWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        kind: "application",
        webhookSecret: config.spreadsheetWebhookSecret,
        id: record.id,
        createdAt: record.created_at,
        name: application.name,
        email: application.email,
        phone: application.phone,
        hasIdea: application.hasIdea,
        ideaDescription: application.ideaDescription,
        usesPaidAI: application.usesPaidAI,
        eligible: record.eligible,
        utmSource: application.utmSource,
        utmMedium: application.utmMedium,
        utmCampaign: application.utmCampaign,
        utmContent: application.utmContent,
        referrer: application.referrer,
        age: application.age,
        profession: application.profession,
        hasLaptop: application.hasLaptop,
      }),
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(4000),
    });
  } catch {
    // Supabase is the source of truth. A Sheets outage must not lose or reject
    // the application; an idempotent retry can safely attempt this push again.
  }
}

type HandlerOptions = {
  env?: Environment;
  fetcher?: Fetcher;
  now?: () => number;
  rateLimiter?: (key: string, now: number) => boolean;
};

function jsonError(error: unknown) {
  const known = error instanceof ApplicationError ? error : new ApplicationError(503, "Não foi possível concluir agora. Tente novamente em instantes.");
  return Response.json({ error: known.message, ...(known.fieldErrors ? { fieldErrors: known.fieldErrors } : {}) }, {
    status: known.status,
    headers: { ...RESPONSE_HEADERS, ...(known.status === 429 ? { "Retry-After": "600" } : {}) },
  });
}

export async function handleApplicationPost(request: Request, options: HandlerOptions = {}): Promise<Response> {
  try {
    const config = readApplicationConfig(options.env ?? process.env);
    if (request.headers.get("origin") !== config.origin || request.headers.get("sec-fetch-site") === "cross-site") throw new ApplicationError(403, "Abra o formulário no site Make It Fly para continuar.");
    const now = options.now?.() ?? Date.now();
    if (!(options.rateLimiter ?? applicationRateLimiter)(rateLimitKey(request, config), now)) throw new ApplicationError(429, "Muitas tentativas em sequência. Aguarde alguns minutos antes de tentar novamente.");
    const application = validateApplication(await readBody(request));
    const fetcher = options.fetcher ?? fetch;
    const { record, duplicate } = await saveApplication(application, config, fetcher);
    await syncApplicationToSheet(application, record, config, fetcher);
    return Response.json({ received: true }, { status: duplicate ? 200 : 201, headers: RESPONSE_HEADERS });
  } catch (error) {
    return jsonError(error);
  }
}
