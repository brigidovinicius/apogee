import crypto from "node:crypto";
import * as cheerio from "cheerio";
import { confirmedTerminalStatus } from "./publication";
import type { OfficialSource, OpportunityCandidate } from "./types";

export const UFSC_AUDITED_CALLS = [
  {
    id:"ufsc-proaa-2027",title:"UFSC PROAA 2027 — propostas de extensão para ações afirmativas",
    url:"https://noticias.ufsc.br/2026/10/ufsc-abre-inscricoes-para-programa-de-bolsas-de-extensao-para-acoes-afirmativas/",
    supplement:"https://proex.paginas.ufsc.br/files/2026/10/Edital-11-2026-PROEX-PROAA-2027-Publicada.pdf",
    checks:[/Programa de Bolsas de Extensão para Ações Afirmativas/,/PROAA.*2027/,/17h do dia 27 de outubro/,
      /de 6 a 27 de outubro de 2026/,/servidores docentes e técnico-administrativos/,/registrado e aprovado no SIGPEX/],
    supplementChecks:[/11\/2026\/PROEX/,/PROAA/,/2027/,/27\/10\/2026/,/17[bh:]|17 horas|17h/],
    deadline:"2026-10-27T17:00:00-03:00",precision:"exact_datetime",applicant:"mixed",route:"application_via_project_coordinator",
    benefit:"extension_scholarship",isCourse:false,
    requirements:"Propostas apresentadas por docentes ou técnicos administrativos da UFSC, com projeto aprovado no SIGPEX e execução de março a dezembro de 2027. Cada projeto pode solicitar até duas bolsas para estudantes elegíveis às ações afirmativas. Submissão pelo PAI/Proex, serviço Editais, com os documentos exigidos. Estudantes devem consultar a coordenação dos projetos; esta chamada seleciona propostas.",
    conditions:"Bolsas de extensão condicionadas à aprovação do projeto e à seleção de estudantes elegíveis. Valor mensal não informado nesta ficha; confira o edital. Prazo de propostas em 27/10/2026 às 17h, horário de Brasília.",
  },
  {
    id:"ufsc-ppgtg-masters-2027-1",title:"Mestrado PPGTG/UFSC — seleção 2027.1",
    url:"https://noticias.ufsc.br/2026/10/mestrado-em-engenharia-de-transportes-e-gestao-territorial-recebe-inscricoes-de-candidatos-ao-mestrado/",
    supplement:"https://ppgtg.ufsc.br/processo-seletivo/processo-seletivo-2027-1/",
    checks:[/Engenharia de Transportes e Gestão Territorial/,/1º trimestre de 2027/,/até 27 de novembro de 2026/,
      /inscrições são gratuitas/i,/alunos graduados/,/28 vagas/],
    supplementChecks:[/INGRESSO NO 1º TRIMESTRE DE 2027/i,/09\/10\/2026.*27\/11\/2026/],
    deadline:"2026-11-27",precision:"date_only",applicant:"graduate_professional",route:"direct_student_application",
    benefit:"other",isCourse:true,
    requirements:"Seleção para o mestrado em Engenharia de Transportes e Gestão Territorial, com ingresso no primeiro trimestre de 2027. Para graduados nas áreas de Ciências Exatas e da Terra, Engenharias, Ciências Sociais Aplicadas e Ciências Humanas, conforme o edital. São 28 vagas, com reserva para ações afirmativas. Consulte documentos, critérios e procedimentos na página oficial do PPGTG.",
    conditions:"Inscrição gratuita. Aprovação no mestrado não garante bolsa ou remuneração; consulte as regras específicas de financiamento do programa.",
  },
  {
    id:"ufsc-transfers-2027-1",title:"UFSC — transferências e retornos 2027.1",
    url:"https://dae.ufsc.br/admissao-por-transferencias-e-retornos-edital/",
    supplement:"https://noticias.ufsc.br/2026/10/ufsc-lanca-edital-de-transferencias-e-retornos-com-5-139-vagas/",
    checks:[/primeiro semestre letivo de 2027/,/22 a 30 de outubro de 2026/,/Candidatos externos/,
      /um único curso e inciso/],
    supplementChecks:[/5\.139 vagas/,/transferência interna e retorno de aluno abandono/i,/transferência externa e retorno de graduados/i],
    deadline:"2026-10-30",precision:"date_only",applicant:"mixed",route:"direct_student_application",benefit:"other",isCourse:true,
    requirements:"Ingresso na graduação UFSC em 2027.1 por transferência interna, retorno após abandono, transferência externa ou retorno de graduados, conforme o grupo e o curso pretendidos. Inscrição e documentos pelo sistema CAGR; uma opção de curso e inciso por semestre. Confira vagas, critérios e cronograma de validação das ações afirmativas. Uma ficha para o processo seletivo.",
    conditions:"Ingresso em universidade pública e gratuita. Bolsa, auxílio financeiro e taxa de inscrição não confirmados nesta ficha; consulte as condições do edital.",
  },
] as const;
export const ufscAuditedCall = (id: string) => UFSC_AUDITED_CALLS.find(call=>call.id===id);
const clean = (text: string) => text.replace(/\s+/gu," ").trim();
function articleText(html: string) {
  const $=cheerio.load(html);$("script,style,noscript,nav,header,footer,aside").remove();
  $("p,div,h1,h2,h3,h4,li,tr,td,a").append(" ");
  // Exclude sidebars and calendars: their dates belong to other opportunities.
  return clean($("article").first().text());
}

