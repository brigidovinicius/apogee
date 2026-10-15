import crypto from "node:crypto";
import * as cheerio from "cheerio";
import { eventHasNotStarted, parseEventStart } from "./event-start";
import { detectDeadline } from "./detect-deadline";
import { confirmedTerminalStatus } from "./publication";
import type { OfficialSource, OpportunityCandidate } from "./types";

export const ACIM_SW_SOURCE_ID = "acim-startup-weekend-imbituba-2026";
export const ACIM_SW_URL = "https://www.acimimbituba.org/event-details/startup-weekend-imbituba-1";
const clean = (value: string) => value.replace(/\s+/g, " ").trim();
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const reais = (value: unknown) => {
  const cents = typeof value === "string" && /^\d+(?:[.,]\d{1,2})?$/.test(value) ? Math.round(Number(value.replace(",", ".")) * 100) : NaN;
  return Number.isSafeInteger(cents) && cents >= 0 ? cents : null;
};
const money = (value: number) => (value / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** One audited edition; visible fields must agree with the organizer's Event JSON-LD. */
export function normalizeAcimStartupWeekend(html: string, source: OfficialSource, now = new Date()): OpportunityCandidate[] {
  if (source.id !== ACIM_SW_SOURCE_ID) return [];
  const $ = cheerio.load(html);
  if ($("link[rel=canonical]").attr("href") !== ACIM_SW_URL || clean($("h1[data-hook=event-title]").text()) !== "Startup Weekend Imbituba") throw new Error("Página ACIM sem identidade da edição");
  const events: Record<string, unknown>[] = [];
  $("script[type='application/ld+json']").each((_, node) => {
    const value: unknown = JSON.parse($(node).text());
    if (record(value) && value["@type"] === "Event") events.push(value);
  });
  if (events.length !== 1 || !$("[data-hook=about-section]").length || !$("[data-hook=event-full-date]").length || !$("[data-hook=event-full-location]").length) throw new Error("Conteúdo ACIM parcial ou indisponível");
  $("script,style,noscript,nav").remove();
  const event = events[0], about = clean($("[data-hook=about-section]").text()), text = clean($("body").text());
  if (!/ACIM/.test(text) || !text.includes("80.987.837/0001-05") || event.name !== "Startup Weekend Imbituba" || event.description !== "2ª Edição" || !/2ª edição do Techstars Startup Weekend/i.test(about)) return [];
  let start: string | null, end: string | null;
  try { start = parseEventStart(event.startDate); end = parseEventStart(event.endDate); } catch { return []; }
  if (!start?.startsWith("2026-") || !end?.startsWith("2026-") || start.length === 10 || end.length === 10 || Date.parse(end) < Date.parse(start)) return [];
  const visibleDate = clean($("[data-hook=event-full-date]").text());
  const expectedDate = (iso: string) => new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(new Date(iso));
  // Wix labels repeat the start/end local dates; compare all numbers and month names.
  const dateParts = (value: string) => value.toLowerCase().replace(/\bde\b|[,.\s]/g, "");
  if (dateParts(visibleDate) !== dateParts(`${expectedDate(start)} – ${expectedDate(end)}`)) return [];
  if (event.eventAttendanceMode !== "https://schema.org/OfflineEventAttendanceMode") return [];
  const location = clean($("[data-hook=event-full-location]").text());
  if (!record(event.location) || event.location.name !== "SCPAR Porto de Imbituba" || typeof event.location.address !== "string" || !event.location.address.includes("Imbituba - SC") || !location.includes(event.location.address)) return [];
  const offers = record(event.offers) ? event.offers : null;
  const notice = confirmedTerminalStatus(about, "Startup Weekend Imbituba");
  const status: OpportunityCandidate["opportunityStatus"] = notice ?? (event.eventStatus === "https://schema.org/EventCancelled" ? "cancelled" :
    event.eventStatus === "https://schema.org/EventPostponed" ? "suspended" :
      event.eventStatus !== "https://schema.org/EventScheduled" ? "unknown" :
        offers?.availability === "https://schema.org/SoldOut" || !eventHasNotStarted(start, now) ? "closed" :
          offers?.availability === "https://schema.org/InStock" ? "open" : "unknown");
  let amount = "Consulte as condições de ingresso na fonte oficial.";
  const base = reais(/R\$\s*([\d.,]+)/.exec(clean($("[data-hook=ticket] [data-hook=price]").text()))?.[1]);
  const fee = reais(/R\$\s*([\d.,]+)/.exec(clean($("[data-hook=ticket] [data-hook=wix-fee]").text()))?.[1]);
  if (status === "open") {
    const deadline = detectDeadline(about);
    if (deadline.precision !== "not_informed" || deadline.stated) return [];
    const activeButton = $("button[data-hook=get-tickets-button],button[data-hook=reserve-tickets-button]").toArray().some((node) => !$(node).is(":disabled") && $(node).attr("aria-disabled") !== "true");
    const tickets = offers && Array.isArray(offers.offers) ? offers.offers : [];
    const saleIsCurrent = (o: Record<string, unknown>) => {
      if (o.validThrough) return false;
      if (!o.validFrom) return true;
      try { const date = parseEventStart(o.validFrom); return !!date && date.length > 10 && Date.parse(date) <= now.getTime(); }
      catch { return false; }
    };
    if (!activeButton || !offers || !saleIsCurrent(offers) || offers.priceCurrency !== "BRL" || !tickets.length || base === null || fee === null || !tickets.every((o) => record(o) && saleIsCurrent(o) && o.priceCurrency === "BRL" && o.availability === "https://schema.org/InStock" && o.url === ACIM_SW_URL && reais(o.price) === base + fee) || reais(offers.lowPrice) !== base + fee || reais(offers.highPrice) !== base + fee) return [];
    amount = `Ingresso anunciado: R$ ${money(base)} + R$ ${money(fee)} de taxa (total R$ ${money(base + fee)}). Consulte lote e condições de venda na fonte oficial; auxílio financeiro não confirmado.`;
  }
  const evidence = (excerpt: string) => ({ source_url: ACIM_SW_URL, excerpt });
  const availability = `Event ${event.eventStatus}; oferta ${offers?.availability ?? "não informada"}; início ${start}; ${notice ?? "INGRESSOS / Checkout na página da edição"}.`;
  return [{ officialSourceId: source.id, title: "Startup Weekend Imbituba — 2ª edição 2026", institution: source.institutionName,
    sourcePageUrl: ACIM_SW_URL, applicationUrl: ACIM_SW_URL, applicantType: "mixed", applicationRoute: "direct_application", benefitType: "other", categories: ["eventos"],
    isCourse: false, nationallyEligible: false, geographicScopeKind: "city", countryCode: "BR", stateCode: "SC", cityName: "Imbituba",
    deadlinePrecision: "not_informed", eventStartsAt: start, opportunityStatus: status, reviewStatus: "needs_information", extractionMethod: source.extractionMode,
    requirementsText: `Participação presencial na 2ª edição do Techstars Startup Weekend em ${location}, de ${start.slice(0,10).split("-").reverse().join("/")} a ${end.slice(0,10).split("-").reverse().join("/")}. Ingresso pago. Idade e escolaridade mínimas não estão comprovadas nesta página; consulte a organização antes da inscrição. Não há prazo final de inscrição informado.`,
    amountText: amount, evidenceJson: { event_start: evidence(`${visibleDate}; início estruturado: ${start}`), registration_availability: evidence(availability), opportunity_status: evidence(availability), location: evidence(location), amount: evidence(`Preço visível ${clean($("[data-hook=ticket] [data-hook=price]").text())}; taxa ${clean($("[data-hook=ticket] [data-hook=wix-fee]").text())}; oferta estruturada BRL ${offers?.lowPrice ?? "não informada"}–${offers?.highPrice ?? "não informada"}`) },
    contentHash: crypto.createHash("sha256").update(`acim-startup-weekend-v1\n${JSON.stringify(event)}\n${about}\n${visibleDate}\n${location}\n${base}|${fee}|${status}`).digest("hex") }];
}
