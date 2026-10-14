import { detectOpportunityStatus } from "./publication";
import crypto from "node:crypto";
import { classifyAudience } from "./classify-audience";
import { classifyApplicationRoute } from "./classify-application-route";
import { detectDeadline } from "./detect-deadline";
import { detectRetification } from "./detect-retification";
import { detectSuspension } from "./detect-suspension";
import { generateEvidence } from "./generate-evidence";
import type { BenefitType, OfficialSource, OpportunityCandidate } from "./types";
import { normalizeBrazilianLocation } from "@/lib/location";
import { normalizeSpaceApps } from "./normalize-space-apps";
import { normalizeMinCIntercambio } from "./normalize-minc-intercambio";
import { normalizeFapesp } from "./normalize-fapesp";
import { normalizeBraskemInternship, normalizeSjcInternship } from "./normalize-internships";
import { normalizeNovosValores } from "./normalize-novos-valores";
import { normalizeUfscExchange } from "./normalize-sc-priority";

const relevant = /bolsa|auxílio|monitoria|estágio|mobilidade|intercâmbio|iniciação|seleção|oportunidade|curso|qualificaç|capacitaç|oficina|formação|premiaç|prêmio|concurso cultural|desafio|hackathon|pesquisa|extensão|inovação|empreendedorismo/i;
const excluded = /licitaç|pregão|compra pública|concurso público|processo administrativo/i;

function benefit(text: string): BenefitType {
  const value = text.toLowerCase();
  if (/premiaç|prêmio|concurso cultural/.test(value)) return "prize";
  if (/financiamento|fomento|apoio a projeto/.test(value)) return "project_funding";
  if (/moradia/.test(value)) return "housing_aid";
  if (/mobilidade|intercâmbio/.test(value)) return "mobility_aid";
  if (/assistência|permanência|auxílio/.test(value)) return "financial_aid";
  if (/monitoria/.test(value)) return "monitor_scholarship";
  if (/extensão/.test(value)) return "extension_scholarship";
  if (/estágio/.test(value)) return "internship";
  if (/pesquisa|pibic|pibiti|iniciação científica/.test(value)) return "research_scholarship";
  if (/bolsa/.test(value)) return "academic_scholarship";
  return "other";
}

export function normalizeOpportunity(input: {
  title: string;
  text: string;
  url: string;
  source: OfficialSource;
}): OpportunityCandidate | null {
  if (input.source.id === "nasa-space-apps-2026") return normalizeSpaceApps(input);
  if (input.source.id === "minc-intercambio-audiovisual-2026") return normalizeMinCIntercambio(input);
  if (input.source.id === "fapesp-open-fellowships") return normalizeFapesp(input);
  if (input.source.id === "sjc-open-internships") return normalizeSjcInternship(input);
  if (input.source.id === "braskem-internship-programme") return normalizeBraskemInternship(input);
  if (input.source.id === "sed-novos-valores-2026") return normalizeNovosValores(input);
  if (["ufsc-augm-grado-2027-1", "ufsc-outgoing-2027-1"].includes(input.source.id)) return normalizeUfscExchange(input);
  const combined = `${input.title}\n${input.text}`.replace(/\s+/g, " ").trim();
  const normalizedLocation = normalizeBrazilianLocation(input.source.location ?? {});
  if (normalizedLocation.status === "invalid") return null;
  if (!relevant.test(combined) || excluded.test(combined)) return null;
  const applicantType = classifyAudience(combined);
  const applicationRoute = classifyApplicationRoute(combined);
  const deadline = detectDeadline(combined);

  if (applicationRoute === "unclear" || deadline.precision === "not_informed") return null;

  const statusSignal = detectSuspension(combined);
  // Include normalization revision so corrected extraction receives a new audit event.
  const contentHash = crypto.createHash("sha256").update(`v2\n${combined}`).digest("hex");
  const isCourse = /curso|qualificaç|capacitaç|oficina|formação profissional/i.test(input.title);
  const nationallyEligible = normalizedLocation.location.stateCode === null &&
    input.source.geographicScope.includes("Brasil") &&
    /em todo o Brasil|de todo o Brasil|todo o território nacional|de qualquer (?:estado|cidade) do Brasil|de todo o país/i.test(combined);
  return {
    officialSourceId: input.source.id,
    title: input.title.trim(),
    institution: input.source.institutionName,
    sourcePageUrl: input.url,
    applicantType,
    applicationRoute,
    benefitType: benefit(combined),
    isCourse,
    nationallyEligible,
    deadlineAt: deadline.deadlineAt,
    deadlinePrecision: deadline.precision,
    requirementsText: "Consulte a fonte oficial para os requisitos de participação.",
    amountText: "Consulte a fonte oficial para os valores e condições do benefício.",
    stateCode: normalizedLocation.location.stateCode,
    cityName: normalizedLocation.location.cityName,
    reviewStatus: "needs_information",
    opportunityStatus: statusSignal ?? detectOpportunityStatus(combined),
    evidenceJson: { ...generateEvidence(input.url, combined), opportunity_status: { source_url: input.url, excerpt: combined.slice(Math.max(0, combined.search(/inscriç(?:ão|ões)|suspens|cancelad/i)), Math.max(0, combined.search(/inscriç(?:ão|ões)|suspens|cancelad/i)) + 1000) } },
    extractionMethod: input.source.extractionMode,
    contentHash,
    hasRetification: Boolean(detectRetification(combined)),
  };
}
