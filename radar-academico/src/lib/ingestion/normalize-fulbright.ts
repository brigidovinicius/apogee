import crypto from "node:crypto";
import * as cheerio from "cheerio";
import { confirmedTerminalStatus } from "./publication";
import type { OfficialSource, OpportunityCandidate } from "./types";

export const FULBRIGHT_SOURCE_ID = "fulbright-ruth-cardoso-selection-2026";
export const FULBRIGHT_URL = "https://fulbright.org.br/bolsas-para-brasileiros/catedra-dra-ruth-cardoso-georgetown/";
const applicationUrl = "https://apply.iie.org/fvsp2027";
const months: Record<string, string> = { janeiro: "01", fevereiro: "02", março: "03", abril: "04", maio: "05", junho: "06", julho: "07", agosto: "08", setembro: "09", outubro: "10", novembro: "11", dezembro: "12" };

/** One audited selection. A reused URL for a later call requires another audit. */
export function normalizeFulbright(html: string, url: string, source: OfficialSource, now = new Date()): OpportunityCandidate | null {
  if (source.id !== FULBRIGHT_SOURCE_ID || url !== FULBRIGHT_URL) return null;
  const $ = cheerio.load(html);
  $("script,style,noscript,nav,footer,header").remove();
  const article = $("article").first();
  article.find("h1,h2,h3,h4,p,li,div,br").each((_, node) => { $(node).prepend(" ").append(" "); });
  const text = article.text().replace(/\s+/g, " ").trim();
  if (!/Cátedra Dra\. Ruth Cardoso na Georgetown University/.test(text) || !/Comissão Fulbright/.test(text)) {
    throw new Error("Página Fulbright sem estrutura ou identidade verificável");
  }
  // Terminal notices take precedence even if the organizer removes its form.
  const terminal = confirmedTerminalStatus(text, "Cátedra Dra. Ruth Cardoso");
  if (terminal || /informações abaixo referem-se ao último edital|previsão para abertura das inscrições/i.test(text)) return null;
  const windows = [...text.matchAll(/Inscrições abertas até\s*(\d{1,2}) de (\p{L}+) de (20\d{2})/giu)];
  if (!windows.length) return null;
  const dates = windows.map((m) => `${m[3]}-${months[m[2].toLowerCase()]}-${m[1].padStart(2, "0")}`);
  if (new Set(dates).size !== 1 || !/^2026-\d{2}-\d{2}$/.test(dates[0])) return null;
  const deadlineAt = dates[0];
  const date = new Date(`${deadlineAt}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== deadlineAt) return null;
  const application = article.find("a[href]").toArray().some((a) =>
    $(a).attr("href") === applicationUrl && /Inscreva-se/i.test($(a).text()));
  const documentUrl = article.find("a[href]").toArray().find((a) =>
    /Leia o edital/i.test($(a).text()) && $(a).attr("href") === "https://fulbright.org.br/wp-content/uploads/2020/12/Call-Dr.-Ruth-Cardoso-at-Georgetown-University.pdf");
  const requirements = /Requisitos\s+(.*?)\s+Benefícios/i.exec(text)?.[1];
  const amount = /Benefícios\s+(.*?)\s+Atenção:/i.exec(text)?.[1];
  if (!application || !documentUrl || !requirements || !amount || requirements.length > 2200 || amount.length > 1500 ||
      !/nacionalidade brasileira e não ter nacionalidade norte-americana/i.test(requirements) ||
      !/doutorado até 30 de julho de 2016/i.test(requirements) || !/fluência em inglês/i.test(requirements) ||
      !/Permanecer no Brasil durante a seleção, afiliação e partida aos EUA/i.test(requirements) ||
      !/Estipêndio para 1 ou 2 semestres acadêmicos/i.test(amount) || !/US\$/.test(amount) || !/Seguro/.test(amount)) return null;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const evidence = (excerpt: string) => ({ source_url: url, excerpt });
  return {
    officialSourceId: source.id, title: "Cátedra Fulbright Dra. Ruth Cardoso — Georgetown (seleção 2026)",
    institution: "Comissão Fulbright Brasil / Georgetown University", sourcePageUrl: url,
    applicationUrl,
    applicantType: "researcher", applicationRoute: "direct_application", benefitType: "research_scholarship",
    categories: ["bolsas", "intercambios", "pesquisa"], isCourse: false, nationallyEligible: false,
    geographicScopeKind: "country", countryCode: "US", stateCode: null, cityName: null,
    deadlineAt, deadlinePrecision: "date_only", opportunityStatus: deadlineAt < today ? "closed" : "open",
    requirementsText: requirements, amountText: amount, reviewStatus: "needs_information",
    evidenceJson: { deadline_at: evidence(windows[0][0]), opportunity_status: evidence(windows[0][0]),
      application_route: evidence("Inscreva-se: " + applicationUrl), requirements: evidence(requirements.slice(0, 1000)),
      amount: evidence(amount), location: evidence("Permanecer no Brasil durante a seleção, afiliação e partida aos EUA.") },
    extractionMethod: source.extractionMode,
    contentHash: crypto.createHash("sha256").update(`fulbright-ruth-2026-v1\n${text}`).digest("hex"),
  };
}