export function normalizeUfscAuditedCall(html: string, supplement: string, source: OfficialSource, now=new Date()): OpportunityCandidate[] {
  const call=ufscAuditedCall(source.id);
  if (!call) return [];
  if (source.baseUrl!==call.url || source.listingUrls.length!==1 || source.listingUrls[0]!==call.url) throw new Error("URL UFSC divergente da edição auditada");
  const text=articleText(html),document=call.supplement.endsWith(".pdf")?clean(supplement):articleText(supplement);
  if (!text || call.checks.some(check=>!check.test(text)) || call.supplementChecks.some(check=>!check.test(document))) {
    throw new Error("Evidência da chamada UFSC mudou; requer nova auditoria");
  }
  const today=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(now);
  const expired=call.precision==="exact_datetime"?Date.parse(call.deadline)<now.getTime():call.deadline<today;
  const terminal=confirmedTerminalStatus(text);
  const proof={source_url:call.url,excerpt:text.slice(0,2000)};
  const proaaDeadlineIndex=text.indexOf("17h do dia 27 de outubro");
  const deadlineProof=call.id==="ufsc-proaa-2027"
    ?{source_url:call.url,excerpt:text.slice(Math.max(0,proaaDeadlineIndex-180),proaaDeadlineIndex+180)}
    :{source_url:call.id==="ufsc-transfers-2027-1"?call.url:call.supplement,
      excerpt:call.id==="ufsc-transfers-2027-1"?text.slice(0,2000):document.slice(0,3500)};
  return [{officialSourceId:source.id,title:call.title,institution:"Universidade Federal de Santa Catarina",
    sourcePageUrl:call.url,applicationUrl:call.url,...(call.supplement.endsWith(".pdf")?{officialDocumentUrl:call.supplement}:{}),
    applicantType:call.applicant,applicationRoute:call.route,benefitType:call.benefit,
    categories:call.isCourse?["formacao"]:["bolsas","pesquisa"],isCourse:call.isCourse,nationallyEligible:false,
    countryCode:null,stateCode:null,cityName:null,geographicScopeKind:"unknown",deadlineAt:call.deadline,
    deadlinePrecision:call.precision,opportunityStatus:terminal??(expired?"closed":"open"),reviewStatus:"needs_information",
    requirementsText:call.requirements,amountText:call.conditions,extractionMethod:"html",
    evidenceJson:{deadline_at:deadlineProof,opportunity_status:proof,
      requirements:proof,supplement:{source_url:call.supplement,excerpt:document.slice(0,2000)}},
    contentHash:crypto.createHash("sha256").update(`ufsc-audited-v1\n${source.id}\n${text}\n${document}`).digest("hex")}];
}
