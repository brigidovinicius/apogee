import "server-only";
import {
  type EducationLevel,
  type OpportunityKind,
  type StudentOpportunity,
} from "@/lib/opportunities/types";
import { normalizeBrazilianLocation } from "@/lib/opportunities/location";

type RadarResponse = {
  version: number;
  opportunities: unknown;
};

const radarApiUrl = process.env.RADAR_ACADEMICO_API_URL;
const radarApiToken = process.env.RADAR_ACADEMICO_API_TOKEN;

const scholarshipBenefits = new Set([
  "academic_scholarship",
  "research_scholarship",
  "extension_scholarship",
  "monitor_scholarship",
  "financial_aid",
  "housing_aid",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isHttpsUrl(value: string) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function deadlineLabel(deadline: string | null, precision: string) {
  if (!deadline || precision === "continuous_flow") return "Inscrições em fluxo contínuo";
  const parsed = new Date(deadline);
  if (Number.isNaN(parsed.getTime())) return "Prazo no edital oficial";
  const date = new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(parsed);
  return `Inscrições até ${date}`;
}

function dateOnly(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function kindFromRadar(value: string): OpportunityKind {
  if (value === "mobility_aid") return "Intercâmbio";
  if (scholarshipBenefits.has(value)) return "Bolsa";
  return "Programa";
}

function levelFromRadar(value: string): EducationLevel {
  if (value === "high_school_student") return "Ensino médio";
  if (value === "undergraduate_student") return "Graduação";
  if (value === "postgraduate_student") return "Pós-graduação";
  return "Público diverso";
}

function toOpportunity(value: unknown): StudentOpportunity | null {
  if (!isRecord(value)) return null;
  const id = stringValue(value.id);
  const title = stringValue(value.title);
  const organization = stringValue(value.institution);
  const officialUrl = stringValue(value.officialUrl);
  const lastCheckedAt = stringValue(value.lastCheckedAt);
  const benefitType = stringValue(value.benefitType);
  const applicantType = stringValue(value.applicantType);
  const deadlineAt = value.deadlineAt === null ? null : stringValue(value.deadlineAt);
  const deadlinePrecision = stringValue(value.deadlinePrecision) ?? "date_only";
  const normalizedLocation = normalizeBrazilianLocation({
    stateCode: value.stateCode,
    cityName: value.cityName,
  });

  if (!id || !title || !organization || !officialUrl || !lastCheckedAt || !benefitType || !applicantType || !isHttpsUrl(officialUrl)) {
    return null;
  }

  const verifiedAt = dateOnly(lastCheckedAt);
  if (!verifiedAt) return null;

  return {
    id: `radar-${id}`,
    title,
    organization,
    kind: kindFromRadar(benefitType),
    level: levelFromRadar(applicantType),
    location: normalizedLocation.location.cityName
      ? `${normalizedLocation.location.cityName} · ${normalizedLocation.location.stateCode}`
      : normalizedLocation.location.stateCode ?? "Não informado na fonte pública",
    stateCode: normalizedLocation.location.stateCode,
    cityName: normalizedLocation.location.cityName,
    eligibility: stringValue(value.requirementsText) ?? "Consulte o edital oficial para os critérios de elegibilidade.",
    benefit: stringValue(value.amountText) ?? "Consulte o edital oficial para o apoio previsto.",
    summary: "Oportunidade identificada pelo Radar Acadêmico em fonte oficial e aprovada em revisão editorial.",
    deadline: deadlineAt ? dateOnly(deadlineAt) : null,
    deadlineLabel: deadlineLabel(deadlineAt, deadlinePrecision),
    officialUrl,
    verifiedAt,
  };
}

/**
 * Reads the separate Radar service only from the Apogee server. No Radar URL
 * or credentials are exposed to browsers; a failure keeps the curated local
 * catalogue available instead of breaking the public mural.
 */
export async function listRadarOpportunities(): Promise<StudentOpportunity[]> {
  if (!radarApiUrl || !radarApiToken) return [];

  try {
    const response = await fetch(radarApiUrl, {
      cache: "no-store",
      headers: { Accept: "application/json", Authorization: `Bearer ${radarApiToken}` },
      signal: AbortSignal.timeout(2_000),
    });
    if (!response.ok) return [];

    const payload = await response.json() as RadarResponse;
    if (![1, 2].includes(payload.version) || !Array.isArray(payload.opportunities)) return [];

    return payload.opportunities
      .map(toOpportunity)
      .filter((opportunity): opportunity is StudentOpportunity => opportunity !== null);
  } catch {
    return [];
  }
}

export function mergeOpportunities(
  curated: readonly StudentOpportunity[],
  radar: readonly StudentOpportunity[],
): StudentOpportunity[] {
  const results = new Map<string, StudentOpportunity>();

  for (const opportunity of [...curated, ...radar]) {
    const key = opportunity.officialUrl.toLowerCase();
    results.set(key, opportunity);
  }

  return [...results.values()];
}
