import { localFunctionalReview, localStripeSandboxReview } from "@/lib/offer-preview";
import { REVIEW_EVENTS } from "./review-catalogue";
import { readDiscovery, stageEnd } from "./discovery";
import "server-only";
import { readEmployment } from "@/contracts/employment";
import {
  type EducationLevel,
  type OpportunityKind,
  type StudentOpportunity,
  isOpportunityCategory,
} from "@/lib/opportunities/types";
import { normalizeBrazilianLocation } from "@/lib/opportunities/location";

type RadarResponse = {
  version: number;
  opportunities: unknown;
};

const radarApiUrl = process.env.RADAR_ACADEMICO_API_URL;
const radarApiToken = process.env.RADAR_ACADEMICO_API_TOKEN;
const catalogueTimeoutMs = 4_000;
const retryableCatalogueStatuses = new Set([408, 502, 503, 504]);
const catalogueRequests = new Map<boolean, Promise<StudentOpportunity[]>>();

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
  if (precision === "not_informed") return "Prazo não informado";
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
  if (value === "employment") return "Emprego";
  if (isCourse) return "Curso";
  if (value === "mobility_aid") return "Intercâmbio";
  if (value === "financial_aid" || value === "housing_aid") return "Auxílio";
  if (value === "internship") return "Estágio";
  if (value === "prize") return "Prêmio";
  if (value === "project_funding") return "Fomento";
  if (scholarshipBenefits.has(value)) return "Bolsa";
  return "Programa";
}

function levelFromRadar(value: string): EducationLevel {
  if (value === "high_school_student") return "Ensino médio";
  if (value === "undergraduate_student") return "Graduação";
  if (value === "postgraduate_student") return "Pós-graduação";
  return "Público diverso";
}

function currentAmazonInternship(value: Record<string, unknown>, officialUrl: string, lastCheckedAt: string) {
  const posting = /^https:\/\/www\.amazon\.jobs\/en\/jobs\/(\d{5,12})\/[a-z0-9-]+$/.exec(officialUrl);
  const age = Date.now() - Date.parse(lastCheckedAt);
  return posting !== null && value.benefitType === "internship" && value.countryCode === "BR" &&
    value.opportunityStatus === "open" && value.verificationMethod === "automatic" &&
    value.deadlineAt === null && age >= 0 && age < 48 * 3600_000 &&
    value.applicationUrl === `https://www.amazon.jobs/applicant/jobs/${posting[1]}/apply`;
}

