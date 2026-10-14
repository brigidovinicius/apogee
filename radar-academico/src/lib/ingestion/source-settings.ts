import { isAllowedHostname } from "./validate-url";
import { normalizeBrazilianLocation } from "@/lib/location";
import type { ExtractionMode, SourceType } from "./types";

const modes: ExtractionMode[] = ["rss", "html", "pdf", "api", "sitemap", "manual_assisted", "reference_only", "disabled"];
const sourceTypes: SourceType[] = ["federal_government", "state_government", "government_foundation", "federal_university", "state_university", "federal_institute", "public_research_institution", "official_reference"];
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
export function sourceEvidenceUrl(value: FormDataEntryValue | null, domains: string[]) {
  const urls = sourceUrls(value, domains);
  if (urls.length !== 1) throw new Error("Evidência da fonte inválida");
  return urls[0];
}
export function sourceLocation(form: FormData) {
  const normalized = normalizeBrazilianLocation({ stateCode: form.get("state_code"), cityName: form.get("city_name") });
  if (normalized.status !== "valid" || !normalized.location.stateCode) throw new Error("UF da fonte é obrigatória");
  return normalized.location;
}
export function sourceCoverage(form: FormData) {
  const scope = form.get("scope");
  if (scope === "national") {
    if (form.get("state_code") || form.get("city_name")) throw new Error("Fonte nacional não deve ter UF ou cidade");
    return { location: { stateCode: null, cityName: null }, geographicScope: ["Brasil"] };
  }
  if (scope !== "state") throw new Error("Abrangência da fonte inválida");
  return { location: sourceLocation(form), geographicScope: [] as string[] };
}
export function sourceType(value: FormDataEntryValue | null) {
  const type = String(value ?? "");
  if (!sourceTypes.includes(type as SourceType)) throw new Error("Tipo de fonte inválido");
  return type as SourceType;
}
export function sourceSettings(form: FormData) {
  const id = sourceId(form.get("id"));
  const domains = sourceDomains(form.get("domains"));
  const listingUrls = sourceUrls(form.get("listing_urls"), domains);
  const evidenceUrl = sourceEvidenceUrl(form.get("audit_evidence_url"), domains);
  const interval = Number(form.get("interval"));
  const mode = String(form.get("mode")) as ExtractionMode;
  if (!Number.isInteger(interval) || interval < 2 || interval > 720 || !modes.includes(mode)) throw new Error("Configurações inválidas");
  return { id, domains, listingUrls, evidenceUrl, interval, mode };
}
