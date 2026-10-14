import crypto from "node:crypto";
import type { OfficialSource, OpportunityCandidate } from "./types";

export const NOVOS_VALORES_EDITAL_URL = "https://www.sea.sc.gov.br/wp-content/uploads/2026/02/Edital-388.2026-DOE-n.-22698.pdf";

export function normalizeNovosValores(input: { text: string; url: string; source: OfficialSource }, now = new Date()): OpportunityCandidate | null {
  if (input.source.id !== "sed-novos-valores-2026" || input.url !== NOVOS_VALORES_EDITAL_URL) return null;
  const text = input.text.replace(/\s+/g, " ").trim();
  const edition = /Edital N[º°]\s*388\s+de\s+13\/02\/2026/i.exec(text);
  const deadline = /inscrições para o programa de Estágio “?novos valores”?.{0,130}?até (30\/11\/2026)/i.exec(text);
  const route = /instituições de Ensino ficarão responsáveis pela inscrição e cadastramento de todos os estudantes interessados/i.exec(text);
  const requirements = /residente no Estado de santa Catarina; ter completado 16 \(dezesseis\) anos e estar matriculado em curso regular de ensino médio, de educação profissional, de ensino superior, de educação especial/i.exec(text);
  const medium = /r\$\s*380,00.{0,75}?Ensino Médio/i.exec(text);
  const technical = /r\$\s*430,00.{0,100}?profissional/i.exec(text);
  const transport = /auxílio transporte.{0,80}?r\$\s*5,00/i.exec(text);
  if (!edition || !deadline || !route || !requirements || !medium || !technical || !transport) return null;
  const deadlineAt = "2026-11-30";
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return {
    officialSourceId: input.source.id,
    title: "Programa de Estágio Novos Valores 2026 — Santa Catarina",
    institution: input.source.institutionName, sourcePageUrl: input.url,
    applicantType: "mixed", applicationRoute: "application_via_university", benefitType: "internship",
    categories: ["carreira"], isCourse: false, nationallyEligible: false,
    countryCode: "BR", stateCode: "SC", cityName: null,
    deadlineAt, deadlinePrecision: "date_only",
    requirementsText: "Moradores de Santa Catarina com 16 anos ou mais, matriculados em ensino médio, educação profissional, EJA, educação especial ou ensino superior. A inscrição é feita pela instituição de ensino conveniada; consulte o edital para documentos e critérios.",
    amountText: "Bolsa de R$ 380,00 para ensino médio ou R$ 430,00 para educação profissional, mais auxílio-transporte de R$ 5,00 por dia útil; outros níveis conforme edital.",
    reviewStatus: "needs_information", opportunityStatus: deadlineAt >= today ? "open" : "closed",
    evidenceJson: {
      deadline_at: { source_url: input.url, excerpt: deadline[0] },
      opportunity_status: { source_url: input.url, excerpt: deadline[0] },
      application_route: { source_url: input.url, excerpt: route[0] },
      requirements: { source_url: input.url, excerpt: requirements[0] },
      amount: { source_url: input.url, excerpt: `${medium[0]}; ${technical[0]}; ${transport[0]}` },
      location: { source_url: input.url, excerpt: requirements[0] },
    },
    extractionMethod: input.source.extractionMode,
    contentHash: crypto.createHash("sha256").update(`novos-valores-v1\n${text}`).digest("hex"),
  };
}