export function toOpportunity(value: unknown): StudentOpportunity | null {
  if (!isRecord(value)) return null;
  const id = stringValue(value.id);
  const title = stringValue(value.title);
  const organization = stringValue(value.institution);
  const officialUrl = stringValue(value.officialUrl);
  const lastCheckedAt = stringValue(value.lastCheckedAt);
  const employment = readEmployment(value.employment);
  const benefitType = stringValue(value.benefitType);
  if ((benefitType === "employment") !== Boolean(employment)) return null;
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
  const eventStartsAt = stringValue(value.eventStartsAt);
  const deadlineUnknown = deadlinePrecision === "not_informed";
  const discovery = readDiscovery(value.discovery);
  const hasCalendarStages = ["open", "upcoming", "closed", "result_published"].includes(String(value.opportunityStatus)) && discovery.editions.some(edition => edition.stages.some(stage => stageEnd(stage) >= Date.now()));
  if (benefitType === "employment" && (!employment || employment.workplace !== "remote" || employment.brazilEligibility !== "confirmed" || Date.parse(lastCheckedAt) > Date.now() || Date.now() - Date.parse(lastCheckedAt) >= 48 * 3600_000)) return null;
  if (deadlineUnknown && !employment && !hasCalendarStages && !currentAmazonInternship(value, officialUrl, lastCheckedAt) && (deadlineAt || !categories.includes("eventos") || !["open","closed","result_published"].includes(String(value.opportunityStatus)) || !eventStartsAt || !Number.isFinite(Date.parse(eventStartsAt)))) return null;
  if (deadlinePrecision !== "continuous_flow" && !deadlineUnknown && !deadline && !hasCalendarStages) return null;

  const editorialNature = editorialNatureFromRadar(value);
  const publishedAt = stringValue(value.publishedAt);
  return {
    id: `radar-${id}`,
    discovery, employment,
    admissionProcess: isCourse && isRecord(value.admissionProcess) &&
      stringValue(value.admissionProcess.id) && stringValue(value.admissionProcess.title)
      ? { id: stringValue(value.admissionProcess.id)!, title: stringValue(value.admissionProcess.title)! } : null,
    participationFormat: employment ? null : participationFormatFromRadar(value),
    explicitlyUnpaid: /^(?:não remunerad[oa]|sem remuneração)\b/iu.test(stringValue(value.amountText) ?? ""),
    entranceExam: entranceExamFromRadar(value),
    editorialNature,
    editorialFocus: editorialFocusFromRadar(value, editorialNature),
    financials: financialsFromRadar(value),
    title,
    organization,
    kind: kindFromRadar(benefitType, isCourse),
    categories,
    level: levelFromRadar(applicantType),
    location: employment ? employment.locationText : normalizedLocation.location.cityName
      ? `${normalizedLocation.location.cityName} · ${normalizedLocation.location.stateCode}`
      : normalizedLocation.location.stateCode ?? (nationallyEligible ? "Brasil" : "Não informado na fonte pública"),
    stateCode: normalizedLocation.location.stateCode,
    cityName: normalizedLocation.location.cityName,
    nationallyEligible: nationallyEligible && normalizedLocation.location.stateCode === null,
    eligibility: normalizePublicText(stringValue(value.requirementsText) ?? "") || "Consulte o edital oficial para os critérios de elegibilidade.",
    benefit: stringValue(value.amountText) ?? "Consulte o edital oficial para o apoio previsto.",
    summary: employment ? `Emprego ${employment.workplace === "remote" ? "remoto" : employment.workplace} com elegibilidade para residentes no Brasil confirmada na fonte oficial.` : ["closed", "result_published"].includes(String(value.opportunityStatus)) ? "Inscrições encerradas. Acompanhe as próximas etapas confirmadas." : value.opportunityStatus === "upcoming" ? "Inscrições futuras confirmadas na fonte oficial." : "Oportunidade com inscrições abertas na fonte oficial.",
    opportunityStatus: ["closed", "result_published", "upcoming"].includes(String(value.opportunityStatus)) ? value.opportunityStatus as StudentOpportunity["opportunityStatus"] : "open",
    verificationMethod: value.verificationMethod === "admin" ? "admin" : "automatic",
    deadline,
    deadlineAt: deadlinePrecision === "exact_datetime" && deadlineAt ? new Date(deadlineAt).toISOString() : null,
    eventStartsAt,
    deadlineUnknown,
    alertsAvailable: value.alertsAvailable === true,
    deadlineLabel: deadlineLabel(deadlineAt, deadlinePrecision),
    officialUrl,
    verifiedAt,
    publishedAt: publishedAt && Number.isFinite(Date.parse(publishedAt)) ? new Date(publishedAt).toISOString() : undefined,
    verificationTimestamp: new Date(value.verificationMethod === "admin" ? stringValue(value.verifiedAt) ?? lastCheckedAt : lastCheckedAt).toISOString(),
  };
}

/**
 * Reads the separate Radar service only from the Apogee server. No Radar URL
 * or credentials are exposed to browsers. Failures remain explicit.
 */
export async function listRadarOpportunities(calendar = false): Promise<StudentOpportunity[]> {
  if (localFunctionalReview() || localStripeSandboxReview()) return REVIEW_EVENTS;
  if (!radarApiUrl || !radarApiToken) throw new Error("Catálogo indisponível");

  // Share only in-flight reads of the same view. Later calls still read fresh data.
  const current = catalogueRequests.get(calendar);
  if (current) return current;
  const pending = loadRadarCatalogue(radarApiUrl, radarApiToken, calendar)
    .finally(() => catalogueRequests.delete(calendar));
  catalogueRequests.set(calendar, pending);
  return pending;
}

