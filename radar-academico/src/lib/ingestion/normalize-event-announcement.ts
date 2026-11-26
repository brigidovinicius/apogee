import { createHash } from "node:crypto";
import { load } from "cheerio";
import { normalizeBrazilianLocation } from "@/lib/location";
import { candidateUrl } from "@/lib/discovery/documents";
import { detectDeadline } from "./detect-deadline";
import { classifyDiscovery } from "./discovery";
import { eventHasNotStarted, eventStartFromText } from "./event-start";
import { explicitDatesToNumeric } from "./explicit-dates";
import { confirmedTerminalStatus, deadlineIsCurrent } from "./publication";
import { auditedUfscPage } from "./ufsc-discovery-policy";
import type { OfficialSource, OpportunityCandidate } from "./types";

const clean = (text: string) => text.normalize("NFC").replace(/\s+/g, " ").trim();
const eventTitle = /\b(?:abertura da temporada|palestra|workshop|oficina|exposiç(?:ão|ões)|feira|festival|congresso|seminário|conferência|concerto|evento|encontro|hackathon|mostra|apresentação|simpósio|webinar)\b/iu;
const openToPublic = /\babert[ao]s? (?:ao público|à comunidade|a toda a comunidade)\b|\bsem (?:necessidade de )?inscriç(?:ão|ões)\b/iu;
const closedToPublic = /\b(?:restrit[ao]s?|exclusiv[ao]s?) (?:aos? |às? |para )|\bsomente (?:para |a )?(?:convidados|servidores|participantes)\b/iu;

const weekdays = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

/** Resolve explicit relative news wording against the publication date, not the crawl clock. */
function relativeUfscEvent(lines: string[], html: string | undefined, source: OfficialSource) {
  if (!html || !auditedUfscPage(source) || new URL(source.baseUrl).hostname !== "noticias.ufsc.br") return null;
  const metadata = load(html)('meta[property="article:published_time"]');
  const published = metadata.attr("content") ?? "";
  if (metadata.length !== 1 || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(published) ||
      !Number.isFinite(Date.parse(published))) return null;
  const statements = lines.filter(line => /\b(?:realiza|recebe|sedia|promove)\b.{0,160}\b(?:nesta|neste|na próxima|no próximo)\b/iu.test(line));
  if (statements.length !== 1 || !eventTitle.test(statements[0])) return null;
  const statement = statements[0];
  const day = /\b(?:nesta|neste|na próxima|no próximo)\s+(domingo|segunda-feira|terça-feira|quarta-feira|quinta-feira|sexta-feira|sábado),\s*(\d{1,2}) de (\p{L}+)(?=[,.;])/iu.exec(statement);
  const access = /\b(?:no|na|em) ([^,.;]{4,160}), com entrada gratuita e aberta ao público, sem necessidade de inscrição\b/iu.exec(statement);
  if (!day || !access) return null;
  const localDay = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(published));
  const date = new Date(localDay + "T12:00:00Z");
  for (let offset = 1; offset <= 7; offset++) {
    date.setUTCDate(date.getUTCDate() + 1);
    if (weekdays[date.getUTCDay()] !== day[1].toLowerCase()) continue;
    const numeric = explicitDatesToNumeric(`${day[2]} de ${day[3]} de ${date.getUTCFullYear()}`);
    if (eventStartFromText("Data do evento: " + numeric) !== date.toISOString().slice(0, 10)) return null;
    return { when: `${numeric}; ${day[0]}; notícia publicada em ${localDay}`, where: access[1], access: access[0] };
  }
  return null;
}

