import crypto from "node:crypto";
import * as cheerio from "cheerio";
import { confirmedTerminalStatus } from "./publication";
import { eventHasNotStarted } from "./event-start";
import type { OfficialSource, OpportunityCandidate } from "./types";

export const FAPESC_CTI_ID = "fapesc-cecti-regional-2026";
export const FAPESC_CTI_URL = "https://fapesc.sc.gov.br/governo-do-estado-realiza-conferencia-de-ciencia-tecnologia-e-inovacao-nas-seis-mesorregioes-de-santa-catarina-para-definir-prioridades-do-ecossistema/";
const TITLE = "8ª Conferência Estadual de Ciência, Tecnologia e Inovação — etapas regionais SC 2026";
const HEADING = "Governo do Estado realiza Conferência de Ciência, Tecnologia e Inovação nas seis mesorregiões de Santa Catarina para definir prioridades do ecossistema";
const checks = [/8ª Conferência Estadual de Ciência, Tecnologia e Inovação/, /setores produtivo, governamental, acadêmico e sociedade civil organizada/,
  /das 9h às 12h/, /03\/11\/2026/, /04\/11\/2026/, /05\/11\/2026/, /06\/11\/2026/, /11\/11\/2026/, /16\/11\/2026/,
  /inscrições serão encerradas assim que a capacidade de cada local for atingida/i];

export function normalizeFapescCti(html: string, source: OfficialSource, now = new Date()): OpportunityCandidate[] {
  if (source.id !== FAPESC_CTI_ID || source.baseUrl !== FAPESC_CTI_URL ||
    source.listingUrls.length !== 1 || source.listingUrls[0] !== FAPESC_CTI_URL) throw new Error("URL divergente da edição auditada");
  const $ = cheerio.load(html);
  $("script,style,noscript,nav,header,footer,aside").remove();
  const post = $(".elementor-location-single.post-58157");
  const body = post.find(".elementor-widget-theme-post-content");
  if (post.length !== 1 || body.length !== 1 || post.find("h1").length !== 1 ||
    post.find("h1").text().replace(/\s+/gu, " ").trim() !== HEADING) throw new Error("Página ambígua ou edição divergente");
  if (body.find('a[href="http://www.conferenciacti.sc.gov.br/"]').length !== 1) throw new Error("Rota oficial de inscrição não confirmada");
  body.find("p,div,h2,h3,li,a").append(" ");
  const text = body.text().replace(/\s+/gu, " ").trim();
  if (checks.some(check => !check.test(text))) throw new Error("Evidência da edição mudou; requer nova auditoria");
  const start = "2026-11-03";
  // This audited future capacity condition is not an announcement of closure.
  const statusText = text.replace(/As inscrições serão encerradas assim que a capacidade de cada local for atingida\./u, "");
  const status = confirmedTerminalStatus(statusText, TITLE) ?? (eventHasNotStarted(start, now) ? "open" : "closed");
  const proof = { source_url: FAPESC_CTI_URL, excerpt: text.slice(0, 9000) };
  return [{
    officialSourceId: source.id, title: TITLE, institution: "Fundação de Amparo à Pesquisa e Inovação do Estado de Santa Catarina",
    sourcePageUrl: FAPESC_CTI_URL, applicationUrl: FAPESC_CTI_URL, applicationRoute: "direct_application",
    applicantType: "mixed", benefitType: "other", categories: ["eventos"], isCourse: false, nationallyEligible: false,
    countryCode: "BR", stateCode: "SC", cityName: null, geographicScopeKind: "state",
    deadlinePrecision: "not_informed", eventStartsAt: start, opportunityStatus: status, reviewStatus: "needs_information",
    requirementsText: "Debates regionais da 8ª CECTI, para representantes dos setores produtivo, governamental, acadêmico e sociedade civil organizada. Das 9h às 12h: Blumenau/CIB em 03/11, Joinville/Univille em 04/11, Criciúma/Crio em 05/11, Florianópolis/UniSENAI em 06/11, Lages/Órion Hall em 11/11 e Chapecó/Pollen Parque em 16/11/2026. Vagas limitadas por local; inscrições encerram ao atingir a capacidade. Acesse o site do evento indicado na notícia oficial e confira a disponibilidade da regional. Uma ficha para a edição; a etapa estadual tem regras próprias de representação e não é uma inscrição aberta implícita.",
    amountText: "Taxa, gratuidade, viagem, hospedagem, alimentação e remuneração não informadas como benefícios na notícia oficial. Consulte as condições da regional antes da inscrição.",
    evidenceJson: { opportunity_status: proof, requirements: proof, conditions: proof, event_start: proof, registration_availability: proof },
    extractionMethod: "html", contentHash: crypto.createHash("sha256").update("fapesc-cecti-v1\n" + text).digest("hex"),
  }];
}
