import crypto from "node:crypto";
import * as cheerio from "cheerio";
import { brazilianStateCode, normalizeBrazilianLocation } from "@/lib/location";
import { asObject, publicText } from "./structured-events";
import { parseEventStart, eventHasNotStarted } from "./event-start";
import { confirmedTerminalStatus, deadlineIsCurrent } from "./publication";
import { detectDeadline } from "./detect-deadline";
import { isAllowedHostname } from "./validate-url";
import type { OfficialSource, OpportunityCandidate } from "./types";
import { sameDiscoveryScope } from "@/lib/discovery/documents";
import { classifyDiscovery } from "./discovery";

const clean = (value: string) => value.normalize("NFC").replace(/\s+/gu, " ").trim();
const relevant = /hackathon|workshop|\bia\b|inteligência artificial|programaç|tecnologia|empreendedor|startup|ciência|carreira|builders|pitch|pesquisa|educaç|formação|oficina|olimp[ií]ada|astronom|astrof[íi]s|astron[áa]ut|aeroespac/i;
function publicUrl(value: unknown): string | null {
  try {
    if (typeof value !== "string") return null;
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && (!url.port || url.port === "443") &&
      isAllowedHostname(url.hostname) ? url.href : null;
  } catch { return null; }
}
/** A foreign platform must identify the same already verified organizer, not merely link to it. */
export function eventOrganizerVerified(event: Record<string, unknown>, source: OfficialSource) {
  const authority = /; authority=(.+)$/.exec(source.notes ?? "")?.[1];
  if (!authority) return false;
  return (Array.isArray(event.organizer) ? event.organizer : [event.organizer]).some(raw => {
    const org = asObject(raw), url = publicUrl(org?.url);
    if (typeof org?.name !== "string" || clean(org.name) !== clean(source.institutionName) || !url) return false;
    if (url === authority) return true;
    // Shared Luma calendars identify distinct organizers by the full URL.
    return new URL(authority).hostname !== "luma.com" && sameDiscoveryScope(authority, url);
  });
}

