import crypto from "node:crypto";
import * as cheerio from "cheerio";
import type { OfficialSource, OpportunityCandidate } from "./types";
import { detectDeadline } from "./detect-deadline";
import { confirmedTerminalStatus } from "./publication";

export const EVG_POLICY_URL = "https://www.escolavirtual.gov.br/perguntas-frequentes";
export type EvgPolicy = { source_url: string; excerpt: string };
export function normalizeEvgPolicy(html: string): EvgPolicy {
  const $ = cheerio.load(html); $("script,style,nav,footer,header").remove();
  const text = clean($("body").text());
  const sentence = /Todos os cursos da Escola Virtual de Governo \(EV\.G\) são de autoinstrução, sem tutoria, com certificado e gratuitos\./.exec(text)?.[0];
  if (!sentence) throw new Error("Gratuidade da oferta EV.G não confirmada");
  return { source_url: EVG_POLICY_URL, excerpt: sentence };
}
export const EVG_SOURCE_ID = "evg-enap-open-courses";
export const isEvgCourseUrl = (url: string) => /^https:\/\/www\.escolavirtual\.gov\.br\/curso\/\d+$/.test(url);
const clean = (text: string) => text.replace(/\s+/g, " ").trim();
export function isIndependentEvgCourse(title: string) {
  return !/[-–]\s*M\d{1,2}\s*[-–]|^(?:eixo|módulo|trilha|programa)\b|\b(?:nova versão|reedição)\b|\b(?:eixo|módulo)\s+\d+\b|\bversão\s*[:–-]?\s*(?:\d|atualizada)|\b\d+[ªa]\s*edição\b|\bedição\s*[:–-]?\s*20\d{2}/i.test(title);
}