/** Parse one event service on an already verified organizer's detail page. */
export function normalizeEventAnnouncement(article: { title: string; text: string; html: string },
  source: OfficialSource, now = new Date(), originalHtml?: string): OpportunityCandidate | null {
  if (!source.categories.includes("eventos")) return null;
  const $ = load(article.html.replace(/[\r\n]+/g, " "));
  $("[hidden],[aria-hidden='true'],[disabled],[aria-disabled='true'],script,style,form").remove();
  $("br").replaceWith("\n");
  $("p,li,div,td").append("\n");
  const lines = $("body").text().split("\n").map(clean).filter(Boolean);
  const values = (label: RegExp) => lines.filter(line => label.test(line)).map(line => line.replace(label, "").trim());
  const what = values(/^o quê:\s*/iu);
  const dates = values(/^(?:quando|data do evento|realização):\s*/iu);
  const venues = values(/^(?:onde|local do evento|local):\s*/iu);
  const relative = !dates.length && !venues.length ? relativeUfscEvent(lines, originalHtml, source) : null;
  const when = relative?.when ?? dates[0];
  const where = relative?.where ?? venues[0];
  if (what.length > 1 || dates.length > 1 || venues.length > 1 || !when || !where || where.length > 350 ||
      !relative && !eventTitle.test(`${article.title} ${what[0] ?? ""}`)) return null;
  const numeric = explicitDatesToNumeric(when);
  if (!/^\d{1,2}\/\d{1,2}\/20\d{2}\b/.test(numeric) || (numeric.match(/\b\d{1,2}\/\d{1,2}\/20\d{2}\b/g)?.length ?? 0) !== 1 ||
      /\b(?:sábados|domingos|semanalmente|mensalmente|todos os dias)\b/iu.test(when)) return null;
  const start = eventStartFromText("Data do evento: " + numeric);
  if (!start) return null;

  const deadline = detectDeadline(article.text);
  if (deadline.stated && deadline.precision === "not_informed") return null;
  const admissions = lines.filter(line => /^entradas?:|^quanto:|^inscriç(?:ão|ões):|^participação:|abert[ao] ao público|sem necessidade de inscri/iu.test(line)).slice(0, 6);
  const visit = admissions.some(line => /^quanto:\s*entrada gratuita\b/iu.test(line))
    ? lines.find(line => /gratuidade da visitação a toda (?:a )?comunidade/iu.test(line))
    : undefined;
  const publicNotice = relative?.access ?? admissions.find(line => openToPublic.test(line) && !closedToPublic.test(line)) ?? visit;
  const links = $("a[href]").toArray().flatMap(node => {
    const label = clean($(node).text());
    if (!/^(?:inscreva-se|inscrição|inscrições|confirmar presença|quero participar)(?:\s+(?:aqui|no evento))?$/iu.test(label)) return [];
    try {
      const application = candidateUrl(new URL($(node).attr("href")!, source.baseUrl).href);
      return application ? [{ application, label }] : [];
    } catch { return []; }
  });
  if (new Set(links.map(link => link.application)).size > 1 || !links.length && !publicNotice) return null;
  const restricted = admissions.some(line => closedToPublic.test(line));
  if (restricted) return null;

  const city = /(?:^|,\s*)([\p{L}][\p{L} .'-]{1,80})\s*(?:[-–—,/]\s*|\(\s*)([A-Z]{2})\)?$/u.exec(where);
  const location = normalizeBrazilianLocation({ stateCode: city?.[2], cityName: city?.[1] }).location;
  const application = links[0]?.application ?? source.baseUrl;
  const access = links[0] ? links[0].label + "; " + application : publicNotice!;
  const dated = deadline.precision !== "not_informed" && !deadlineIsCurrent({ deadlinePrecision: deadline.precision, deadlineAt: deadline.deadlineAt }, now);
  const terminal = confirmedTerminalStatus(article.text, article.title);
  const status = terminal ?? (dated || !eventHasNotStarted(start, now) ? "closed" : "open");
  const title = article.title;
  const proof = (excerpt: string) => ({ source_url: source.baseUrl, excerpt });
  return {
    officialSourceId: source.id, title, institution: source.institutionName, sourcePageUrl: source.baseUrl,
    applicationUrl: application, applicantType: "mixed", applicationRoute: "direct_application",
    benefitType: "other", categories: ["eventos"], isCourse: false, nationallyEligible: false,
    geographicScopeKind: location.cityName ? "city" : "unknown", countryCode: location.cityName ? "BR" : null,
    ...location, eventStartsAt: start, deadlinePrecision: deadline.precision,
    ...(deadline.deadlineAt ? { deadlineAt: deadline.deadlineAt } : {}),
    opportunityStatus: status, reviewStatus: "needs_information", extractionMethod: "html",
    requirementsText: `Local divulgado: ${where}. ${article.text.slice(0, 1700)}`,
    amountText: admissions.some(line => /entrada gratuita|evento gratuito/iu.test(line))
      ? "Entrada gratuita." : "Consulte valores e condições na fonte oficial.",
    evidenceJson: {
      event_start: proof(when), location: proof(where), registration_availability: proof(access),
      opportunity_status: proof(terminal ? article.text.slice(0, 1500) : access),
      ...(deadline.deadlineAt ? { deadline_at: proof(article.text.slice(0, 2000)) } : {}),
    },
    discovery: { ...classifyDiscovery(title, ["eventos"]), editions: [{
      id: source.id, name: title, stages: [{ id: "event", name: "Realização", kind: "event",
        start, sourceUrl: source.baseUrl, checkedAt: now.toISOString() }],
    }] },
    contentHash: createHash("sha256").update(JSON.stringify({ title, when, where,
      application, status, access, deadline, text: article.text })).digest("hex"),
  };
}
