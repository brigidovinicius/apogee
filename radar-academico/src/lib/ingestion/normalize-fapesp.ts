import crypto from "node:crypto";
import type { OfficialSource, OpportunityCandidate } from "./types";

function validDate(day: string, month: string, year: string) {
  const iso = `${year}-${month}-${day}`;
  const date = new Date(`${iso}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === iso ? iso : null;
}

export function normalizeFapesp(input: { title: string; text: string; url: string; source: OfficialSource }, now = new Date()): OpportunityCandidate | null {
  if (input.source.id !== "fapesp-open-fellowships") return null;
  const url = new URL(input.url);
  if (!["fapesp.br", "www.fapesp.br"].includes(url.hostname) || !/^\/oportunidades\/[^/]+\/\d+\/$/.test(url.pathname)) return null;
  const title = input.title.split(/\s+Instituição:/i)[0].trim();
  const text = input.text.replace(/\s+/g, " ").trim();
  const deadline = /Data limite para inscrições:\s*(\d{2})\/(\d{2})\/(\d{4})/i.exec(text);
  const institution = /Unidade\/Instituição:\s*(.*?)\s+(?:Unit\/Instituition:|Unit\/Institution:)/i.exec(text);
  const contact = /E-mail para inscrições:\s*([^\s]+@[^\s]+)/i.exec(text);
  const project = /Título do projeto:\s*(.*?)\s+Project title:/i.exec(text);
  if (!/^Bolsas?\s+de\s+/i.test(title) || title.length > 180 || !deadline || !institution || !contact || !project ||
      !/FAPESP\s*\|\s*Fundo de Amparo à Pesquisa do Estado de São Paulo/i.test(text)) return null;
  const deadlineAt = validDate(deadline[1], deadline[2], deadline[3]);
  if (!deadlineAt) return null;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const amount = /Valor da bolsa:\s*(.*?)\s+Value:/i.exec(text)?.[1]?.trim();
  const deadlineEvidence = { source_url: input.url, excerpt: deadline[0] };
  const contactEvidence = { source_url: input.url, excerpt: contact[0] };
  const location = /Localização:\s*(.*?)\s+Locale:/i.exec(text);
  const applicantType = /\b(?:PD|Pós[ -]?Doutorado)\b/i.test(title) ? "graduate_professional" :
    /\b(?:Mestrado|Doutorado)\b/i.test(title) ? "postgraduate_student" : "mixed";
  return {
    officialSourceId: input.source.id,
    title,
    institution: institution[1].trim().slice(0, 200),
    sourcePageUrl: input.url,
    applicantType,
    applicationRoute: "direct_application",
    benefitType: "research_scholarship",
    categories: ["bolsas", "pesquisa"],
    isCourse: false,
    nationallyEligible: false,
    geographicScopeKind: "unknown",
    countryCode: null,
    stateCode: null,
    cityName: null,
    deadlineAt,
    deadlinePrecision: "date_only",
    requirementsText: "Consulte os requisitos específicos da bolsa e do projeto na página oficial da FAPESP.",
    amountText: amount?.slice(0, 250) || "Consulte o valor e as condições da bolsa na página oficial da FAPESP.",
    reviewStatus: "needs_information",
    opportunityStatus: deadlineAt < today ? "closed" : "open",
    evidenceJson: {
      deadline_at: deadlineEvidence,
      opportunity_status: deadlineEvidence,
      application_route: contactEvidence,
      requirements: { source_url: input.url, excerpt: `Título do projeto: ${project[1].trim()}`.slice(0, 1000) },
      ...(location ? { location: { source_url: input.url, excerpt: location[0] } } : {}),
    },
    extractionMethod: input.source.extractionMode,
    contentHash: crypto.createHash("sha256").update(`fapesp-v1\n${text}`).digest("hex"),
  };
}
