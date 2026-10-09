import { isAllowedHostname } from "./validate-url";
import type { ExtractionMode } from "./types";

const modes: ExtractionMode[] = ["rss", "html", "pdf", "api", "sitemap", "manual_assisted", "reference_only", "disabled"];
export function sourceId(value: FormDataEntryValue | null) {
  const id = String(value ?? "");
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(id)) throw new Error("Fonte inválida");
  return id;
}
export function sourceDomains(value: FormDataEntryValue | null) {
  const raw = String(value ?? "");
  if (raw.length > 4096) throw new Error("Domínios inválidos");
  const domains = [...new Set(raw.toLowerCase().split(/[\s,]+/).filter(Boolean))];
  if (!domains.length || domains.length > 20 || domains.some((host) => !isAllowedHostname(host))) throw new Error("Domínios inválidos");
  return domains;
}
export function sourceUrls(value: FormDataEntryValue | null, domains: string[]) {
  const raw = String(value ?? "");
  if (raw.length > 16_384) throw new Error("URLs inválidas");
  const urls = raw.split(/\s+/).filter(Boolean);
  if (!urls.length || urls.length > 20 || urls.some((input) => {
    try {
      const url = new URL(input);
      return input.length > 2048 || url.protocol !== "https:" || !!url.username || !!url.password ||
        !!url.hash || !!url.port && url.port !== "443" || !domains.includes(url.hostname);
    } catch { return true; }
  })) throw new Error("URLs inválidas");
  return urls;
}
export function sourceSettings(form: FormData) {
  const id = sourceId(form.get("id"));
  const domains = sourceDomains(form.get("domains"));
  const interval = Number(form.get("interval"));
  const mode = String(form.get("mode")) as ExtractionMode;
  if (!Number.isInteger(interval) || interval < 2 || interval > 720 || !modes.includes(mode)) throw new Error("Configurações inválidas");
  return { id, domains, interval, mode };
}
