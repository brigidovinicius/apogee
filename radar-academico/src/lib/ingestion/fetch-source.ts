import crypto from "node:crypto";
import robotsParser from "robots-parser";
import type { OfficialSource } from "./types";
import { isOfficialSourceUrl } from "./validate-url";
import { safeRequest } from "./safe-request";
import { BoundedCache } from "./bounded-cache";

// Only the individually audited EV.G host reuses robots for at most five minutes (RFC9309 section2.4).
const evgRobotsCache = new BoundedCache<ReturnType<typeof robotsParser>>(8, 1024 * 1024, 5 * 60_000);
const lastRequestByDomain = new BoundedCache<number>(256, 256, 60_000);
const responseCache = new BoundedCache<{ etag?: string; modified?: string; contentType: string; body: Buffer }>(32, 32 * 1024 * 1024, 15 * 60_000);
export const MAX_REDIRECTS = 5;

export function boundedInteger(value: string | undefined, fallback: number, min: number, max: number) {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

async function rateLimit(host: string) {
  const delay = boundedInteger(process.env.INGESTION_REQUEST_DELAY_MS, 2000, 100, 60_000);
  const wait = Math.max(0, delay - (Date.now() - (lastRequestByDomain.get(host) ?? 0)));
  if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
  lastRequestByDomain.set(host, Date.now(), 1);
}

export async function fetchOfficialResource(initialUrl: string, source: OfficialSource, maxBytesCap?: number) {
  const configuredMaxBytes = boundedInteger(process.env.INGESTION_MAX_FILE_SIZE_MB, 15, 1, 15) * 1024 * 1024;
  const maxBytes = maxBytesCap ? Math.min(configuredMaxBytes, maxBytesCap) : configuredMaxBytes;
  const agent = process.env.INGESTION_USER_AGENT ?? `RadarAcademicoBot/1.0 (+${process.env.INGESTION_CONTACT_EMAIL ?? "contato@radar-academico.local"})`;
  let url = initialUrl;
  const visited = new Set<string>();
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    if (!isOfficialSourceUrl(url, [source])) throw new Error("URL fora do registro oficial");
    if (visited.has(url)) throw new Error("Ciclo de redirecionamento");
    visited.add(url);
    const parsed = new URL(url);
    const seaOfficialHeaderCompatibility = source.id === "sed-novos-valores-2026" && parsed.hostname === "www.sea.sc.gov.br";
    // Both exact evidence pages for this call ignore Accept-Encoding: identity.
    const ufscGzipCompatibility = source.id === "ufsc-transfers-2027-1" && (
      parsed.hostname === "dae.ufsc.br" && parsed.pathname === "/admissao-por-transferencias-e-retornos-edital/" ||
      parsed.hostname === "noticias.ufsc.br" && parsed.pathname === "/2026/10/ufsc-lanca-edital-de-transferencias-e-retornos-com-5-139-vagas/"
    );
    const robotsUrl = `${parsed.origin}/robots.txt`;
    const robotsKey = source.id === "evg-enap-open-courses" && parsed.hostname === "www.escolavirtual.gov.br" ? `${robotsUrl}|${agent}` : null;
    let robots = robotsKey ? evgRobotsCache.get(robotsKey) : undefined;
    if (!robots) {
      await rateLimit(parsed.hostname);
      const robotsResponse = await safeRequest(robotsUrl, { "User-Agent": agent }, 128 * 1024, "GET", seaOfficialHeaderCompatibility, ufscGzipCompatibility);
      // Only a real 404 permits absence; errors are never cached or reused after expiry.
      if (!robotsResponse.ok && robotsResponse.status !== 404) throw new Error("robots.txt indisponível para revisão");
      const body = robotsResponse.ok ? await robotsResponse.text() : "";
      robots = robotsParser(robotsUrl, body);
      const control = robotsResponse.headers.get("cache-control") ?? "";
      const maxAge = /\bmax-age=(\d+)/i.exec(control);
      if (robotsKey && !robotsResponse.headers.has("expires") && !robotsResponse.headers.has("age") && !/no-store|no-cache|must-revalidate/i.test(control) && (!maxAge || Number(maxAge[1]) >= 300)) {
        evgRobotsCache.set(robotsKey, robots, Math.max(1, Buffer.byteLength(body)));
      }
    }
    if (robots.isAllowed(url, agent) === false) throw new Error("Acesso bloqueado por robots.txt");

    await rateLimit(parsed.hostname);
    const cached = responseCache.get(url);
    const headers: Record<string, string> = { "User-Agent": agent, Accept: "text/html,application/rss+xml,application/pdf;q=0.9" };
    if (cached?.etag) headers["If-None-Match"] = cached.etag;
    if (cached?.modified) headers["If-Modified-Since"] = cached.modified;
    const response = await safeRequest(url, headers, maxBytes, "GET", seaOfficialHeaderCompatibility, ufscGzipCompatibility);
    // 304 is a cache response, not a redirect.
    if (response.status === 304 && cached) {
      return { body: cached.body, contentType: cached.contentType, hash: crypto.createHash("sha256").update(cached.body).digest("hex"), cached: true };
    }
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location || redirects === MAX_REDIRECTS) throw new Error("Limite de redirecionamentos ou destino inválido");
      url = new URL(location, url).toString();
      continue;
    }
    if (!response.ok) throw new Error(`Fonte oficial indisponível (HTTP ${response.status})`);
    // safeRequest enforces this cap while bytes arrive, before buffering.
    const body = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get("content-type") ?? "";
    responseCache.set(url, { etag: response.headers.get("etag") ?? undefined, modified: response.headers.get("last-modified") ?? undefined, contentType, body }, body.byteLength);
    return { body, contentType, hash: crypto.createHash("sha256").update(body).digest("hex"), cached: false };
  }
  throw new Error("Limite de redirecionamentos");
}