/** EV.G operates enrollment and certification; the content provider is attributed separately. */
export function normalizeEvgCourse(html: string, url: string, source: OfficialSource, policy?: EvgPolicy): OpportunityCandidate | null {
  if (source.id !== EVG_SOURCE_ID || !isEvgCourseUrl(url) || /\/curso\/(?:318|627)$/.test(url)) return null;
  const $ = cheerio.load(html), main = $("main.curso-detalhe"), intro = main.find(".box-curso-intro");
  const rawTitle = clean(intro.find("h2").text()), offer = main.find("#collapseOferta");
  if (main.length !== 1 || intro.length !== 1 || !rawTitle || offer.length !== 1 || !offer.find("dl").length) throw new Error("Detalhe EV.G indisponível ou estrutura alterada");
  if (!isIndependentEvgCourse(rawTitle)) return null;
  const fields = new Map<string, string>();
  offer.find("dt").each((_, node) => { fields.set(clean($(node).text()).replace(/:$/, ""), clean($(node).next("dd").text())); });
  const provider = fields.get("Conteudista") ?? "", certifier = fields.get("Certificador") ?? "", language = fields.get("Idioma");
  if (!provider || certifier !== "Enap - Escola Nacional de Administração Pública" || language !== "Português") return null;
  const publicAudience = fields.get("Público Alvo") ?? "";
  const other = clean(main.find("#collapseOutrasInformacoes .accordion-body").text());
  const firstDescription = clean(intro.find("p").first().text());
  const explicitIntroNotice = /^(?:aviso:\s*)?(?:(?:as?\s+)?inscriç(?:ão|ões)|este curso|o curso|curso|a turma)\s+(?:(?:foi|foram|está|estão|temporariamente)\s+)*(?:cancelad|suspens|encerrad|finalizad|esgotad)/i.test(firstDescription) ? firstDescription : "";
  const terminalText = clean(`${intro.find(".badges").text()} ${explicitIntroNotice} ${intro.find("p").slice(1).text()} ${offer.find(".accordion-body").children("p").text()} ${other} ${main.find(".alert,[role=alert]").text()} ${publicAudience}`);
  const terminal = confirmedTerminalStatus(terminalText, rawTitle);
  const registration = offer.find("a[href]").filter((_, node) => /^Inscreva-se$/i.test(clean($(node).text())));
  const applicationUrl = registration.attr("href");
  const deadline = detectDeadline(terminalText);
  const free = /\bgratuit[oa]\b/i.test(publicAudience) && !/não (?:é |será )?gratuit/i.test(publicAudience) || policy?.source_url === EVG_POLICY_URL;
  const available = registration.length === 1 && /^https:\/\/www\.escolavirtual\.gov\.br\/secretaria\/inscricao\/\d+$/.test(applicationUrl ?? "") &&
    /^Curso Aberto$/i.test(clean(intro.find(".badges").text())) && free && !/não (?:é |será )?gratuit|taxa de inscrição|cobrança/i.test(publicAudience) && Boolean(publicAudience) && !deadline.stated && !deadline.deadlineAt && /Você pode inscrever-se a qualquer momento e iniciar imediatamente\./i.test(other) &&
    !/\b(?:restrit[oa]s?|exclusiv[oa]s?|exclusivamente|somente|apenas para)\b/i.test(publicAudience);
  if (!available && !terminal) return null;
  const title = `${rawTitle} — ${provider} (EV.G)`;
  const proof = { source_url: url, excerpt: terminal ? terminalText : `${other}; ${publicAudience}; Inscreva-se — matrícula na própria EV.G.` };
  const programme = fields.get("Conteúdo Programático") ?? "";
  const requirementsText = `Oferta e certificação: EV.G/Enap. Conteúdo: ${provider}. ${publicAudience} Idioma: ${language}. Carga horária: ${fields.get("Carga Horária") || "não informada"}. Disponibilidade para realização após a inscrição: ${fields.get("Disponibilidade") || "não informada"}; essa duração não é prazo de matrícula. ${programme.slice(0, 1800)} Consulte a oferta oficial para condições de conclusão e emissão do certificado.`;
  return { officialSourceId: source.id, title, institution: `Escola Virtual de Governo / Enap; conteúdo: ${provider}`,
    sourcePageUrl: url, applicationUrl: applicationUrl ?? url, applicantType: "mixed", applicationRoute: "direct_student_application",
    benefitType: "other", categories: ["formacao"], isCourse: true, nationallyEligible: false,
    countryCode: null, stateCode: null, cityName: null, geographicScopeKind: "unknown",
    deadlineAt: undefined, deadlinePrecision: "continuous_flow", opportunityStatus: terminal ?? "open", reviewStatus: "needs_information", extractionMethod: "html",
    requirementsText, amountText: "Curso gratuito com certificado. Bolsa, auxílio financeiro e remuneração não informados na oferta.",
    evidenceJson: { ...(policy ? { fees: policy } : { fees: { source_url: url, excerpt: publicAudience } }), deadline_at: proof, opportunity_status: proof, requirements: { source_url: url, excerpt: publicAudience },
      organizer: { source_url: url, excerpt: `Conteudista: ${provider}; Certificador: ${certifier}; matrícula na EV.G.` } },
    contentHash: crypto.createHash("sha256").update(JSON.stringify({ title, provider, certifier, language, publicAudience, other, programme, applicationUrl, terminal, workload: fields.get("Carga Horária"), availability: fields.get("Disponibilidade") })).digest("hex") };
}

export function parseEvgListing(html: string) {
  const $ = cheerio.load(html), cards = $(".courseboxes .card[id^='curso']");
  if (cards.length < 1 || cards.length > 12) throw new Error("Catálogo EV.G indisponível ou estrutura alterada");
  return cards.toArray().flatMap(node => {
    const title = clean($(node).find(".card-title a").text()), url = $(node).find(".card-title a[href]").attr("href");
    if (!url || !isEvgCourseUrl(url) || !title) throw new Error("Curso oficial EV.G não confirmado");
    if (!isIndependentEvgCourse(title) || /\/curso\/(?:318|627)$/.test(url)) return [];
    return [{ title, url, excerpt: title }];
  });
}
