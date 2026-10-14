import crypto from "node:crypto";
import * as cheerio from "cheerio";
import type { OfficialSource, OpportunityCandidate } from "./types";
import { detectDeadline } from "./detect-deadline";
import { eventHasNotStarted, parseEventStart } from "./event-start";
import { confirmedTerminalStatus } from "./publication";

// The agenda includes third-party events. Only individually audited editions
// organized/coorganized by ACATE can use this adapter.
const editions: Record<string, string> = {
  "https://www.acate.com.br/agenda-de-eventos/decola-acate-startups-rio-do-sul-2026/": "Decola ACATE Startups – Rio do Sul",
  "https://www.acate.com.br/agenda-de-eventos/decola-acate-startups-lages-2026/": "Decola ACATE Startups – Lages",
  "https://www.acate.com.br/agenda-de-eventos/peopletech-summit-2026/": "Peopletech Summit 2026",
};
export function isAuditedAcateEventUrl(url: string) { return Object.hasOwn(editions, url); }
const months: Record<string, string> = { JAN: "01", FEV: "02", MAR: "03", ABR: "04", MAI: "05", JUN: "06", JUL: "07", AGO: "08", SET: "09", OUT: "10", NOV: "11", DEZ: "12" };
const clean = (text: string) => text.replace(/\s+/g, " ").trim();

export function normalizeAcateEvent(html: string, url: string, source: OfficialSource, now = new Date()): OpportunityCandidate | null {
  if (source.id !== "acate-audited-events" || !isAuditedAcateEventUrl(url)) return null;
  const $ = cheerio.load(html), title = clean($("h1").text()), article = $("article");
  if (article.length !== 1 || title !== editions[url] || $("link[rel=canonical]").attr("href") !== url) throw new Error("Página oficial da edição indisponível ou estrutura alterada");
  const description = clean(article.find(".content-texto-detalhes-agenda").text());
  const location = clean(article.find(".localizacao-detalhes-agenda").text());
  const city = / - ([\p{L} .'-]+) \(SC\)$/u.exec(location)?.[1];
  const dateText = article.find("div").map((_, node) => clean($(node).text())).get()
    .find(text => /^\d{1,2} de [A-Z]{3} de 20\d{2}$/.test(text));
  const date = dateText && /^(\d{1,2}) de ([A-Z]{3}) de (20\d{2})$/.exec(dateText);
  if (!description || !city || !date || !months[date[2]]) return null;
  let eventStartsAt: string;
  try { eventStartsAt = parseEventStart(`${date[3]}-${months[date[2]]}-${date[1].padStart(2, "0")}`)!; }
  catch { return null; }
  const text = clean(article.text()), deadline = detectDeadline(text);
  const terminal = confirmedTerminalStatus(text, title);
  if (!terminal && (deadline.precision !== "not_informed" || deadline.stated)) return null;
  const registration = article.find("a[href]").filter((_, node) => /^inscreva-se$/i.test(clean($(node).text())));
  if (!terminal && registration.length !== 1) return null;
  const applicationUrl = terminal ? url : registration.attr("href");
  try {
    const application = new URL(applicationUrl!);
    if (application.protocol !== "https:" || application.username || application.password ||
      !["www.sympla.com.br", "sc.acate.com.br", "www.acate.com.br"].includes(application.hostname)) return null;
  } catch { return null; }
  const registrationProof = { source_url: url, excerpt: "Inscreva-se — chamada de inscrição na página oficial desta edição; sem prazo final ou quantidade de vagas informados." };
  return {
    officialSourceId: source.id, title, institution: source.institutionName,
    sourcePageUrl: url, applicationUrl, applicantType: "mixed", applicationRoute: "direct_application",
    benefitType: "other", categories: ["eventos"], isCourse: false, nationallyEligible: false,
    countryCode: "BR", stateCode: "SC", cityName: city, geographicScopeKind: "city",
    deadlinePrecision: "not_informed", eventStartsAt,
    opportunityStatus: terminal ?? (eventHasNotStarted(eventStartsAt, now) ? "open" : "closed"),
    reviewStatus: "needs_information", extractionMethod: "html",
    // The visible hour has no confirmed timezone and remains textual.
    requirementsText: `Evento em ${location}. ${description.slice(0, 2000)} Horário local anunciado: ${clean(article.find(".horario-detalhes-agenda").text()) || "não informado"}. Confira ingresso e condições na inscrição; não há escolaridade ou idade mínima comprovada nesta página.`,
    amountText: "Custo e benefícios financeiros não informados na página oficial. Não presumir gratuidade; consulte as condições de ingresso.",
    evidenceJson: { event_start: { source_url: url, excerpt: dateText! }, registration_availability: registrationProof,
      opportunity_status: terminal ? { source_url: url, excerpt: text.slice(0, 1500) } : registrationProof,
      location: { source_url: url, excerpt: location } },
    contentHash: crypto.createHash("sha256").update(`acate-event-v1\n${title}\n${text}\n${applicationUrl}`).digest("hex"),
  };
}
