import { isIP } from "node:net";
import type { OfficialSource } from "./types";

const blockedHosts = new Set([
  "bit.ly", "tinyurl.com", "t.co", "linktr.ee", "instagram.com", "www.instagram.com",
  "linkedin.com", "www.linkedin.com", "dropbox.com", "www.dropbox.com",
  "notion.so", "www.notion.so", "drive.google.com",
]);

function normalizedHost(hostname: string) {
  return hostname.toLowerCase().replace(/\.$/, "");
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
  production = process.env.NODE_ENV === "production",
): boolean {
  try {
    const url = new URL(input);
    const host = normalizedHost(url.hostname);
    if (url.protocol !== "https:" || url.username || url.password) return false;
    if (isIP(host) !== 0 || blockedHosts.has(host)) return false;
    if (production && isLocalHost(host)) return false;

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
  fetcher: typeof fetch = fetch,
) {
  if (!isOfficialSourceUrl(input, [source])) return { ok: false, reason: "URL inicial não autorizada" };
  const response = await fetcher(input, { method: "HEAD", redirect: "manual", signal: AbortSignal.timeout(10_000) });
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location");
    if (!location) return { ok: false, reason: "Redirecionamento sem destino" };
    const resolved = new URL(location, input).toString();
    if (!isOfficialSourceUrl(resolved, [source])) return { ok: false, reason: "Redirecionamento externo bloqueado" };
    return { ok: true, finalUrl: resolved };
  }
  return { ok: response.ok, finalUrl: input, reason: response.ok ? undefined : `HTTP ${response.status}` };
}