import crypto from "node:crypto";
import * as cheerio from "cheerio";
import { confirmedTerminalStatus } from "./publication";
import type { OfficialSource, OpportunityCandidate } from "./types";

export const AXIA_ID = "axia-internship-2027";
export const AXIA_URL = "https://axia.com.br/w/blog/programa-estagio-axia-2027";
export const AXIA_APPLICATION = "https://axia.across.jobs/";

/** One organizer announcement and one programme, regardless of seats, courses or states. */
export function normalizeAxiaInternship(html: string, source: OfficialSource, now = new Date()): OpportunityCandidate[] {
  if (source.id !== AXIA_ID) return [];
  const $ = cheerio.load(html);
  const heading = $("h1").first().text().replace(/\s+/g, " ").trim();
  if (heading !== "Inscrições para estágio na AXIA Energia vão até 15 de outubro") throw new Error("Identidade da chamada AXIA mudou");
  $("script,style,noscript,header,footer,nav").remove();
  const text = $("body").text().replace(/\s+/g, " ").trim().split("Mais Notícias")[0];
  const window = /As inscrições estarão abertas até 15 de outubro de 2026 pelo site/.exec(text);
  const terminal = confirmedTerminalStatus(text);
  if (!window || !/Programa de Estágio AXIA Energia 2027/.test(text) || !/estudantes de nível superior e técnico/.test(text) ||
    !/dezembro de 2028 e agosto de 2029/.test(text) || !/cursos técnicos com disponibilidade para um ano de estágio/.test(text) ||
    !/100% presencial/.test(text) || !/bolsa-auxílio compatível com o mercado, auxílio-transporte, vale-alimentação ou refeição, plano de saúde e programa de desenvolvimento/.test(text) ||
    !/Santa Catarina/.test(text) || !/4h ou 6h para nível técnico/.test(text)) throw new Error("Condições AXIA sem comprovação atual");
  const links = $("a[href]").toArray().some(node => $(node).attr("href") === AXIA_APPLICATION && /Inscreva-se no Programa de Estágio AXIA Energia 2027/.test($(node).text()));
  // An extension, new deadline or amended requirements need another audit, not stale hardcoded facts.
  if (/prorrog|retifica|novo prazo/i.test(text)) throw new Error("Alteração de condições AXIA exige auditoria");
  const today = new Intl.DateTimeFormat("en-CA", {timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(now);
  const proof = (excerpt: string) => ({source_url:AXIA_URL,excerpt});
  return [{ officialSourceId:source.id,title:"Programa de Estágio AXIA Energia 2027 — técnico e superior",institution:source.institutionName,
    sourcePageUrl:AXIA_URL,applicationUrl:AXIA_APPLICATION,applicantType:"mixed",applicationRoute:"direct_student_application",
    benefitType:"internship",categories:["carreira"],isCourse:false,nationallyEligible:false,countryCode:"BR",stateCode:null,cityName:null,
    geographicScopeKind:"country",deadlineAt:"2026-10-15",deadlinePrecision:"date_only",
    opportunityStatus:terminal ?? (links && today <= "2026-10-15" ? "open" : "closed"),reviewStatus:"needs_information",extractionMethod:"html",
    requirementsText:"Estágio presencial para alunos de cursos técnicos ou de graduação. Graduação: formatura prevista entre dezembro/2028 e agosto/2029, jornada de 6h. Técnico: disponibilidade para um ano de estágio, jornada de 4h ou 6h. Há vagas em Santa Catarina e em outros estados; cidades não informadas na notícia. Consulte cursos e locais disponíveis na inscrição. Uma ficha para o programa inteiro, sem garantia de contratação.",
    amountText:"Bolsa-auxílio com valor não divulgado, auxílio-transporte, vale-alimentação ou refeição, plano de saúde e programa de desenvolvimento. Não presumir valor da bolsa nem custos de deslocamento cobertos além dos benefícios anunciados.",
    evidenceJson:{deadline_at:proof(window[0]),opportunity_status:proof(terminal ?? (links ? window[0] : "Chamada de inscrição indisponível.")),
      requirements:proof("Graduação com formatura entre dezembro de 2028 e agosto de 2029; cursos técnicos com disponibilidade para um ano de estágio; atuação 100% presencial."),
      amount:proof("Bolsa-auxílio compatível com o mercado, auxílio-transporte, vale-alimentação ou refeição, plano de saúde e programa de desenvolvimento."),
      location:proof("Vagas presenciais em Santa Catarina e outros estados do Brasil; cidades não informadas.")},
    contentHash:crypto.createHash("sha256").update(`${source.id}\n${text}`).digest("hex") }];
}
