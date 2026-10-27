import crypto from "node:crypto";
import * as cheerio from "cheerio";
import { confirmedTerminalStatus } from "./publication";
import type { OfficialSource, OpportunityCandidate } from "./types";

export const ICIF_ID="cps-icif-gastronomy-8-2026";
export const ICIF_URL="https://arinter.cps.sp.gov.br/8-concurso-cif-2026/";
export const ICIF_DOCUMENT="https://bkpsitecpsnew.blob.core.windows.net/uploadsitecps/sites/8/2026/10/E-Edital-ARI-44-2026-8-Concurso-de-Gastronomia-ICIF-2026-1.pdf";
export const IEG_ID="ufsc-ieg-research-submissions-2026";
export const IEG_URL="https://noticias.ufsc.br/event/evento-encontro-de-pesquisas-em-raca-genero-e-enfrentamento-as-violencias/";
export const additionalCallUrl=(id:string)=>id===ICIF_ID?ICIF_URL:id===IEG_ID?IEG_URL:null;
const clean=(text:string)=>text.replace(/\s+/gu," ").trim();

export function normalizeAdditionalCall(html:string,supplement:string,source:OfficialSource,now=new Date()):OpportunityCandidate[] {
  const url=additionalCallUrl(source.id);
  if(!url)return [];
  if(source.baseUrl!==url||source.listingUrls.length!==1||source.listingUrls[0]!==url)throw new Error("URL divergente da chamada auditada");
  const $=cheerio.load(html);$("script,style,noscript,nav,header,footer,aside").remove();
  $("p,div,h1,h2,h3,h4,li,tr,td,a").append(" ");
  const icif=source.id===ICIF_ID;
  const region=icif?$(".cps-texto-conteudo").first():$("article").first();
  region.find(".listagem-related-post,.conteudo__tags,.post-compartilhamento").remove();
  const text=clean(region.text()),document=clean(supplement);
  const checks=icif?[/8º Concurso de Gastronomia/,/docentes das Etecs e Fatecs/,/contrato por prazo indeterminado/,
    /9 de outubro a 2 de novembro de 2026/,/23h59/,/12 semanas/,/24 de novembro de 2026/]
    :[/Encontro de Pesquisas em Raça, Gênero e Enfrentamento às Violências/,/23 e 24 de novembro/,
      /2026-11-23/,/pesquisas em andamento e concluídas na pós-graduação da UFSC/,
      /prazo para envio de trabalhos.*até 13 de novembro/i,/através deste formulário/,/Custo Grátis/];
  if(!text||checks.some(check=>!check.test(text)))throw new Error("Evidência da chamada mudou; requer nova auditoria");
  if(icif&&[/EDITAL ARI nº 44\/2026/i,/contratado por prazo indeterminado/i,/02\/11\/2026/,
    /23h59min/,/transporte.*passagem aérea/i,/inteira responsabilidade do candidato contemplado/i].some(check=>!check.test(document))) {
    throw new Error("Evidência do edital ICIF mudou; requer nova auditoria");
  }
  const deadline=icif?"2026-11-02":"2026-11-13";
  const today=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(now);
  const terminal=confirmedTerminalStatus(text);
  const deadlineIndex=icif?document.indexOf("02/11/2026"):text.indexOf("O prazo para envio de trabalhos");
  const deadlineText=icif?document:text;
  const evidence={source_url:url,excerpt:text.slice(0,2000)};
  return [{officialSourceId:source.id,title:icif?"8º Concurso de Gastronomia CPS/ICIF — docentes Etec e Fatec 2026":"Submissão de trabalhos — Encontro de Pesquisas em Raça, Gênero e Violências UFSC 2026",
    institution:icif?"Centro Paula Souza e ICIF":"Instituto de Estudos de Gênero — UFSC",sourcePageUrl:url,applicationUrl:url,
    ...(icif?{officialDocumentUrl:ICIF_DOCUMENT}:{}),applicantType:icif?"professor":"mixed",applicationRoute:"direct_application",
    benefitType:icif?"prize":"other",categories:icif?["competicoes","intercambios"]:["pesquisa","eventos"],isCourse:false,
    nationallyEligible:false,countryCode:null,stateCode:null,cityName:null,geographicScopeKind:"unknown",
    eventStartsAt:icif?"2026-11-24":"2026-11-23",deadlineAt:deadline,deadlinePrecision:"date_only",
    opportunityStatus:terminal??(deadline<today?"closed":"open"),reviewStatus:"needs_information",extractionMethod:"html",
    requirementsText:icif?"Para docentes das Etecs e Fatecs das áreas indicadas no edital, contratados por prazo indeterminado e sem premiação ICIF anterior, sujeitos aos demais critérios funcionais e de elegibilidade. Inscrição com memorial e carta temática; etapa presencial para finalistas em 24/11/2026 na Etec Santa Ifigênia, São Paulo. Inscrições até 02/11, às 23h59, conforme o edital."
      :"Envio de trabalhos de pesquisas em andamento ou concluídas na pós-graduação da UFSC, sobre raça, gênero e enfrentamento às violências. Submissão pelo formulário indicado na página oficial até 13/11/2026; aprovação prevista para 18/11. Encontro em 23 e 24/11 no Centro de Eventos da UFSC, Campus Trindade. O prazo desta ficha é para envio de trabalhos; consulte a organização sobre participação como ouvinte.",
    amountText:icif?"Uma bolsa de estudos ao vencedor para curso de 12 semanas no ICIF, na Itália, com hospedagem e serviços previstos no edital. O estágio profissionalizante de oito semanas é opcional. Transporte, passagens, alimentação fora do ICIF e demais despesas são do contemplado; a seleção não garante emprego ou remuneração."
      :"Evento gratuito, com certificado conforme participação. Bolsa, remuneração, transporte e hospedagem não anunciados como benefícios nesta chamada.",
    evidenceJson:{deadline_at:{source_url:icif?ICIF_DOCUMENT:url,excerpt:deadlineText.slice(Math.max(0,deadlineIndex-150),deadlineIndex+250)},
      opportunity_status:evidence,requirements:evidence,event_start:evidence,
      ...(icif?{official_document:{source_url:ICIF_DOCUMENT,excerpt:document.slice(0,1600)}}:{})},
    contentHash:crypto.createHash("sha256").update(`additional-calls-v1\n${source.id}\n${text}\n${document}`).digest("hex")}];
}
