import crypto from "node:crypto";
import * as cheerio from "cheerio";
import { confirmedTerminalStatus } from "./publication";
import type { OfficialSource, OpportunityCandidate } from "./types";

const prefix = "https://www.gov.br/cnpq/pt-br/chamadas/todas-as-chamadas/chamadas-2026/";
export const CNPQ_AUDITED_CALLS = [
  {
    id: "cnpq-maidai-30-2026", number: "30", slug: "chamada-publica-cnpq-N-30-2026",
    document: "chamadapublica30_2026_MAIDAI_2766773.pdf",
    title: "CNPq/CAPES MAI/DAI — propostas institucionais 30/2026",
    heading: /CNPq\/CAPES.*30\/2026.*MAI\/DAI/i,
    pageChecks: [/mestrado e doutorado/i, /universidades em parceria com empresas/i],
    documentChecks: [/Chamada CNPq\/CAPES N[º°]\s*30\/2026/i, /ICTs poderão submeter propostas/i,
      /Representante Institucional/i, /11\/12\/2026/],
    applicant: "institution", route: "institutional_call", benefit: "project_funding",
    requirements: "Chamada institucional para ICTs, com submissão por representante institucional e parcerias nos termos do edital. Apoia projetos do Programa MAI/DAI; a indicação dos bolsistas cabe às instituições selecionadas. Estudantes devem procurar sua instituição. Confira linhas, documentos e critérios completos no edital.",
    conditions: "Apoio por bolsas nas modalidades previstas no edital, condicionado à aprovação da proposta institucional. Sem valor mensal único informado nesta ficha; confira os valores e as regras de cada modalidade.",
  },
  {
    id: "cnpq-anr-32-2026", number: "32", slug: "chamada-publica-cnpq-N-32-2026",
    document: "ChamadaPblicaANR322026_2766435.pdf",
    title: "CNPq/ANR — projetos conjuntos Brasil–França 32/2026",
    heading: /MCTI\/CNPq\/ANR.*32\/2026/i,
    pageChecks: [/projetos de pesquisa conjuntos/i, /grupos brasileiros e franceses/i],
    documentChecks: [/MCTI\/CNPq\/ANR N[º°]\s*32\/2026/i, /coordenador\(a\) brasileiro\(a\)/i,
      /possuir o título de doutor/i, /31\/03\/2027/],
    applicant: "researcher", route: "application_via_project_coordinator", benefit: "project_funding",
    requirements: "Proposta conjunta de grupos brasileiros e franceses, submetida ao CNPq pelo coordenador brasileiro. Exige doutorado, Lattes atualizado e vínculo institucional nos termos do edital; a equipe francesa também deve cumprir os procedimentos da ANR. Confira as áreas temáticas e os critérios completos antes de candidatar o projeto.",
    conditions: "Fomento a projetos selecionados conforme o edital e o orçamento aprovado. Sem remuneração individual ou bolsa garantida a cada participante; confira os itens financiáveis e as condições oficiais.",
  },
  {
    id: "cnpq-productivity-33-2026", number: "33", slug: "chamada-publica-cnpq-N-33-2026",
    document: "Chamada_Produtividade_33_2026.pdf",
    title: "Bolsas de Produtividade CNPq — chamada 33/2026",
    heading: /CNPq.*33\/2026.*Bolsas de Produtividade/i,
    pageChecks: [/Produtividade em Pesquisa Sênior/i, /pesquisadores que possuam produção/i],
    documentChecks: [/Chamada CNPq N[º°]\s*33\/2026/i, /possuir o título de Doutor/i,
      /vínculo formal com a instituição/i, /07\/01\/2027/],
    applicant: "researcher", route: "direct_application", benefit: "research_scholarship",
    requirements: "Para pesquisadores com doutorado, Lattes atualizado e vínculo formal com a instituição de execução, conforme o edital. Modalidades DT, PQ e PQ-Sr, com critérios específicos por linha e comitê. Consulte também o Anexo I atualizado e a errata publicada em 13/10/2026. A candidatura não garante concessão.",
    conditions: "Bolsas de produtividade concedidas por seleção. Valores e eventuais adicionais variam por modalidade e nível; esta ficha não presume valor mensal nem concessão garantida.",
  },
] as const;

