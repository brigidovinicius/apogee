import crypto from "node:crypto";
import type { OfficialSource, OpportunityCandidate } from "./types";

const sjcDetail = /^https:\/\/servicos\.sjc\.sp\.gov\.br\/concurso\/concurso_detalhe\.aspx\?codigo=\d+$/;
const braskemDetail = "https://www.braskem.com.br/bahia-release/braskem-abre-inscricoes-para-programa-de-estagio-2027-com-mais-de-100-vagas-em-cinco-estados";

function isoDate(day: string, month: string, year: string) {
  const date = `${year}-${month}-${day}`;
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date ? date : null;
}

export function normalizeSjcInternship(input: { text: string; url: string; source: OfficialSource }, now = new Date()): OpportunityCandidate | null {
  if (input.source.id !== "sjc-open-internships" || !sjcDetail.test(input.url)) return null;
  const text = input.text.replace(/\s+/g, " ").trim();
  const edition = /PROCESSO SELETIVO PARA ESTÁGIO - ANEXO ([\p{L}]+)\s+Inscrições Abertas\s+RESUMO DO CONCURSO (\d{2})\/(20\d{2}) - ([\p{L}]+)/iu.exec(text);
  const window = /De:\s*De (\d{2})\/(\d{2})\/(20\d{2}) (\d{2}):(\d{2}) a (\d{2})\/(\d{2})\/(20\d{2}) (\d{2}):(\d{2})/i.exec(text);
  const status = /STATUS DO CONCURSO\s+(Inscrições Abertas|Inscrições Encerradas|Inscrições Suspensas)/i.exec(text);
  const requirements = /O processo seletivo destina-se ao preenchimento de vagas e cadastro reserva para estagiários, para alunos regularmente matriculados\. .*?Escolaridade exigida: (.*?) STATUS DO CONCURSO/i.exec(text);
  const route = /As inscrições e provas on-line serão realizadas\b.*?\bpelo site do CIEE\./i.exec(text);
  const amount = /Remuneração: (De R\$[\d.,]+ a R\$[\d.,]+)/i.exec(text);
  if (!edition || !window || !status || !requirements || !route || !amount || edition[1].toLowerCase() !== edition[4].toLowerCase()) return null;
  const start = isoDate(window[1], window[2], window[3]);
  const end = isoDate(window[6], window[7], window[8]);
  if (!start || !end || start > end || edition[3] !== window[8] ||
    Number(window[4]) > 23 || Number(window[5]) > 59 || Number(window[9]) > 23 || Number(window[10]) > 59) return null;
  const deadlineAt = `${end}T${window[9]}:${window[10]}:00-03:00`;
  const startAt = `${start}T${window[4]}:${window[5]}:00-03:00`;
  const opportunityStatus = /Suspensas/i.test(status[1]) ? "suspended" : /Encerradas/i.test(status[1]) ? "closed" :
    now.getTime() > Date.parse(deadlineAt) ? "closed" : now.getTime() < Date.parse(startAt) ? "upcoming" : "open";
  const deadlineEvidence = { source_url: input.url, excerpt: window[0] };
  return {
    officialSourceId: input.source.id,
    title: `Estágio da Prefeitura de São José dos Campos — ${edition[1]} ${edition[3]}`,
    institution: input.source.institutionName,
    sourcePageUrl: input.url,
    applicantType: "mixed",
    applicationRoute: "direct_student_application",
    benefitType: "internship",
    categories: ["carreira"],
    isCourse: false,
    nationallyEligible: false,
    geographicScopeKind: "unknown",
    countryCode: null,
    stateCode: null,
    cityName: null,
    deadlineAt,
    deadlinePrecision: "exact_datetime",
    requirementsText: "Estudantes regularmente matriculados em curso técnico ou superior; consulte o Anexo I do edital para as vagas e os requisitos específicos.",
    amountText: `Bolsa ${amount[1]} conforme vaga; consulte o edital oficial.`,
    reviewStatus: "needs_information",
    opportunityStatus,
    evidenceJson: {
      deadline_at: deadlineEvidence,
      opportunity_status: { source_url: input.url, excerpt: status[0] },
      application_route: { source_url: input.url, excerpt: route[0] },
      requirements: { source_url: input.url, excerpt: requirements[0].slice(0, 1000) },
      location: { source_url: input.url, excerpt: edition[0] },
    },
    extractionMethod: input.source.extractionMode,
    contentHash: crypto.createHash("sha256").update(`sjc-internship-v1\n${text}`).digest("hex"),
  };
}

