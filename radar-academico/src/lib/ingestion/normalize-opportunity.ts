import crypto from "node:crypto";
import { classifyAudience } from "./classify-audience";
import { classifyApplicationRoute } from "./classify-application-route";
import { detectDeadline } from "./detect-deadline";
import { detectRetification } from "./detect-retification";
import { detectSuspension } from "./detect-suspension";
import { generateEvidence } from "./generate-evidence";
import type { BenefitType, OfficialSource, OpportunityCandidate } from "./types";

const relevant = /bolsa|auxílio|monitoria|estágio|mobilidade|intercâmbio|iniciação|seleção de bolsista|oportunidade/i;
const excluded = /licitaç|pregão|compra pública|concurso público|processo administrativo/i;

function benefit(text: string): BenefitType {
  const value = text.toLowerCase();
  if (/moradia/.test(value)) return "housing_aid";
  if (/mobilidade|intercâmbio/.test(value)) return "mobility_aid";
  if (/assistência|permanência|auxílio/.test(value)) return "financial_aid";
  if (/monitoria/.test(value)) return "monitor_scholarship";
  if (/extensão/.test(value)) return "extension_scholarship";
  if (/estágio/.test(value)) return "internship";
  if (/pesquisa|pibic|pibiti|iniciação científica/.test(value)) return "research_scholarship";
  return "other";
}

export function normalizeOpportunity(input: {
  title: string;
  text: string;
  url: string;
  source: OfficialSource;
}): OpportunityCandidate | null {
  const combined = `${input.title}\n${input.text}`.replace(/\s+/g, " ").trim();
  if (!relevant.test(combined) || excluded.test(combined)) return null;
  const applicantType = classifyAudience(combined);
  const applicationRoute = classifyApplicationRoute(combined);
  const deadline = detectDeadline(combined);
  if (["institution", "company", "professor", "researcher"].includes(applicantType)) return null;
  if (applicationRoute === "unclear" || deadline.precision === "not_informed") return null;

  const statusSignal = detectSuspension(combined);
  const contentHash = crypto.createHash("sha256").update(combined).digest("hex");
  return {
    officialSourceId: input.source.id,
    title: input.title.trim(),
    institution: input.source.institutionName,
    sourcePageUrl: input.url,
    applicantType,
    applicationRoute,
    benefitType: benefit(combined),
    deadlineAt: deadline.deadlineAt,
    deadlinePrecision: deadline.precision,
    requirementsText: "Não informado na fonte oficial. Consulte o edital.",
    amountText: "Não informado na fonte oficial. Consulte o edital.",
    reviewStatus: "pending_review",
    opportunityStatus: statusSignal ?? "unknown",
    evidenceJson: generateEvidence(input.url, combined),
    extractionMethod: input.source.extractionMode,
    contentHash,
    hasRetification: Boolean(detectRetification(combined)),
  };
}