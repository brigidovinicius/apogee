import "server-only";
import {
  type EducationLevel,
  type OpportunityKind,
  type StudentOpportunity,
  isOpportunityCategory,
  isAdvancedAcademicTitle,
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
  if (value === "financial_aid" || value === "housing_aid") return "Auxílio";
  if (value === "internship") return "Estágio";
  if (value === "prize") return "Prêmio";
  if (value === "project_funding") return "Fomento";
  if (scholarshipBenefits.has(value)) return "Bolsa";
  return "Programa";
}

function levelFromRadar(value: string, title: string): EducationLevel {
  if (value === "high_school_student") return "Ensino médio";
  if (value === "undergraduate_student") return "Graduação";
  if (value === "postgraduate_student" || isAdvancedAcademicTitle(title)) return "Pós-graduação";
  return "Público diverso";
}

export function toOpportunity(value: unknown): StudentOpportunity | null {
  if (!isRecord(value)) return null;
  const id = stringValue(value.id);
  const title = stringValue(value.title);
  const organization = stringValue(value.institution);
  const officialUrl = stringValue(value.officialUrl);
  const lastCheckedAt = stringValue(value.lastCheckedAt);
  const benefitType = stringValue(value.benefitType);
  const isCourse = value.isCourse === true;
  const categories = Array.isArray(value.categories) && value.categories.every(isOpportunityCategory)
    ? [...new Set(value.categories)] : null;
  const nationallyEligible = value.nationallyEligible === true;
  const applicantType = stringValue(value.applicantType);
  const deadlineAt = value.deadlineAt === null ? null : stringValue(value.deadlineAt);
  const deadlinePrecision = stringValue(value.deadlinePrecision) ?? "date_only";
  const normalizedLocation = normalizeBrazilianLocation({
    stateCode: value.stateCode,
    cityName: value.cityName,
  });

  if (!id || !title || !organization || !officialUrl || !lastCheckedAt || !benefitType || !applicantType || !categories || !isHttpsUrl(officialUrl)) {
    return null;
  }

  const verifiedAt = dateOnly(value.verificationMethod === "admin" ? stringValue(value.verifiedAt) ?? lastCheckedAt : lastCheckedAt);
  if (!verifiedAt) return null;
  const deadline = deadlineAt ? dateOnly(deadlineAt, deadlinePrecision) : null;
  if (deadlinePrecision !== "continuous_flow" && !deadline) return null;

  return {
    id: `radar-${id}`,
    title,
    organization,
    kind: kindFromRadar(benefitType, isCourse),
    categories,
    level: levelFromRadar(applicantType, title),
    location: normalizedLocation.location.cityName
      ? `${normalizedLocation.location.cityName} · ${normalizedLocation.location.stateCode}`
      : normalizedLocation.location.stateCode ?? (nationallyEligible ? "Brasil" : "Não informado na fonte pública"),
    stateCode: normalizedLocation.location.stateCode,
    cityName: normalizedLocation.location.cityName,
    nationallyEligible: nationallyEligible && normalizedLocation.location.stateCode === null,
    eligibility: stringValue(value.requirementsText) ?? "Consulte o edital oficial para os critérios de elegibilidade.",
    benefit: stringValue(value.amountText) ?? "Consulte o edital oficial para o apoio previsto.",
    summary: value.opportunityStatus === "upcoming" ? "Inscrições futuras confirmadas na fonte oficial." : "Oportunidade com inscrições abertas na fonte oficial.",
    opportunityStatus: value.opportunityStatus === "upcoming" ? "upcoming" : "open",
    verificationMethod: value.verificationMethod === "admin" ? "admin" : "automatic",
    deadline,
    deadlineLabel: deadlineLabel(deadlineAt, deadlinePrecision),
    officialUrl,
    verifiedAt,
    verificationTimestamp: new Date(value.verificationMethod === "admin" ? stringValue(value.verifiedAt) ?? lastCheckedAt : lastCheckedAt).toISOString(),
  };
}

/**
 * Reads the separate Radar service only from the Apogee server. No Radar URL
 * or credentials are exposed to browsers. Failures remain explicit.
 */
export async function listRadarOpportunities(): Promise<StudentOpportunity[]> {
  if (!radarApiUrl || !radarApiToken) throw new Error("Catálogo indisponível");

  try {
    const response = await fetch(radarApiUrl, {
      cache: "no-store",
      headers: { Accept: "application/json", Authorization: `Bearer ${radarApiToken}` },
      signal: AbortSignal.timeout(2_000),
    });
    if (!response.ok) throw new Error("Catálogo indisponível");

    const payload = await response.json() as RadarResponse;
    if (payload.version !== 3 || !Array.isArray(payload.opportunities)) throw new Error("Catálogo incompatível");

    const items = payload.opportunities.map(toOpportunity);
    if (items.some((item) => item === null)) throw new Error("Catálogo inválido");
    return items as StudentOpportunity[];
  } catch {
    throw new Error("Catálogo indisponível");
  }
}
