import crypto from "node:crypto";
import * as cheerio from "cheerio";
import { confirmedTerminalStatus } from "./publication";
import type { OfficialSource, OpportunityCandidate } from "./types";

export const CPS_CULTURAL_ID = "cps-cultural-15-2026";
export const CPS_OPEN_URL = "https://arinter.cps.sp.gov.br/editais-abertos/";
export const CPS_CULTURAL_NEWS = "https://arinter.cps.sp.gov.br/intercambio-cultural-do-centro-paula-souza-abre-inscricoes-para-mais-de-500-bolsas-internacionais-em-2027/";
const modalities = ["ETEC presencial", "ETEC EaD", "FATEC presencial", "FATEC EaD", "FATEC AMS", "FATEC em implantação"];
function text(html: string) {
  const $ = cheerio.load(html);
  $("script,style,noscript,nav,footer,header").remove();
  $("p,div,h1,h2,h3,h4,h5,h6,li,td,a").append(" ");
  return $("body").text().replace(/\s+/g, " ").trim();
}

/** One edition, aggregating the six enrollment modalities and all destinations. */
export function normalizeCpsCultural(listing: string, news: string, source: OfficialSource, now = new Date()): OpportunityCandidate[] {
  if (source.id !== CPS_CULTURAL_ID) return [];
  const index = text(listing), announcement = text(news).split("Notícias Recentes")[0];
  if (!/Editais Abertos/.test(index) || !/15º Intercâmbio Cultural/.test(announcement) ||
    !/533 bolsas/.test(announcement) || !/embarques previstos para 2027/.test(announcement)) throw new Error("Identidade da edição CPS mudou");
  const window = /As inscrições estarão abertas de 23 de setembro a 17 de outubro de 2026\s*,?\s*exclusivamente pelo Sistema ARInter\./.exec(announcement);
  if (!window || !/estudantes regularmente matriculados em cursos elegíveis das Etecs e Fatecs/.test(announcement) ||
    !/não tenham participado anteriormente do programa/.test(announcement) || !/Passagens aéreas internacionais de ida e volta/.test(announcement) ||
    !/Ajuda de custo em moeda local/.test(announcement) || !/Hospedagem em casa de família/.test(announcement) ||
    !/critérios acadêmicos definidos em cada edital/.test(announcement) || !/quatro semanas/.test(announcement) ||
    !/café da manhã e jantar/.test(announcement) || !/Seguro-viagem e seguro-saúde internacional/.test(announcement)) throw new Error("Condições CPS não comprovadas");
  const boundaries = [...index.matchAll(/Ari\s*[–-]\s*(\d{3})\.2026/g)];
  const open: string[] = [];
  const endDays = new Set<string>();
  for (let n = 33; n <= 38; n++) {
    const matches = boundaries.filter(m => Number(m[1]) === n);
    if (matches.length !== 1) throw new Error("Modalidade CPS ausente ou duplicada");
    const match = matches[0], position = boundaries.indexOf(match);
    const block = index.slice(match.index, boundaries[position + 1]?.index ?? index.length).split("Em Andamento")[0];
    if (!/15º INTERCÂMBIO CULTURAL DO CENTRO PAULA SOUZA \(2026\)/i.test(block)) throw new Error("Edição CPS inconsistente");
    const datedWindow = /De 23\/09 até (\d{2})\/10\b/.exec(block);
    // The official listing confirms the same edition's extension to 22/10.
    // Other dates or conflicting modality windows still require fresh evidence.
    if (datedWindow) {
      if (!["17", "22"].includes(datedWindow[1])) throw new Error("Prazo CPS não auditado");
      endDays.add(datedWindow[1]);
    }
    const terminal = confirmedTerminalStatus(block);
    if (terminal) continue;
    if (!/Inscrições ABERTAS De 23\/09 até (?:17|22)\/10\b/.test(block)) throw new Error("Inscrição CPS sem prazo atual confirmado");
    open.push(modalities[n - 33]);
  }
  if (endDays.size > 1) throw new Error("Prazos CPS conflitantes entre modalidades");
  const endDay = [...endDays][0] ?? "17";
  const deadline = `2026-10-${endDay}`;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit" }).format(now);
  const terminal = confirmedTerminalStatus(announcement);
  const proof = (excerpt: string, source_url = CPS_OPEN_URL) => ({ source_url, excerpt });
  return [{ officialSourceId:source.id,title:"15º Intercâmbio Cultural do Centro Paula Souza — seleção 2026, embarques 2027",
    institution:source.institutionName,sourcePageUrl:CPS_OPEN_URL,applicationUrl:CPS_OPEN_URL,applicantType:"mixed",
    applicationRoute:"direct_student_application",benefitType:"other",categories:["bolsas","intercambios"],isCourse:false,nationallyEligible:false,
    geographicScopeKind:"unknown",countryCode:null,stateCode:null,cityName:null,deadlineAt:deadline,deadlinePrecision:"date_only",hasRetification:endDay === "22",
    opportunityStatus:terminal ?? (!open.length || today > deadline ? "closed" : today < "2026-09-23" ? "upcoming" : "open"),
    reviewStatus:"needs_information",extractionMethod:source.extractionMode,
    requirementsText:`Estudantes de cursos elegíveis das Etecs e Fatecs do Centro Paula Souza. Modalidades com inscrição aberta na consulta: ${open.join(", ") || "nenhuma"}. Critérios acadêmicos variam por edital; não ter participado anteriormente do programa. Consulte o edital da sua modalidade antes de se inscrever. Uma ficha para a edição inteira, sem multiplicar vagas, modalidades ou destinos.`,
    amountText:"Bolsa de intercâmbio de quatro semanas, com curso de idioma, passagens, hospedagem em família, café da manhã e jantar, seguros e ajuda de custo em moeda local. A notícia não informa um valor único; confira coberturas, documentos e despesas pessoais no edital. Seleção não garante contemplação.",
    evidenceJson:{deadline_at:endDay === "22" ? proof("Editais ARI 033 a 038/2026; prazo retificado na listagem oficial: De 23/09 até 22/10.") : proof(window[0],CPS_CULTURAL_NEWS),opportunity_status:proof(`Editais ARI 033 a 038/2026; modalidades abertas: ${open.join(", ") || "nenhuma"}; prazo de 23/09 a ${endDay}/10.`),
      requirements:proof("Cursos elegíveis de Etecs/Fatecs; critérios acadêmicos por edital; não ter participado anteriormente.",CPS_CULTURAL_NEWS),
      amount:proof("Bolsa completa: curso intensivo de quatro semanas, passagens internacionais, hospedagem em família e ajuda de custo em moeda local.",CPS_CULTURAL_NEWS)},
    contentHash:crypto.createHash("sha256").update(`cps-cultural-v2\n${deadline}\n${open.join("|")}\n${announcement}`).digest("hex") }];
}
