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
  if (precision === "continuous_flow") return "Inscrições em fluxo contínuo";
  if (!deadline) return "Prazo no edital oficial";
  const dateOnlyValue = dateOnly(deadline, precision);
  if (!dateOnlyValue) return "Prazo no edital oficial";
  const date = new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${dateOnlyValue}T12:00:00Z`));
  return `Inscrições até ${date}`;
}

function dateOnly(value: string, precision = "exact_datetime") {
  if (precision === "date_only") {
    const date = value.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
    const parsed = new Date(`${date}T12:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date ? date : null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(parsed);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function kindFromRadar(value: string, isCourse: boolean): OpportunityKind {
  if (isCourse) return "Curso";
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
  const isCourse = value.isCourse === true;
  const nationallyEligible = value.nationallyEligible === true;
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
  const deadline = deadlineAt ? dateOnly(deadlineAt, deadlinePrecision) : null;
  if (deadlinePrecision !== "continuous_flow" && !deadline) return null;

  return {
    id: `radar-${id}`,
    title,
    organization,
    kind: kindFromRadar(benefitType, isCourse),
    level: levelFromRadar(applicantType),
    location: normalizedLocation.location.cityName
      ? `${normalizedLocation.location.cityName} · ${normalizedLocation.location.stateCode}`
      : normalizedLocation.location.stateCode ?? (nationallyEligible ? "Brasil" : "Não informado na fonte pública"),
    stateCode: normalizedLocation.location.stateCode,
    cityName: normalizedLocation.location.cityName,
    nationallyEligible: nationallyEligible && normalizedLocation.location.stateCode === null,
    eligibility: stringValue(value.requirementsText) ?? "Consulte o edital oficial para os critérios de elegibilidade.",
    benefit: stringValue(value.amountText) ?? "Consulte o edital oficial para o apoio previsto.",
    summary: "Oportunidade identificada pelo Radar Acadêmico em fonte oficial e aprovada em revisão editorial.",
    deadline,
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
