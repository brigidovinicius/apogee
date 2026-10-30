import crypto from "node:crypto";
import * as cheerio from "cheerio";
import { confirmedTerminalStatus } from "./publication";
import { isOfficialSourceUrl } from "./validate-url";
import type { OfficialSource, OpportunityCandidate } from "./types";

export const SINTER_DISCOVERY_INDEX = "https://sinter.ufsc.br/editais-abertos/?lang=pt";

type SinterDiscoveryCall = {
  id: string; url: string; supplement: string; title: string;
  programme: RegExp; edition: RegExp; audience: RegExp;
  checks: RegExp[]; deadlinePattern: RegExp;
  applicant: OpportunityCandidate["applicantType"];
  route: OpportunityCandidate["applicationRoute"];
  benefit: OpportunityCandidate["benefitType"];
  requirements: string; conditions: string;
};

/** One record per audited 2027 selection; host institutions are not separate offers. */
export const SINTER_DISCOVERY_CALLS: readonly SinterDiscoveryCall[] = [
  {
    id: "ufsc-sinter-gestores-2027", url: SINTER_DISCOVERY_INDEX,
    supplement: "https://sinter.ufsc.br/2026/10/09/programa-escala-gestores-e-administradores-augm-2027-inscricoes-abertas/?lang=pt",
    title: "Programa Escala Gestores e Administradores AUGM 2027 — UFSC",
    programme: /^Programa Escala Gestores e Administradores AUGM 2027$/i,
    edition: /EDITAL Nº 13\/SINTER\/2026/i,
    audience: /Servidores técnico-administrativos em educação \(STAE\) da UFSC/i,
    checks: [/Programa Escala Gestores e Administradores AUGM 2027/i, /Edital Nº 13\/SINTER\/2026/i,
      /quadro permanente de servidores técnico-administrativos da UFSC há pelo menos três anos/i,
      /submeter a candidatura por meio da Plataforma Escala/i, /https:\/\/mocovi\.siu\.edu\.ar\//i],
    deadlinePattern: /Inscrição dos candidatos\s+9 de outubro a (\d{1,2}) de novembro de (2026)\b/i,
    applicant: "mixed", route: "direct_application", benefit: "other",
    requirements: "Para servidores técnico-administrativos do quadro permanente da UFSC há pelo menos três anos. Candidatura pela Plataforma Escala da AUGM, conforme o edital 13/SINTER/2026. Mobilidade em universidades parceiras em 2027. Consulte documentos, critérios de seleção no edital. Não é uma vaga de emprego nem seleção de estudantes.",
    conditions: "A notícia oficial consultada não informa valores ou cobertura das despesas da mobilidade. Consulte o edital e as condições da instituição de destino; não há remuneração ou apoio financeiro quantificado nesta ficha.",
  },
  {
    id: "ufsc-sinter-docente-2027", url: SINTER_DISCOVERY_INDEX,
    supplement: "https://sinter.ufsc.br/2026/10/01/programa-escala-docente-augm-2027-inscricoes-abertas/?lang=pt",
    title: "Programa Escala Docente AUGM 2027 — UFSC",
    programme: /^Programa Escala Docente AUGM 2027$/i,
    edition: /EDITAL Nº 12\/SINTER\/2026/i,
    audience: /Docentes do quadro permanente da UFSC/i,
    checks: [/Programa Escala Docente AUGM 2027/i, /Edital N[°º] 12\/SINTER\/2026/i,
      /docentes do quadro permanente da UFSC/i, /no mínimo cinco dias e no máximo quinze dias/i,
      /entre março e novembro de 2027/i, /pelo e-mail augm\.sinter@contato\.ufsc\.br/i, /Retificação/i],
    // 13/11 in the same article is the appeals deadline, not enrollment.
    deadlinePattern: /As inscrições deverão ser realizadas até o dia (\d{1,2}) de novembro de (2026)\b/i,
    applicant: "professor", route: "direct_application", benefit: "other",
    requirements: "Para docentes do quadro permanente da UFSC. Mobilidade de cinco a quinze dias, entre março e novembro de 2027, em universidade da AUGM. Candidatura por e-mail a augm.sinter@contato.ufsc.br, conforme o edital 12/SINTER/2026 e sua retificação. Leia os critérios e documentos oficiais antes de se candidatar. O prazo de recurso do resultado não é prazo de inscrição.",
    conditions: "Valores, remuneração e cobertura de despesas não informados na notícia oficial consultada. Confira as condições do edital e da universidade de destino; seleção não equivale a emprego.",
  },
  {
    id: "ufsc-sinter-posgrado-2027", url: SINTER_DISCOVERY_INDEX,
    supplement: "https://sinter.ufsc.br/files/2026/10/Edital_1_SINTER_PROPG_2026_-_Escala_Posgrado_2026_.pdf",
    title: "Programa Escala Posgrado AUGM 2027 — mestrado e doutorado UFSC",
    programme: /^Programa Escala Posgrado AUGM 2027$/i,
    edition: /EDITAL CONJUNTO Nº 1\/SINTER\/PROPG\/2026/i,
    audience: /Estudantes de mestrado e doutorado da UFSC/i,
    // The filename includes 2026; the signed document explicitly selects mobility in 2027.
    checks: [/EDITAL CONJUNTO Nº 1\/SINTER\/PROPG\/2026/i, /Programa Escala Post?grado AUGM 2027/i,
      /pós-graduação stricto sensu da UFSC/i,
      /mínimo de 6 créditos para mestrado e 12 créditos para doutorado/i,
      /https:\/\/mocovi\.siu\.edu\.ar\/mocovi\//i,
      /passagens aéreas de ida e volta/i, /isenção do pagamento de taxas acadêmicas/i,
      /auxílio para hospedagem e alimentação/i, /somente conceitos A ou B/i,
      /um período letivo a cursar na UFSC após seu retorno/i, /apenas uma instituição/i,
      /vedada a participação de servidores e estagiários/i,
      /passagens aéreas de ida e volta, em classe econômica/i,
      /Arcar com os custos e despesas que excedam os benefícios oferecidos, inclusive o seguro de viagem/i],
    deadlinePattern: /no período de 8 de outubro a (\d{1,2}) de novembro de (2026)\b/i,
    applicant: "postgraduate_student", route: "direct_student_application", benefit: "mobility_aid",
    requirements: "Para estudantes com matrícula ativa em mestrado ou doutorado stricto sensu da UFSC. Exige ao menos seis créditos no mestrado ou doze no doutorado, conceitos A ou B e um período letivo a cursar na UFSC após o retorno. Uma universidade de destino por candidatura. Inscrição pela Plataforma Escala da AUGM, com documentos, plano de atividades e anuências previstos no edital conjunto 1/SINTER/PROPG/2026. Servidores e estagiários da SINTER/PROPG não podem participar.",
    conditions: "Passagens aéreas de ida e volta em classe econômica oferecidas pela PROPG; isenção de taxas acadêmicas e auxílio para hospedagem e alimentação pela universidade anfitriã, conforme suas regras. Seguro de viagem e despesas que excedam os benefícios são de responsabilidade do estudante. Valores em dinheiro não informados nesta ficha; benefícios sujeitos às regras e à seleção.",
  },
];

export const sinterDiscoveryCall = (id: string) => SINTER_DISCOVERY_CALLS.find(call => call.id === id);
const clean = (value: string) => value.replace(/\s+/gu, " ").trim();

function articleText(html: string) {
  const $ = cheerio.load(html);
  $("script,style,noscript,nav,header,footer,aside").remove();
  $("p,div,h1,h2,h3,h4,li,tr,td,a").append(" ");
  return clean($("article").first().text());
}

function novemberDate(day: string, year: string) {
  const iso = `${year}-11-${day.padStart(2, "0")}`;
  const date = new Date(`${iso}T00:00:00Z`);
  if (year !== "2026" || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== iso) {
    throw new Error("Prazo SINTER inválido");
  }
  return iso;
}

export function normalizeSinterDiscoveryCall(html: string, supplement: string, source: OfficialSource, now = new Date()): OpportunityCandidate[] {
  const call = sinterDiscoveryCall(source.id);
  if (!call) return [];
  if (source.baseUrl !== call.url || source.listingUrls.length !== 1 || source.listingUrls[0] !== call.url ||
    !isOfficialSourceUrl(call.url, [source]) || !isOfficialSourceUrl(call.supplement, [source])) {
    throw new Error("URL SINTER divergente da edição auditada");
  }
  const $ = cheerio.load(html);
  $("script,style,noscript,nav,header,footer,aside").remove();
  $("p,div,h1,h2,h3,h4,li,tr,td,a").append(" ");
  const article = $("article").first();
  // Only the current-call table is eligible; historical tables cannot reactivate editions.
  const rows = article.find("table").first().find("tr").toArray().filter(row =>
    call.programme.test(clean($(row).find("td").first().text())));
  if (rows.length !== 1) throw new Error("Chamada SINTER ausente ou ambígua no índice vigente");
  const cells = $(rows[0]).find("td");
  const rowText = clean($(rows[0]).text());
  if (cells.length !== 4 || !call.edition.test(clean(cells.eq(1).text())) || !call.audience.test(clean(cells.eq(2).text()))) {
    throw new Error("Identidade ou público da chamada SINTER mudou");
  }
  const rowDate = /^(\d{1,2}) de novembro de (2026)$/.exec(clean(cells.eq(3).text()));
  // PDF.js splits the printed years into "202 6"/"202 7" and inserts a
  // space before the exact edital separator. Repair only those audited tokens;
  // the current index and the complete document must still agree.
  const document = call.supplement.endsWith(".pdf")
    ? clean(supplement).replace(/\b202\s+([67])\b/g, "202$1")
      .replace(/\b(N[°º]\s+1)\s+\/SINTER\/PROPG\//i, "$1/SINTER/PROPG/")
    : articleText(supplement);
  const documentDate = call.deadlinePattern.exec(document);
  if (!rowDate || !documentDate || !document || call.checks.some(check => !check.test(document))) {
    throw new Error("Evidência da chamada SINTER não confirmada");
  }
  const deadline = novemberDate(rowDate[1], rowDate[2]);
  if (deadline !== novemberDate(documentDate[1], documentDate[2])) throw new Error("Prazos SINTER conflitantes");
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const terminal = confirmedTerminalStatus(rowText) ?? confirmedTerminalStatus(document, call.title);
  const proof = { source_url: call.url, excerpt: rowText };
  return [{ officialSourceId: source.id, title: call.title, institution: "Universidade Federal de Santa Catarina",
    sourcePageUrl: call.supplement, applicationUrl: call.supplement,
    ...(call.supplement.endsWith(".pdf") ? { officialDocumentUrl: call.supplement } : {}),
    applicantType: call.applicant, applicationRoute: call.route, benefitType: call.benefit,
    categories: ["intercambios"], isCourse: false, nationallyEligible: false,
    geographicScopeKind: "unknown", countryCode: null, stateCode: null, cityName: null,
    deadlineAt: deadline, deadlinePrecision: "date_only", opportunityStatus: terminal ?? (today > deadline ? "closed" : "open"),
    reviewStatus: "needs_information", extractionMethod: "html", hasRetification: call.id === "ufsc-sinter-docente-2027",
    requirementsText: call.requirements, amountText: call.conditions,
    evidenceJson: { deadline_at: proof, opportunity_status: proof,
      requirements: { source_url: call.supplement, excerpt: document.slice(0, 3500) },
      supplement_deadline: { source_url: call.supplement, excerpt: documentDate[0] } },
    contentHash: crypto.createHash("sha256").update(`sinter-discovery-v1\n${source.id}\n${rowText}\n${document}`).digest("hex") }];
}

// Audited aliases retain edition identity after the organizer moves a document.
const LEAD_ALIASES: Record<string, string[]> = {"ufsc-sinter-gestores-2027": ["https://sinter.ufsc.br/files/2026/10/Edital_13_SINTER_2026_-_Escala_Gestores_y_Administradores_2027_.pdf"], "ufsc-sinter-docente-2027": ["https://sinter.ufsc.br/files/2026/10/Retificacao_EDITAL_12_SINTER_2026_Programa_Escala_Docente_2027.pdf"]};
export const sinterLeadAliases = (id: string): string[] => LEAD_ALIASES[id] ?? [];