async function loadRadarCatalogue(apiUrl: string, token: string, calendar: boolean): Promise<StudentOpportunity[]> {
  try {
    const url = new URL(apiUrl);
    if (calendar) url.searchParams.set("view", "calendar");
    const payload = await requestRadarCatalogue(url, token);
    if (payload.version !== 3 || !Array.isArray(payload.opportunities)) throw new Error("Catálogo incompatível");

    const items = payload.opportunities.map(toOpportunity);
    if (items.some((item) => item === null)) throw new Error("Catálogo inválido");
    return items as StudentOpportunity[];
  } catch {
    throw new Error("Catálogo indisponível");
  }
}

async function requestRadarCatalogue(url: URL, token: string, retry = true): Promise<RadarResponse> {
  try {
    const response = await fetch(url.toString(), {
      cache: "no-store",
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(catalogueTimeoutMs),
    });
    if (retry && retryableCatalogueStatuses.has(response.status)) {
      await response.body?.cancel();
      return requestRadarCatalogue(url, token, false);
    }
    if (!response.ok) throw new Error("Catálogo indisponível");
    return await response.json() as RadarResponse;
  } catch (error) {
    const transportFailure = error instanceof TypeError ||
      (error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError"));
    if (retry && transportFailure) return requestRadarCatalogue(url, token, false);
    throw error;
  }
}

/** Nature is distinct from audience: postgraduate students can attend an event. */
export function editorialNatureFromRadar(value: Record<string, unknown>): StudentOpportunity["editorialNature"] {
  if (value.isCourse === true && isRecord(value.admissionProcess) && stringValue(value.admissionProcess.id)) return "formal_admission";
  const categories = Array.isArray(value.categories) ? value.categories : [];
  const title = stringValue(value.title) ?? "";
  const requirements = stringValue(value.requirementsText) ?? "";
  // Compound admission statements, never an isolated institution, degree or audience word.
  const admissionTitle = /^(?:seleção|processo seletivo|admissão|ingresso|vagas)\s+(?:(?:para|de|no|na|ao|em)\s+)?(?:(?:o|a|um|uma)\s+)?(?:(?:curso|programa)\s+de\s+)?(?:mestrado|doutorado|graduação|bacharelado|licenciatura|tecnólogo)\b/iu.test(title);
  const admissionRequirement = value.isCourse === true && /\bingresso (?:no|na|em|ao) (?:curso de |programa de )?(?:mestrado|doutorado|graduação|ensino superior)\b/iu.test(requirements);
  const degreeCourse = value.isCourse === true && /^(?:mestrado|doutorado)\b/iu.test(title) && /\b(?:inscriç|seleç|ingresso|vagas)/iu.test(requirements);
  const entranceExam = requirements.split(/[.;\n]/u).some((statement) => /^(?:seleção por vestibular|ingresso.*vestibular|(?:exige|requer|(?:(?:é|será)\s+)?necessári[oa]).*aprova(?:ção|do|da).*vestibular)\b/iu.test(statement.trim()));
  if (admissionTitle || admissionRequirement || degreeCourse || entranceExam) return "formal_admission";
  // Degree funding alone does not prove admission or a practical extracurricular project.
  const degreeFunding = ["academic_scholarship", "research_scholarship"].includes(String(value.benefitType)) && /^bolsas?(?: de)? (?:mestrado|doutorado)\b/iu.test(title);
  if (degreeFunding) return "unclassified";
  if (value.isCourse !== true && (categories.some((category) => ["eventos", "competicoes"].includes(String(category))) || isExtracurricularProject(value))) return "extracurricular";
  if (value.isCourse !== true && categories.some((category) => ["pesquisa", "carreira", "intercambios"].includes(String(category)))) return "extracurricular";
  return "unclassified";
}

function isExtracurricularProject(value: Record<string, unknown>) {
  if (value.isCourse === true) return false;
  if (value.benefitType === "extension_scholarship") return true;
  const context = `${stringValue(value.title) ?? ""}\n${stringValue(value.requirementsText) ?? ""}`;
  // A generic research project or scholarship does not establish a practical student activity.
  return /\bprojetos?\s+(?:extracurricular(?:es)?\b|de\s+(?:extensão|voluntariado|iniciação\s+(?:científica|tecnológica))\b)|\bprogramas?\s+de\s+(?:extensão|voluntariado|empreendedorismo|aceleração|incubação|inovação)\b/iu.test(context);
}

/** Events and concrete projects precede generic research/career funding in the member feed. */
function editorialFocusFromRadar(value: Record<string, unknown>, nature: StudentOpportunity["editorialNature"]): StudentOpportunity["editorialFocus"] {
  if (nature !== "extracurricular") return null;
  const categories = Array.isArray(value.categories) ? value.categories : [];
  if (categories.some((category) => ["eventos", "competicoes"].includes(String(category)))) return "event_or_competition";
  return isExtracurricularProject(value) ? "extracurricular_project" : null;
}

/** amountText is legacy prose. Ambiguous or mixed statements remain ordinary notes. */
export function financialsFromRadar(value: Record<string, unknown>): NonNullable<StudentOpportunity["financials"]> {
  const financials: NonNullable<StudentOpportunity["financials"]> = { benefits: [], costs: [], notes: [] };
  const employment = readEmployment(value.employment);
  if (employment?.salary) return { benefits: [{ label: "REMUNERAÇÃO", text: `${employment.salary.currency} ${employment.salary.min}–${employment.salary.max} / ${employment.salary.interval}` }], costs: [], notes: [] };
  const text = stringValue(value.amountText) ?? "";
  const benefitType = stringValue(value.benefitType);
  const stipend = ["research_scholarship", "extension_scholarship", "monitor_scholarship"].includes(benefitType ?? "");
  // A total denominated in currency may still describe products/services.
  // Keep an explicitly unconfirmed prize nature out of cash-benefit labels.
  const prizeNatureUnconfirmed = /natureza[^.!?]{0,100}(?:prêmios?|premiação)[^.!?]{0,100}(?:depend|não (?:confirmad|informad|especificad))|(?:prêmios?|premiação)[^.!?]{0,100}natureza[^.!?]{0,100}(?:depend|não (?:confirmad|informad|especificad))/iu.test(text);
  const deniesCash = (statement: string) => /\b(?:sem|não há|não haverá)\s+(?:premiação|prêmios?|remuneração|bolsa|pagamento)\b/iu.test(statement) || /a confirmar|estimad|não (?:(?:é|são|foi|foram|será|serão|está|estão) )?(?:há|haverá|tem|terá|oferece|prevê|inclui|existe|garante|assegura|promete|anuncia|divulga|confirma|informa|garantid[oa]|assegurad[oa]|anunciad[oa]|divulgad[oa]|confirmad[oa]|informad[oa]).*?(?:premia|prêmio|remunera|bolsa|pagamento)/iu.test(statement) ||
    /(?:premia|prêmio|remunera|bolsa|pagamento).*?não (?:(?:é|são|foi|foram|será|serão|está|estão) )?(?:oferecid|em dinheiro|garantid|confirmad|comprovad|informad|anunciad)|(?:sem (?:garantia|previsão|confirmação|informação) (?:de|sobre)|nenhum[ao]?).*?(?:premia|prêmio|remunera|bolsa|pagamento)/iu.test(statement);
  // Split sentences, preserving decimals, ranges, periodicity, recipients and total-prize conditions.
  const clauses = text.split(/(?<=[.!?])\s+(?=[A-ZÀ-Ý])|[;\n]\s*(?=(?:Inscriç|Ingresso|Taxa|Participaç|Premiaç|Remuneraç|Bolsa))|\s+e\s+(?=inscrição|ingresso|taxa de inscrição)|,\s+(?=inscrição|ingresso|taxa de inscrição)/iu).filter(Boolean);
  for (const clause of clauses) {
    const cost = /^(?:(?:valor|custo) (?:da inscrição|do ingresso|de participação)|inscriç(?:ão|ões)|ingressos?|taxas?|participação (?:gratuita|paga)|curso gratuito)\b/iu.test(clause);
    const incomeWords = /\b(?:bolsa(?:-auxílio)?|remunera(?:ção|do|da)|salário|premiação|pagamento)\b/iu;
    const denied = deniesCash(clause) || /(?:premiação|remuneração|bolsa|pagamento|apoio financeiro).*?(?:não (?:confirmad|comprovad|informad)|sem (?:confirmação|comprovação))|(?:sem|não há) (?:premiação|remuneração|bolsa)/iu.test(clause);
    const nonCash = /\b(?:desconto|reembolso|isenção|produtos?|equipamentos?|troféu|crédito|custeio|passagens|hospedagem)\b/iu.test(clause);
    const hasMoney = /(?:R\$|US\$|USD|EUR|BRL|GBP|€|£)\s*\d/u.test(clause);
    const moneyPrize = !prizeNatureUnconfirmed && (/(?:premiação|prêmio) (?:financeir[oa]|em dinheiro)/iu.test(clause) || hasMoney && /^(?:premiação|prêmio)(?: total)?(?: em dinheiro)?(?: de|:)?\s/iu.test(clause) || benefitType === "prize" && hasMoney);
    const salary = /^(?:remuneração|remunerad[oa]|salário|pagamento)\b/iu.test(clause);
    const scholarship = (scholarshipBenefits.has(benefitType ?? "") || benefitType === "internship") && /^(?:(?:até|de|entre|a partir de)\s+)?(?:bolsa|R\$|BRL|US\$|USD|EUR|GBP|€|£)/iu.test(clause);
    const mixedCost = !cost && /\b(?:inscrição|ingresso|taxa)\b/iu.test(clause);
    if (cost && (!incomeWords.test(clause) || denied)) {
      financials.costs.push(clause);
    } else if (!cost && !mixedCost && !denied && !nonCash && (salary || scholarship && hasMoney || moneyPrize)) {
      const label = moneyPrize || benefitType === "prize" ? /(?:premiação|prêmio) total|total.*(?:premiação|prêmio)/iu.test(clause) ? "PREMIAÇÃO TOTAL" : "PREMIAÇÃO"
        : scholarship ? "BOLSA" : "REMUNERAÇÃO";
      const amountUnspecified = !hasMoney && !/\d|valor.*(?:não divulgad|não informad)/iu.test(clause);
      financials.benefits.push({ label, text: amountUnspecified ? `${clause} · Valor não divulgado` : clause });
    } else {
      financials.notes.push(clause);
    }
  }
  if (!financials.benefits.length && stipend && !deniesCash(text) && !/a confirmar|não (?:há|confirmad|comprovad)|sem (?:bolsa|remuneração)|desconto|reembolso|isenção|produtos?/iu.test(text)) {
    financials.benefits.push({ label: "BOLSA", text: "Bolsa · Valor não divulgado" });
  }
  return financials;
}

/** Conservative presentation cleanup; original evidence and stored text remain intact. */
export function normalizePublicText(text: string) {
  return text.replace(/\s+/gu, " ").replace(/:\s*\./gu, ".").replace(/([.!?;])\1+/gu, "$1").trim();
}

export function entranceExamFromRadar(value: Record<string, unknown>) {
  if (value.isCourse === true && isRecord(value.admissionProcess) && stringValue(value.admissionProcess.id)) return true;
  const title = stringValue(value.title) ?? "";
  const requirements = stringValue(value.requirementsText) ?? "";
  const explicitTitle = /^(?:vestibular|(?:processo seletivo|ingresso)\s+(?:por|via)\s+vestibular)\b/iu.test(title);
  const explicitRule = requirements.split(/[.;\n]/u).some((statement) => /^(?:seleção por (?:vestibular|prova|exame de classificação)|ingresso.*vestibular|(?:exige|requer|(?:(?:é|será)\s+)?necessári[oa]).*aprova(?:ção|do|da).*vestibular)\b/iu.test(statement.trim()));
  return explicitTitle || explicitRule;
}

/** Only an explicit modality statement in verified requirements, never an online application URL. */
export function participationFormatFromRadar(value: Record<string, unknown>): StudentOpportunity["participationFormat"] {
  const text = stringValue(value.requirementsText) ?? "";
  const matches = [...text.matchAll(/\b(?:modalidade|formato|oferta|participação|evento|encontro|etapa|realização)\s*(?::|é|em)?\s+(online|on-line|a distância|ead|presencial|híbrido|híbrida)\b/giu)]
    .map(match => /híbr/i.test(match[1]) ? "hibrido" as const : /presencial/i.test(match[1]) ? "presencial" as const : "online" as const);
  const distinct = [...new Set(matches)];
  return distinct.length === 1 ? distinct[0] : null;
}