export const cnpqCall = (id: string) => CNPQ_AUDITED_CALLS.find(call => call.id === id);
export const cnpqCallUrl = (call: (typeof CNPQ_AUDITED_CALLS)[number]) => `${prefix}chamada-no-${call.number}-2026/${call.slug}`;
export const cnpqDocumentUrl = (call: (typeof CNPQ_AUDITED_CALLS)[number]) => `${prefix}chamada-no-${call.number}-2026/${call.document}`;
const clean = (text: string) => text.replace(/\s+/gu, " ").trim();

export function normalizeCnpqAuditedCall(html: string, supplement: string, source: OfficialSource, now = new Date()): OpportunityCandidate[] {
  const call = cnpqCall(source.id);
  if (!call) return [];
  if (source.baseUrl !== cnpqCallUrl(call) || source.listingUrls.length !== 1 || source.listingUrls[0] !== cnpqCallUrl(call)) {
    throw new Error("URL da chamada CNPq divergente da edição auditada");
  }
  const $ = cheerio.load(html);
  $("script,style,noscript,nav,footer,header,aside").remove();
  $("p,div,h1,h2,h3,li,td,a").append(" ");
  const heading = clean($("h1").text());
  const content = $("#content-core");
  const text = clean(content.text());
  const document = clean(supplement);
  if (!call.heading.test(heading) || !text || call.pageChecks.some(check => !check.test(text)) ||
    call.documentChecks.some(check => !check.test(document))) throw new Error("Evidência da chamada CNPq mudou; requer nova auditoria");
  const documentUrl = cnpqDocumentUrl(call);
  const documents = content.find("a[href]").toArray().filter(node => clean($(node).text()) === "Chamada" && $(node).attr("href") === documentUrl);
  const windows = [...text.matchAll(/Inscrições:\s*(\d{2})\/(\d{2})\/(20\d{2})\s+a\s+(\d{2})\/(\d{2})\/(20\d{2})/g)];
  if (documents.length !== 1 || windows.length !== 1) throw new Error("Prazo ou edital CNPq ausente ou ambíguo");
  const window = windows[0];
  const date = (day: string, month: string, year: string) => {
    const iso = `${year}-${month}-${day}`;
    const parsed = new Date(`${iso}T00:00:00Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === iso ? iso : null;
  };
  const start = date(window[1], window[2], window[3]), end = date(window[4], window[5], window[6]);
  if (!start || !end || start > end || window[3] !== "2026") throw new Error("Prazo CNPq inválido");
  // The current landing page may incorporate an official extension. A conflicting
  // PDF deadline requires reconciliation, rather than silently choosing one.
  if (!document.includes(`${window[4]}/${window[5]}/${window[6]}`)) throw new Error("Conflito de prazo entre página e edital CNPq");
  const today = new Intl.DateTimeFormat("en-CA", {timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(now);
  const terminal = confirmedTerminalStatus(text);
  const status = terminal ?? (end < today ? "closed" : start > today ? "upcoming" : "open");
  const url = cnpqCallUrl(call);
  const proof = {source_url:url,excerpt:window[0]};
  return [{officialSourceId:source.id,title:call.title,institution:"CNPq",sourcePageUrl:url,
    officialDocumentUrl:documentUrl,applicationUrl:url,applicantType:call.applicant,applicationRoute:call.route,
    benefitType:call.benefit,categories:["bolsas","pesquisa"],isCourse:false,nationallyEligible:false,
    countryCode:null,stateCode:null,cityName:null,geographicScopeKind:"unknown",deadlineAt:end,
    deadlinePrecision:"date_only",opportunityStatus:status,reviewStatus:"needs_information",
    requirementsText:call.requirements,amountText:call.conditions,extractionMethod:"html",
    evidenceJson:{deadline_at:proof,opportunity_status:{source_url:url,excerpt:terminal??window[0]},
      requirements:{source_url:documentUrl,excerpt:document.slice(Math.max(0,document.search(/(?:Quanto ao Proponente|CRITÉRIOS DE ELEGIBILIDADE|ICTs poderão)/i)), Math.max(0,document.search(/(?:Quanto ao Proponente|CRITÉRIOS DE ELEGIBILIDADE|ICTs poderão)/i))+1800)},
      official_document:{source_url:documentUrl,excerpt:`Chamada ${call.number}/2026: edital oficial consultado juntamente com a página de inscrições.`}},
    hasRetification:/errata|retificaç/i.test(text),
    contentHash:crypto.createHash("sha256").update(`cnpq-audited-v1\n${source.id}\n${heading}\n${text}\n${document}`).digest("hex")}];
}
