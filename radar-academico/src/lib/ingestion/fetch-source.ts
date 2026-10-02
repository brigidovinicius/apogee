import crypto from "node:crypto";
import robotsParser from "robots-parser";
import type { OfficialSource } from "./types";
import { isOfficialSourceUrl } from "./validate-url";

const lastRequestByDomain = new Map<string, number>();
const responseCache = new Map<string, { etag?: string; modified?: string; body: Buffer }>();

function config() {
  return {
    delay: Number(process.env.INGESTION_REQUEST_DELAY_MS ?? 2000),
    maxBytes: Number(process.env.INGESTION_MAX_FILE_SIZE_MB ?? 15) * 1024 * 1024,
    contact: process.env.INGESTION_CONTACT_EMAIL ?? "contato@radar-academico.local",
    agent: process.env.INGESTION_USER_AGENT,
  };
}

async function rateLimit(host: string) {
  const wait = Math.max(0, config().delay - (Date.now() - (lastRequestByDomain.get(host) ?? 0)));
  if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
  lastRequestByDomain.set(host, Date.now());
}

async function fetchWithRetry(url: string, init: RequestInit, attempts = 3): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
    }
  }
  throw lastError;
}

export async function fetchOfficialResource(url: string, source: OfficialSource) {
  if (!isOfficialSourceUrl(url, [source])) throw new Error("URL fora do registro oficial");
  const parsed = new URL(url);
  const agent = config().agent ?? `RadarAcademicoBot/1.0 (+${config().contact})`;
  await rateLimit(parsed.hostname);

  const robotsUrl = `${parsed.origin}/robots.txt`;
  const robotsResponse = await fetchWithRetry(robotsUrl, { headers: { "User-Agent": agent }, redirect: "manual" });
  if (robotsResponse.status >= 300 && robotsResponse.status < 400) throw new Error("Redirecionamento de robots.txt exige revisão manual");
  const robotsText = robotsResponse.ok ? await robotsResponse.text() : "";
  const robots = robotsParser(robotsUrl, robotsText);
  if (!robots.isAllowed(url, agent)) throw new Error("Acesso bloqueado por robots.txt");

  const cached = responseCache.get(url);
  const headers: Record<string, string> = { "User-Agent": agent, Accept: "text/html,application/rss+xml,application/pdf;q=0.9,*/*;q=0.5" };
  if (cached?.etag) headers["If-None-Match"] = cached.etag;
  if (cached?.modified) headers["If-Modified-Since"] = cached.modified;

  const response = await fetchWithRetry(url, { headers, redirect: "manual" });
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location");
    if (!location) throw new Error("Redirecionamento sem destino");
    const redirected = new URL(location, url).toString();
    if (!isOfficialSourceUrl(redirected, [source])) throw new Error("Redirecionamento para domínio não autorizado");
    return fetchOfficialResource(redirected, source);
  }
  if (response.status === 304 && cached) return { body: cached.body, contentType: response.headers.get("content-type") ?? "", hash: crypto.createHash("sha256").update(cached.body).digest("hex"), cached: true };
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (declaredLength > config().maxBytes) throw new Error("Arquivo excede o limite configurado");
  const body = Buffer.from(await response.arrayBuffer());
  if (body.byteLength > config().maxBytes) throw new Error("Arquivo excede o limite configurado");
  responseCache.set(url, { etag: response.headers.get("etag") ?? undefined, modified: response.headers.get("last-modified") ?? undefined, body });
  return { body, contentType: response.headers.get("content-type") ?? "", hash: crypto.createHash("sha256").update(body).digest("hex"), cached: false };
}