import crypto from "node:crypto";
import * as cheerio from "cheerio";
import { confirmedTerminalStatus } from "./publication";
import { eventHasNotStarted } from "./event-start";
import type { OfficialSource, OpportunityCandidate } from "./types";

// Exact editions audited against UFSC's own articles. A discovery link never
// grants publication authority to its destination or to a registration vendor.
export const DISCOVERY_CALLS = [
  {
    id: "ufsc-farmacia-masters-2027", title: "Mestrado em Farmácia UFSC — seleção 2027",
    url: "https://noticias.ufsc.br/2026/09/programa-de-pos-graduacao-em-farmacia-abre-inscricoes-para-mestrado/",
    checks: [/Programa de Pós.?Graduação em Farmácia/i, /inscrições de 1º a 30 de outubro/i, /ingresso em março de 2027/i,
      /15 vagas para Análises Clínicas/i, /11 vagas em Fármaco Medicamentos/i],
    application: "https://capg.sistemas.ufsc.br/inscricao/index.xhtml?cdCurso=41010044",
    deadline: "2026-10-30", applicant: "graduate_professional", course: true,
    requirements: "Seleção de mestrado do PPGFAR/UFSC, com ingresso em março de 2027: 15 vagas em Análises Clínicas e 11 em Fármaco Medicamentos. Inscrição pelo CAPG, com reservas de vagas e critérios de elegibilidade definidos no edital do programa. Confira documentação e condições na fonte oficial.",
    conditions: "Aprovação no mestrado não garante bolsa. Taxa de inscrição, auxílio e remuneração não confirmados na notícia; consulte o edital.",
  },
  {
    id: "ufsc-ndi-admission-2027", title: "NDI/UFSC — sorteio de vagas e lista de espera 2027",
    url: "https://noticias.ufsc.br/2026/10/nucleo-de-desenvolvimento-infantil-abre-inscricoes-para-novos-alunos/",
    checks: [/Núcleo de Desenvolvimento Infantil/i, /de 26 de outubro a 9 de novembro/i, /ano letivo de 2027/i,
      /oito vagas para o Grupo 1/i, /crianças nascidas até 31 de dezembro de 2026/i, /inscrições são gratuitas/i],
    application: "http://inscricoesndi.sistemas.ufsc.br",
    deadline: "2026-11-09", applicant: "mixed", course: true,
    requirements: "Sorteio do NDI/UFSC para o ano letivo de 2027. Oito vagas no Grupo 1 para crianças nascidas, ou com parto previsto, até 31/12/2026; reservas conforme o edital. Os demais grupos formam lista de espera. Inscrição por responsável, segundo os requisitos e documentos do NDI. Uma ficha para o processo.",
    conditions: "Inscrição gratuita. Não se trata de bolsa ou benefício financeiro; a inscrição não garante vaga.",
  },
  {
    id: "ufsc-aplicacao-admission-2027", title: "Colégio de Aplicação UFSC — sorteio de vagas 2027",
    url: "https://noticias.ufsc.br/2026/10/colegio-de-aplicacao-lanca-edital-para-sorteio-de-46-vagas/",
    checks: [/Colégio de Aplicação/i, /listas de espera de 2027/i, /até 10 de novembro, às 18h/i,
      /46 vagas/i, /relação idade-série/i, /inscrições, gratuitas/i],
    application: "https://ingressoaplicacao.ufsc.br/",
    deadline: "2026-11-10T18:00:00-03:00", applicant: "mixed", course: true,
    requirements: "Sorteio público de 46 vagas e formação de listas de espera no Colégio de Aplicação UFSC para 2027, do ensino fundamental ao médio. Inscrição por responsável, respeitando a relação idade-série, as reservas e os documentos do edital. Prazo em 10/11/2026 às 18h de Brasília. Uma ficha para o processo.",
    conditions: "Ensino público e gratuito; inscrição gratuita. A inscrição não garante vaga e não representa bolsa financeira.",
  },
  {
    id: "ufsc-virusul-2026", title: "ViruSul — Encontro e Capacitação em Virologia UFSC 2026",
    url: "https://noticias.ufsc.br/2026/10/inscricoes-abertas-para-encontro-de-virologia-na-ufsc/",
    checks: [/Encontro e Capacitação em Virologia/i, /até 12 de novembro/i, /23 a 25 novembro/i,
      /Auditório do Centro de Ciências Biológicas/i, /20 vagas isentas/i, /saúde e pós-graduação da UFSC/i],
    application: "https://www.feesc.org.br/inscricoes/evento/iniciar_inscricao/243",
    deadline: "2026-11-12", start: "2026-11-23", applicant: "mixed", course: false,
    requirements: "Encontro e capacitação em virologia de 23 a 25/11/2026 no Auditório do CCB/UFSC. Inscrição até 12/11 pelo formulário indicado na notícia oficial. Vinte vagas isentas para cursos de saúde e pós-graduação da UFSC, sujeitas à elegibilidade e à ordem de chegada; o pedido de isenção é separado da inscrição.",
    conditions: "Há 20 isenções condicionadas aos critérios anunciados. O valor da inscrição geral não foi informado na notícia. Não presumir gratuidade para todos, bolsa, transporte, hospedagem ou remuneração.",
  },
  {
    id: "ufsc-experimenta-2026", title: "Experimenta — Mosaico das Artes UFSC 2026",
    url: "https://noticias.ufsc.br/2026/10/experimenta-2026-tera-programacao-com-musica-e-danca-na-ufsc-a-partir-de-3-de-novembro/",
    checks: [/Experimenta.*Mosaico das Artes/i, /3 a 8 de novembro de 2026/i, /gratuitas e abertas às comunidades interna e externa/i,
      /Entrada: Gratuita e aberta à comunidade/i],
    application: null,
    start: "2026-11-03", applicant: "mixed", course: false,
    requirements: "Programação do Experimenta — Mosaico das Artes, de 3 a 8/11/2026, em espaços e campi da UFSC conforme a programação oficial. Abertura em 03/11, no Teatro Carmen Fossari e na Igrejinha da UFSC. Atividades abertas às comunidades interna e externa; consulte horários, locais e condições de cada atividade. Uma ficha para a edição.",
    conditions: "Atividades gratuitas e abertas à comunidade. A notícia não exige inscrição geral nem informa prazo de inscrição. Transporte, hospedagem e remuneração não anunciados como benefícios.",
  },
] as const;