export function normalizeBraskemInternship(input: { text: string; url: string; source: OfficialSource }, now = new Date()): OpportunityCandidate | null {
  if (input.source.id !== "braskem-internship-programme" || input.url !== braskemDetail) return null;
  const text = input.text.replace(/\s+/g, " ").trim();
  const edition = /Braskem abre as inscrições para a edição (2027) do seu Programa de Estágio, com a oferta de (120) vagas para estudantes universitários/i.exec(text);
  const published = /6 de Outubro de (2026)/i.exec(text);
  const deadline = /inscrições ficam abertas até (30) de outubro/i.exec(text);
  const window = /Período de inscrições:\s*1º a 30 de outubro/i.exec(text);
  const requirements = /As inscrições são destinadas a estudantes que tenham previsão de conclusão da graduação entre junho de 2028 e dezembro de 2029\./i.exec(text);
  const location = /As oportunidades estão distribuídas pelas unidades da companhia nos estados de Alagoas, Bahia, Rio de Janeiro, Rio Grande do Sul e São Paulo/i.exec(text);
  const amount = /bolsa-auxílio entre R\$ 2\.200 e R\$ 2\.800/i.exec(text);
  const route = /Os interessados têm até o dia 30 de outubro para realizar a candidatura por meio da página da iniciativa/i.exec(text);
  if (!edition || !published || !deadline || !window || !requirements || !location || !amount || !route) return null;
  const deadlineAt = `${published[1]}-10-${deadline[1]}`;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const signal = /inscrições (?:foram|estão) (suspensas|encerradas)|programa (?:foi|está) cancelado/i.exec(text);
  const opportunityStatus = /suspens/i.test(signal?.[0] ?? "") ? "suspended" :
    signal ? "closed" : deadlineAt < today ? "closed" : "open";
  const deadlineEvidence = { source_url: input.url, excerpt: `${deadline[0]}; ${window[0]}; ${published[0]}` };
  return {
    officialSourceId: input.source.id,
    title: "Programa de Estágio Braskem 2027",
    institution: input.source.institutionName,
    sourcePageUrl: input.url,
    applicantType: "undergraduate_student",
    applicationRoute: "direct_student_application",
    benefitType: "internship",
    categories: ["carreira"],
    isCourse: false,
    nationallyEligible: false,
    geographicScopeKind: "unknown",
    countryCode: null,
    stateCode: null,
    cityName: null,
    deadlineAt,
    deadlinePrecision: "date_only",
    requirementsText: "Graduandos com formatura prevista entre junho de 2028 e dezembro de 2029. Há vagas em AL, BA, RJ, RS e SP; consulte a localização e os requisitos de cada vaga na página oficial.",
    amountText: "Bolsa-auxílio de R$ 2.200 a R$ 2.800, conforme vaga, mais benefícios descritos pela Braskem.",
    reviewStatus: "needs_information",
    opportunityStatus,
    evidenceJson: {
      deadline_at: deadlineEvidence,
      opportunity_status: { source_url: input.url, excerpt: signal?.[0] ?? deadlineEvidence.excerpt },
      application_route: { source_url: input.url, excerpt: route[0] },
      requirements: { source_url: input.url, excerpt: requirements[0] },
      location: { source_url: input.url, excerpt: location[0] },
      amount: { source_url: input.url, excerpt: amount[0] },
    },
    extractionMethod: input.source.extractionMode,
    contentHash: crypto.createHash("sha256").update(`braskem-internship-v1\n${text}`).digest("hex"),
  };
}
