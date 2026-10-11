import "server-only";

export type RadarEditorialSource = {
  id: string;
  name: string;
  institutionName: string;
  institutionAcronym: string;
  stateCode: string | null;
  cityName: string | null;
  geographicScope: string[];
  auditEvidenceUrl: string | null;
  allowedDomains: string[];
  listingUrls: string[];
  extractionMode: string;
  verificationStatus: "pending" | "verified" | "rejected";
  active: boolean;
  auditedAt: string | null;
};

type EditorialConfiguration = { url: string; token: string };

export type RadarReviewOpportunity = {
  id: string;
  title: string;
  institution: string;
  applicantType: string;
  applicationRoute: string;
  isCourse: boolean;
  nationallyEligible: boolean;
  stateCode: string | null;
  cityName: string | null;
  deadlineAt: string | null;
  deadlinePrecision: string;
  evidence: Record<string, { source_url: string; excerpt: string; page?: number }>;
  officialUrl: string | null;
};

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
  const geographicScope = source.geographicScope === undefined ? [] : stringList(source.geographicScope);
  if (!id || !name || !institutionName || !extractionMode || !allowedDomains || !listingUrls ||
    !geographicScope ||
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
    id, name, institutionName, institutionAcronym, stateCode, cityName, geographicScope, auditEvidenceUrl,
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

async function requestEditorialApi(init: RequestInit, resource: "sources" | "opportunities" | "import" = "sources"): Promise<Response | null> {
  const config = editorialConfiguration();
  if (!config) return null;
  try {
    const url = new URL(config.url);
    if (resource !== "sources") url.pathname = `/api/internal/editorial/${resource}`;
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    headers.set("Authorization", `Bearer ${config.token}`);
    return await fetch(url, {
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

function reviewOpportunityFrom(value: unknown): RadarReviewOpportunity | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  const id = stringValue(item.id);
  const title = stringValue(item.title);
  const institution = stringValue(item.institution);
  const applicantType = stringValue(item.applicantType);
  const applicationRoute = stringValue(item.applicationRoute);
  const deadlinePrecision = stringValue(item.deadlinePrecision);
  const officialUrl = httpsUrl(item.officialUrl);
  if (!id || !title || !institution || !applicantType || !applicationRoute || !deadlinePrecision ||
      typeof item.isCourse !== "boolean" || typeof item.nationallyEligible !== "boolean" ||
      (item.officialUrl !== null && !officialUrl) ||
      !item.evidence || typeof item.evidence !== "object" || Array.isArray(item.evidence)) return null;
  const evidence: RadarReviewOpportunity["evidence"] = {};
  for (const [field, raw] of Object.entries(item.evidence)) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const entry = raw as Record<string, unknown>;
    const sourceUrl = httpsUrl(entry.source_url);
    const excerpt = stringValue(entry.excerpt);
    if (!sourceUrl || !excerpt) return null;
    evidence[field] = { source_url: sourceUrl, excerpt,
      ...(typeof entry.page === "number" && Number.isInteger(entry.page) && entry.page > 0 ? { page: entry.page } : {}) };
  }
  return {
    id, title, institution, applicantType, applicationRoute, deadlinePrecision, officialUrl, evidence,
    isCourse: item.isCourse, nationallyEligible: item.nationallyEligible,
    stateCode: item.stateCode === null ? null : stringValue(item.stateCode),
    cityName: item.cityName === null ? null : stringValue(item.cityName),
    deadlineAt: item.deadlineAt === null ? null : stringValue(item.deadlineAt),
  };
}

export async function listRadarReviewOpportunities(): Promise<{ available: boolean; opportunities: RadarReviewOpportunity[] }> {
  const response = await requestEditorialApi({ method: "GET" }, "opportunities");
  if (!response?.ok) return { available: false, opportunities: [] };
  try {
    const payload: unknown = await response.json();
    if (typeof payload !== "object" || payload === null || !Array.isArray((payload as { opportunities?: unknown }).opportunities)) {
      return { available: false, opportunities: [] };
    }
    const opportunities = (payload as { opportunities: unknown[] }).opportunities.map(reviewOpportunityFrom);
    if (opportunities.some((item) => item === null)) return { available: false, opportunities: [] };
    return { available: true, opportunities: opportunities as RadarReviewOpportunity[] };
  } catch {
    return { available: false, opportunities: [] };
  }
}

export async function decideRadarReviewOpportunity(input: {
  id: string; decision: "approve" | "reject"; reviewer: string;
}): Promise<boolean> {
  const response = await requestEditorialApi({
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }, "opportunities");
  return response?.ok === true;
}

export async function importRadarReviewCsv(csv: string): Promise<boolean> {
  const response = await requestEditorialApi({
    method: "POST",
    headers: { "Content-Type": "text/csv; charset=utf-8" },
    body: csv,
  }, "import");
  return response?.ok === true;
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
