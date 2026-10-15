import crypto from "node:crypto";
import * as cheerio from "cheerio";
import { confirmedTerminalStatus } from "./publication";
import type { OfficialSource, OpportunityCandidate } from "./types";

export const CPS_VIRTUAL_ID = "cps-virtual-mobility-031-2026";
export const CPS_VIRTUAL_URL = "https://arinter.cps.sp.gov.br/editais-abertos/";
export const NILT_LETTERS_ID = "ufsc-nilt-motivation-letters-2026";
export const NILT_LETTERS_URL = "https://niltsinter.ufsc.br/cursos-chamadas-abertos/";
export function isAuditedYouthCall(id: string) { return [CPS_VIRTUAL_ID,NILT_LETTERS_ID].includes(id); }
const clean = (value: string) => value.replace(/\s+/g," ").trim();

export function normalizeAuditedYouthCall(html: string, source: OfficialSource, now = new Date()): OpportunityCandidate[] {
  if (!isAuditedYouthCall(source.id)) return [];
  const $=cheerio.load(html);$("script,style,noscript,nav,footer,header").remove();
  // Preserve semantic spacing when minified HTML has adjacent paragraphs/cells/links.
  $("p,div,h1,h2,h3,h4,h5,h6,td,th,li,a").append(" ");
  const page=clean($("body").text());
  const virtual=source.id===CPS_VIRTUAL_ID;
  let block: string, availability: boolean, deadline: string, title: string, requirements: string;
  if (virtual) {
    if (!/Editais Abertos/.test(page)) throw new Error("Índice CPS indisponível");
    const headings=[...page.matchAll(/Ari\s*[–-]\s*(\d{3})\.(20\d{2})/g)];
    const matches=headings.filter(m=>m[1]==="031" && m[2]==="2026");
    if (matches.length!==1) throw new Error("Edição virtual ausente ou ambígua");
    const start=matches[0],position=headings.indexOf(start);
    block=page.slice(start.index,headings[position+1]?.index??page.length).split("Em Andamento")[0];
    if (!/Programa eMovies/.test(block) || !/Programa INILATmov\+/.test(block) || !/Modalidade Virtual/.test(block) ||
      !/Alunos FATEC que atendam a todos os requisitos do edital/.test(block)) throw new Error("Público ou modalidade virtual mudou");
    let call="", enrollmentLinks=0;
    $("h3,a[href]").each((_,node)=>{
      const element=$(node),label=clean(element.text()),heading=/^Ari\s*[–-]\s*(\d{3})\.2026$/.exec(label);
      if (element.is("h3") && heading) call=heading[1];
      if (element.is("a") && call==="031" && element.attr("href")?.startsWith("https://forms.cloud.microsoft/") && /^INSCRIÇÃO (?:eMovies|InilatMov\+)$/i.test(label)) enrollmentLinks++;
    });
    availability=enrollmentLinks===2;
    if (!confirmedTerminalStatus(block) && !/Inscrições ABERTAS até 08\/12\b/.test(block)) throw new Error("Prazo virtual sem confirmação");
    deadline="2026-12-08";title="Mobilidade virtual CPS — seleção ARI 031/2026 (eMovies e INILATmov+)";
    requirements="Para alunos de Fatec que atendam ao edital ARI 031/2026. Programa de mobilidade virtual, sem viagem anunciada na listagem. A página oficial não detalha idade, idiomas ou outros requisitos: consulte o edital e as regras da instituição escolhida antes de se candidatar. Confira as opções disponíveis para a seleção de mobilidade virtual. A candidatura não garante aceitação.";
  } else {
    if (!/Cursos com inscrições abertas\s*[–-]\s*2026/.test(page)) throw new Error("Índice NILT sem edição atual");
    const rows=$("tr").toArray().filter(n=>clean($(n).find("td").first().text())==="Cartas de motivação para intercâmbios acadêmicos");
    if (rows.length!==1) throw new Error("Oficina NILT ausente ou ambígua");
    block=clean($(rows[0]).text());
    if (!/Presencial e On line/.test(block) || !/Estudantes, técnicos e docentes da UFSC/.test(block) ||
      !/de 27 de outubro a 13 de novembro/.test(block)) throw new Error("Público ou realização NILT mudou");
    availability=/espanhol\.nilt@gmail\.com/.test(block);
    if (!confirmedTerminalStatus(block) && !/de 1º a 19 de outubro/.test(block)) throw new Error("Prazo NILT não confirmado");
    deadline="2026-10-19";title="Cartas de motivação para intercâmbios acadêmicos — NILT/UFSC 2026";
    requirements="Para estudantes, técnicos e docentes da UFSC. Oficina presencial e online, de 27/10 a 13/11/2026, com inscrição indicada por e-mail na página oficial. Não é uma vaga de intercâmbio nem estágio. A listagem não detalha outros pré-requisitos ou local presencial; confirme com o NILT antes de se inscrever.";
  }
  const url=virtual?CPS_VIRTUAL_URL:NILT_LETTERS_URL;
  const today=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(now);
  const proof={source_url:url,excerpt:block.slice(0,1800)};
  return [{officialSourceId:source.id,title,institution:source.institutionName,sourcePageUrl:url,applicationUrl:url,
    applicantType:virtual?"undergraduate_student":"mixed",applicationRoute:"direct_student_application",benefitType:"other",
    categories:virtual?["intercambios"]:["formacao"],isCourse:!virtual,nationallyEligible:false,
    countryCode:null,stateCode:null,cityName:null,geographicScopeKind:"unknown",deadlineAt:deadline,deadlinePrecision:"date_only",
    opportunityStatus:confirmedTerminalStatus(block)??(availability && today<=deadline?"open":"closed"),reviewStatus:"needs_information",
    requirementsText:requirements,amountText:"Apoio financeiro, gratuidade e remuneração não informados na página oficial consultada. Consulte os termos oficiais antes de se candidatar.",
    evidenceJson:{deadline_at:proof,opportunity_status:proof,requirements:proof},extractionMethod:source.extractionMode,
    contentHash:crypto.createHash("sha256").update(`audited-youth-v1\n${source.id}\n${block}\n${availability}`).digest("hex")}];
}
