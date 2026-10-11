import "server-only";

export type RadarEditorialSource = {
  id: string;
  name: string;
  institutionName: string;
  institutionAcronym: string;
  stateCode: string | null;
  cityName: string | null;
  auditEvidenceUrl: string | null;
  allowedDomains: string[];
  listingUrls: string[];
  extractionMode: string;
  verificationStatus: "pending" | "verified" | "rejected";
  active: boolean;
  auditedAt: string | null;
};

type EditorialConfiguration = { url: string; token: string };

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function stringList(value: unknown): string[] | null {
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : null;
}

function httpsUrl(value: unknown): string | null {
  const candidate = stringValue(value);
  if (!candidate) return null;
  try {
    return new URL(candidate).protocol === "https:" ? candidate : null;
  } catch {
    return null;
  }
}

function sourceFrom(value: unknown): RadarEditorialSource | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const verificationStatus = stringValue(source.verificationStatus);
  const id = stringValue(source.id);
  const name = stringValue(source.name);
  const institutionName = stringValue(source.institutionName);
  const institutionAcronym = typeof source.institutionAcronym === "string" ? source.institutionAcronym.trim() : "";
  const extractionMode = stringValue(source.extractionMode);
  const allowedDomains = stringList(source.allowedDomains);
  const listingUrls = stringList(source.listingUrls);
  if (!id || !name || !institutionName || !extractionMode || !allowedDomains || !listingUrls ||
    !["pending", "verified", "rejected"].includes(verificationStatus ?? "") || typeof source.active !== "boolean") {
    return null;
  }
  const stateCode = source.stateCode === null ? null : stringValue(source.stateCode);
  const cityName = source.cityName === null ? null : stringValue(source.cityName);
  const auditEvidenceUrl = source.auditEvidenceUrl === null ? null : httpsUrl(source.auditEvidenceUrl);
  const auditedAt = source.auditedAt === null ? null : stringValue(source.auditedAt);
  if ((source.stateCode !== null && !stateCode) || (source.cityName !== null && !cityName) ||
    (source.auditEvidenceUrl !== null && !auditEvidenceUrl) || (source.auditedAt !== null && !auditedAt)) {
    return null;
  }
  return {
    id, name, institutionName, institutionAcronym, stateCode, cityName, auditEvidenceUrl,
    allowedDomains, listingUrls, extractionMode,
    verificationStatus: verificationStatus as RadarEditorialSource["verificationStatus"], active: source.active, auditedAt,
  };
}

function editorialConfiguration(): EditorialConfiguration | null {
  const url = process.env.RADAR_ACADEMICO_ADMIN_API_URL;
  const token = process.env.RADAR_ACADEMICO_ADMIN_API_TOKEN;
  if (!url || !token) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" || parsed.hostname !== "radar-academico" || parsed.port !== "3000" ||
      parsed.pathname !== "/api/internal/editorial/sources" || parsed.search || parsed.hash) return null;
    return { url: parsed.toString(), token };
  } catch {
    return null;
  }
}

async function requestEditorialApi(init: RequestInit): Promise<Response | null> {
  const config = editorialConfiguration();
  if (!config) return null;
  try {
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    headers.set("Authorization", `Bearer ${config.token}`);
    return await fetch(config.url, {
      ...init,
      cache: "no-store",
      redirect: "error",
      headers,
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    return null;
  }
}

export async function listRadarEditorialSources(): Promise<{ available: boolean; sources: RadarEditorialSource[] }> {
  const response = await requestEditorialApi({ method: "GET" });
  if (!response?.ok) return { available: false, sources: [] };
  try {
    const payload: unknown = await response.json();
    if (typeof payload !== "object" || payload === null || !Array.isArray((payload as { sources?: unknown }).sources)) {
      return { available: false, sources: [] };
    }
    const sources = (payload as { sources: unknown[] }).sources.map(sourceFrom);
    if (sources.some((source) => source === null)) return { available: false, sources: [] };
    return { available: true, sources: sources as RadarEditorialSource[] };
  } catch {
    return { available: false, sources: [] };
  }
}

export type RadarEditorialMutation =
  | { action: "verify"; sourceId: string; officialSource: true; locationConfirmed: true; collectionAllowed: true }
  | { action: "set-active"; sourceId: string; active: boolean }
  | { action: "ingest"; sourceId: string; maxPages: number; maxCandidates: number };

export async function mutateRadarEditorialSource(mutation: RadarEditorialMutation): Promise<boolean> {
  const response = await requestEditorialApi({
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(mutation),
  });
  return response?.ok === true;
}