export function normalizePublicEvent(html: string, event: Record<string, unknown>, source: OfficialSource, now = new Date()): OpportunityCandidate | null {
  if (!eventOrganizerVerified(event, source) || typeof event.name !== "string" ||
    event.url !== source.baseUrl || !relevant.test(`${event.name} ${typeof event.description === "string" ? publicText(event.description) : ""}`)) return null;
  let start: string | null, end: string | null;
  try { start = parseEventStart(event.startDate); end = parseEventStart(event.endDate); }
  catch { return null; }
  if (!start || end && Date.parse(end) < Date.parse(start)) return null;
  const location = asObject(event.location), address = asObject(location?.address);
  const virtual = event.eventAttendanceMode === "https://schema.org/OnlineEventAttendanceMode" && location?.["@type"] === "VirtualLocation";
  const country = typeof address?.addressCountry === "string" ? address.addressCountry : asObject(address?.addressCountry)?.name;
  const state = brazilianStateCode(address?.addressRegion);
  const city = typeof address?.addressLocality === "string" ? clean(address.addressLocality) : null;
  if (!virtual && (!/^(?:BR|Brasil|Brazil)$/i.test(String(country)) || !state || !city ||
    normalizeBrazilianLocation({ stateCode: state, cityName: city }).status !== "valid")) return null;

  const $ = cheerio.load(html);
  $("script,style,noscript,nav,header,footer,aside,[class*=attendee],[class*=avatar]").remove();
  const visible = publicText($.html());
  const controls = $("a,button").toArray().filter(node => !$(node).is('[disabled],[aria-disabled="true"],[hidden]'))
    .filter(node => /^(?:inscreva-se|inscrever-se|inscrição|inscrições|quero participar|register|request to join|get tickets?|comprar ingressos?|join waitlist|lista de espera|entrar na lista de espera)/i.test(clean($(node).text())));
  const offers = (Array.isArray(event.offers) ? event.offers : [event.offers]).map(asObject).filter(o => o !== null);
  const matchingOffers = offers.filter(offer => {
    const url = publicUrl(offer.url);
    if (!url) return false;
    return controls.some(node => {
      const href = $(node).attr("href");
      try { return href ? new URL(href, source.baseUrl).href === url : url === source.baseUrl; }
      catch { return false; }
    });
  });
  const available = matchingOffers.filter(offer => offer.availability === "https://schema.org/InStock" &&
    (!offer.validFrom || typeof offer.validFrom === "string" && Number.isFinite(Date.parse(offer.validFrom)) && Date.parse(offer.validFrom) <= +now));
  const terminal = confirmedTerminalStatus(visible, event.name);
  const registrationNotice = /Registration (?:Closed|Full)|Event Full/i.exec(visible)?.[0] ?? "";
  const waitlisted = controls.some(node => /^(?:join waitlist|lista de espera|entrar na lista de espera)$/i.test(clean($(node).text())));
  const cancelled = event.eventStatus === "https://schema.org/EventCancelled";
  const soldOut = matchingOffers.length > 0 && matchingOffers.every(offer => offer.availability === "https://schema.org/SoldOut");
  const deadline = detectDeadline(visible);
  if (deadline.stated && deadline.precision === "not_informed") return null;
  const expiredDeadline = deadline.precision !== "not_informed" && !deadlineIsCurrent({ deadlineAt: deadline.deadlineAt, deadlinePrecision: deadline.precision }, now);
  const status = cancelled ? "cancelled" : terminal ?? (!eventHasNotStarted(start, now) || soldOut || expiredDeadline || registrationNotice || waitlisted ? "closed" : "open");
  if (status === "open" && (event.eventStatus !== "https://schema.org/EventScheduled" || !available.length)) return null;
  const title = clean(event.name);
  const application = publicUrl((available[0] ?? matchingOffers[0])?.url);
  if (!application) return null;
  const description = typeof event.description === "string" ? clean(publicText(event.description)).slice(0, 2000) : "";
  const price = (available[0] ?? matchingOffers[0])?.price;
  const currency = (available[0] ?? matchingOffers[0])?.priceCurrency;
  const priceText = (typeof price === "number" && Number.isFinite(price) && price >= 0 || typeof price === "string" && /^\d+(?:\.\d+)?$/.test(price)) && typeof currency === "string" && /^[A-Z]{3}$/.test(currency)
    ? `Valor anunciado: ${currency} ${price}.` : "Consulte os valores e as condições na fonte oficial.";
  const deadlineNotice = /(?:inscriç(?:ão|ões)|candidaturas|submissões|prazo).{0,140}\d{1,2}\/\d{1,2}\/\d{4}/i.exec(visible)?.[0] ?? "";
  const proof = { source_url: source.baseUrl, excerpt: clean(`${title}; ${start}; ${event.eventStatus}; ${matchingOffers.map(o => o.availability).join(", ")}; ${application}; ${controls.map(node => clean($(node).text())).join(", ")}; ${registrationNotice}; ${deadlineNotice}; ${priceText}; ${virtual ? "Evento online" : `${country}; ${state}; ${city}`}`) };
  const admissionCondition = controls.some(node => /^request to join$/i.test(clean($(node).text())))
    ? "Pedido de inscrição sujeito à aprovação do organizador; cadastro não garante entrada."
    : "Inscrição sujeita à disponibilidade e às regras do organizador.";
  const categories: NonNullable<OpportunityCandidate['categories']> = /hackathon|competição|desafio/i.test(title) ? ["competicoes", "eventos"] : ["eventos"];
  return { officialSourceId: source.id, title, institution: source.institutionName, sourcePageUrl: source.baseUrl, applicationUrl: application,
    applicantType: "mixed", applicationRoute: "direct_application", benefitType: "other", categories,
    isCourse: false, nationallyEligible: false, geographicScopeKind: virtual ? "unknown" : "city", countryCode: virtual ? null : "BR",
    stateCode: virtual ? null : state, cityName: virtual ? null : city, eventStartsAt: start,
    deadlinePrecision: deadline.precision, ...(deadline.deadlineAt ? { deadlineAt: deadline.deadlineAt } : {}),
    opportunityStatus: status, reviewStatus: "needs_information", requirementsText: `${description || "Consulte os requisitos de participação na fonte oficial."} ${admissionCondition}`,
    amountText: priceText, extractionMethod: "html", evidenceJson: { event_start: proof, registration_availability: proof, opportunity_status: proof,
      organizer: { source_url: source.baseUrl, excerpt: `${source.institutionName}; ${/; authority=(.+)$/.exec(source.notes ?? "")?.[1]}` },
      ...(deadline.deadlineAt ? { deadline_at: proof } : {}) },
    discovery: { ...classifyDiscovery(title, categories), editions: [{ id: source.id, name: title, stages: [{ id: "event", name: "Realização", kind: "event", start,
      ...(end ? { end } : {}), sourceUrl: source.baseUrl, checkedAt: now.toISOString() }] }] },
    contentHash: crypto.createHash("sha256").update(JSON.stringify({ version: 1, title, start, end, status, application, priceText,
      description, admissionCondition, deadlineAt: deadline.deadlineAt ?? null, deadlinePrecision: deadline.precision, state, city, virtual })).digest("hex") };
}