export const discoveryCall = (id: string) => DISCOVERY_CALLS.find(call => call.id === id);
export const isDiscoveryCall = (id: string) => Boolean(discoveryCall(id));
const clean = (text: string) => text.replace(/\s+/gu, " ").trim();
function normalizedUrl(input: string) {
  const url = new URL(input);
  for (const key of [...url.searchParams.keys()]) if (/^(utm_.+|fbclid|gclid)$/i.test(key)) url.searchParams.delete(key);
  url.hash = "";
  return url.href;
}

export function normalizeDiscoveryCall(html: string, source: OfficialSource, now = new Date()): OpportunityCandidate[] {
  const call = discoveryCall(source.id);
  if (!call) return [];
  if (source.baseUrl !== call.url || source.listingUrls.length !== 1 || source.listingUrls[0] !== call.url) {
    throw new Error("URL divergente da edição auditada");
  }
  const $ = cheerio.load(html);
  $("script,style,noscript,nav,header,footer,aside,.entry-meta,.postmetadata,.tags").remove();
  const article = $("article");
  if (article.length !== 1) throw new Error("Página ambígua sem artigo único");
  const links = article.find("a[href]").toArray().map(node => {
    try { return normalizedUrl(new URL($(node).attr("href")!, call.url).href); } catch { return ""; }
  });
  article.find("p,div,h1,h2,h3,li,a").append(" ");
  const text = clean(article.text());
  // The dated news article establishes the year; dates of the next academic
  // intake must not be confused with the registration year.
  if (!text.includes("2026") || call.checks.some(check => !check.test(text))) {
    throw new Error("Evidência da edição mudou; requer nova auditoria");
  }
  if (call.application && !links.includes(normalizedUrl(call.application))) {
    throw new Error("Rota oficial de inscrição não confirmada");
  }
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const deadline = "deadline" in call ? call.deadline : undefined;
  const start = "start" in call ? call.start : undefined;
  const precision = !deadline ? "not_informed" : deadline.includes("T") ? "exact_datetime" : "date_only";
  const current = deadline ? precision === "exact_datetime" ? Date.parse(deadline) >= now.getTime() : deadline >= today : eventHasNotStarted(start, now);
  const terminal = confirmedTerminalStatus(text, call.title);
  // Even a registration deadline in the future does not reopen an event that
  // already started. The existing public policy removes started events.
  const notStarted = !start || eventHasNotStarted(start, now);
  const status = terminal ?? (current && notStarted ? "open" : "closed");
  const proof = { source_url: call.url, excerpt: text.slice(0, 6000) };
  const candidate: OpportunityCandidate = {
    officialSourceId: source.id, title: call.title, institution: "Universidade Federal de Santa Catarina",
    sourcePageUrl: call.url, applicationUrl: call.url, applicationRoute: "direct_application",
    applicantType: call.applicant, benefitType: "other", categories: call.course ? ["formacao"] : ["eventos"],
    isCourse: call.course, nationallyEligible: false, countryCode: null, stateCode: null, cityName: null,
    geographicScopeKind: "unknown", deadlineAt: deadline, deadlinePrecision: precision, eventStartsAt: start,
    requirementsText: call.requirements, amountText: call.conditions, reviewStatus: "needs_information",
    opportunityStatus: status, extractionMethod: "html",
    evidenceJson: { opportunity_status: proof, requirements: proof, conditions: proof,
      ...(deadline ? { deadline_at: proof } : {}),
      ...(start ? { event_start: proof, registration_availability: proof } : {}) },
    contentHash: crypto.createHash("sha256").update("discovery-calls-v1\n" + source.id + "\n" + text).digest("hex"),
  };
  return [candidate];
}
