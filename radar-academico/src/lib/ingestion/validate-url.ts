import { isIP } from "node:net";
import type { OfficialSource } from "./types";
import { safeRequest } from "./safe-request";

const blockedHosts = new Set([
  "bit.ly", "tinyurl.com", "t.co", "linktr.ee", "instagram.com", "www.instagram.com",
  "linkedin.com", "www.linkedin.com", "dropbox.com", "www.dropbox.com",
  "notion.so", "www.notion.so", "drive.google.com",
]);

function normalizedHost(hostname: string) {
  return hostname.toLowerCase().replace(/\.$/, "");
}

export function isAllowedHostname(host: string): boolean {
  return host.length <= 253 && !isLocalHost(host) &&
    /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(host) &&
    !host.endsWith(".local") && !host.endsWith(".internal") && !host.endsWith(".test");
}

function isLocalHost(hostname: string) {
  const host = normalizedHost(hostname);
  return host === "localhost" || host.endsWith(".localhost") || host === "::1" ||
    host.startsWith("127.") || host.startsWith("10.") || host.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) || host === "0.0.0.0";
}

export function isOfficialSourceUrl(
  input: string,
  registry: OfficialSource[],
  _production = process.env.NODE_ENV === "production",
): boolean {
  void _production; // Local/private destinations are blocked in every environment.
  try {
    const url = new URL(input);
    const host = normalizedHost(url.hostname);
    if (url.protocol !== "https:" || url.port && url.port !== "443" || url.username || url.password) return false;
    if (isIP(host.replace(/^\[|\]$/g, "")) !== 0 || blockedHosts.has(host) || !isAllowedHostname(host)) return false;
    if (isLocalHost(host)) return false;

    return registry.some((source) =>
      source.active &&
      source.allowedDomains.some((domain) => normalizedHost(domain) === host) &&
      source.allowedPathPrefixes.some((prefix) => url.pathname.startsWith(prefix)),
    );
  } catch {
    return false;
  }
}

export function canStoreExternalApplicationUrl(params: {
  applicationUrl: string;
  primaryOfficialUrl: string;
  source: OfficialSource;
}) {
  if (!isOfficialSourceUrl(params.primaryOfficialUrl, [params.source])) return false;
  try {
    const application = new URL(params.applicationUrl);
    return application.protocol === "https:" && !application.username && !application.password;
  } catch {
    return false;
  }
}

export async function resolveAndValidateOfficialUrl(
  input: string,
  source: OfficialSource,
  fetcher: typeof fetch = (url, init) => safeRequest(String(url), {}, 0, init?.method ?? "HEAD"),
) {
  let current = input;
  const visited = new Set<string>();
  for (let redirects = 0; redirects <= 5; redirects += 1) {
    if (!isOfficialSourceUrl(current, [source])) return { ok: false, reason: "Redirecionamento externo ou URL não autorizada" };
    if (visited.has(current)) return { ok: false, reason: "Ciclo de redirecionamento" };
    visited.add(current);
    const response = await fetcher(current, { method: "HEAD", redirect: "manual", signal: AbortSignal.timeout(10_000) });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location || redirects === 5) return { ok: false, reason: "Limite de redirecionamentos ou destino inválido" };
      current = new URL(location, current).toString();
      continue;
    }
    return { ok: response.ok, finalUrl: current, reason: response.ok ? undefined : "Fonte indisponível" };
  }
  return { ok: false, reason: "Limite de redirecionamentos" };
}
