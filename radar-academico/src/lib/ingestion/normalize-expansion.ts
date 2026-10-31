import crypto from "node:crypto";
import * as cheerio from "cheerio";
import editions from "../../../references/radar-expansion-20261030/editions.json";
import lumaEvents from "../../../references/radar-expansion-20261030/luma-events.json";
import { asObject, publicText, structuredEvents } from "./structured-events";
import { calendarDate, type Stage } from "./discovery";
import { eventHasNotStarted } from "./event-start";
import { confirmedTerminalStatus } from "./publication";
import type { ApplicantType, OfficialSource, OpportunityCandidate } from "./types";
import type { OpportunityCategory } from "./categories";

export const expansionEdition = (id: string) => editions.find(item => item.id === id);
export const expansionLumaEvent = (id: string) => lumaEvents.find(item => item.id === id);
export const isExpansionSource = (id: string) => Boolean(expansionEdition(id) || expansionLumaEvent(id));
export function expansionSources(): OfficialSource[] {
  return [...editions.map(call => ({ id: call.id, name: call.name, organizer: call.organizer, url: call.url })),
    ...lumaEvents.map(call => ({ id: call.id, name: call.title, organizer: call.organizer, url: call.url }))].map(call => ({
    id: call.id, name: call.name, institutionName: call.organizer, institutionAcronym: "", sourceType: "official_reference",
    baseUrl: call.url, allowedDomains: [new URL(call.url).hostname], allowedPathPrefixes: [new URL(call.url).pathname],
    listingUrls: [call.url], extractionMode: "html", audienceScope: ["mixed"], geographicScope: [], categories: [], priority: 70,
    // Research is not source activation. Activation requires the production fetch/robots audit.
    active: false,
  }));
}
const hash = (value: unknown) => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
const clean = (value: string) => value.normalize("NFC").replace(/\s+/gu, " ").trim();
const today = (now: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
function scope(source: OfficialSource, url: string) {
  if (source.baseUrl !== url || source.listingUrls.length !== 1 || source.listingUrls[0] !== url) throw Error("Escopo diverge da edição auditada");
}
function stages(url: string, now: Date, start?: string | null, end?: string | null): Stage[] {
  return start ? [{ id: "event", name: "Realização", kind: "event", start, ...(end ? { end } : {}), sourceUrl: url, checkedAt: now.toISOString() }] : [];
}
/** Shared catalogues contain closed siblings: only an explicit named notice closes a modality. */
function modalityTerminalStatus(text: string, terms: string[]): { status: OpportunityCandidate["opportunityStatus"]; excerpt: string } | null {
  for (const term of terms) {
    const label = clean(term).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/educadores/gi, "educador(?:es|e\\(a\\)s)");
    const registration = "inscri[cç][oõ]es";
    const verbs = "(?:(?:est[aã]o|foram|est[aá]|foi)\\s+)?(?:temporariamente\\s+)?";
    const subject = `(?:${registration} (?:para |d[oa]s? )?(?:a modalidade )?${label}|${label}(?:\\s*[:—–-]?\\s*(?:(?:com|est[aá] com|tem)\\s+)?${registration})?)`;
    for (const [ending, status] of [["cancelad[oa]s?", "cancelled"], ["suspens[oa]s?", "suspended"], ["encerrad[oa]s?|esgotad[oa]s?", "closed"]] as const) {
      const patterns = [`${subject}\\s*[:—–-]?\\s*${verbs}(?:${ending})\\b`,
        `${registration}\\s+${verbs}(?:${ending})\\s+(?:para|d[oa])\\s+(?:a modalidade )?${label}\\b`];
      for (const pattern of patterns) {
        const match = new RegExp(pattern, "iu").exec(text);
        if (match) return { status, excerpt: match[0] };
      }
    }
  }
  return null;
}
export function normalizeExpansion(html: string, source: OfficialSource, now = new Date()): OpportunityCandidate[] {
  const luma = expansionLumaEvent(source.id);
  if (luma) return [normalizeLuma(html, source, luma, now)];
  const call = expansionEdition(source.id);
  if (!call) return [];
  scope(source, call.url);
  const $ = cheerio.load(html);
  // Isolate article content where available; sidebar deadlines cannot validate a call.
  const article = $("article");
  const text = publicText(article.length === 1 ? article.html()! : $.html());
  const links = new Set($("a[href]").toArray().flatMap(node => {
    try { return [new URL($(node).attr("href")!, call.url).href]; } catch { return []; }
  }));
  return call.items.map(item => {
    if (item.checks.some(check => !clean(text).includes(clean(check)))) throw Error("Evidência, público ou prazo da edição mudou");
    if (item.application && !links.has(item.application)) throw Error("Rota de inscrição não confirmada");
    const current = (!item.opens || item.opens <= today(now)) && (!item.deadline || item.deadline >= today(now));
    const singleStatus = call.items.length === 1 ? confirmedTerminalStatus(text, item.title) : null;
    const noticeAt = text.search(/cancelad|revogad|suspens|encerrad|esgotad/i);
    const terminal = call.items.length > 1 ? modalityTerminalStatus(text, [call.name.split(" — ")[0], ...item.status_terms])
      : singleStatus ? { status: singleStatus, excerpt: text.slice(Math.max(0, noticeAt - 120), Math.max(0, noticeAt) + 300) } : null;
    const status = terminal?.status ?? (item.opens && item.opens > today(now) ? "unknown" : current && (!item.start || eventHasNotStarted(item.start, now)) ? "open" : "closed");
    // Store only the facts relevant to this modality, not other closed modalities/forms.
    const proof = { source_url: call.url, excerpt: item.checks.join("; ") };
    const candidate: OpportunityCandidate = {
      officialSourceId: source.id, title: item.title, institution: call.organizer, sourcePageUrl: call.url, applicationUrl: call.url,
      applicantType: item.applicant as ApplicantType, applicationRoute: "direct_application", benefitType: "other",
      categories: call.categories as OpportunityCategory[], isCourse: false, nationallyEligible: false,
      countryCode: null, stateCode: call.state as OpportunityCandidate["stateCode"], cityName: call.city,
      geographicScopeKind: call.city ? "city" : "unknown", deadlineAt: item.deadline ?? undefined,
      deadlinePrecision: item.deadline ? "date_only" : "not_informed", eventStartsAt: item.start,
      opportunityStatus: status, reviewStatus: "needs_information", requirementsText: item.requirements, amountText: item.conditions,
      extractionMethod: "html", evidenceJson: { opportunity_status: terminal ? { source_url: call.url, excerpt: terminal.excerpt } : proof, deadline_at: proof, requirements: proof, conditions: proof,
        ...(item.start ? { event_start: proof, registration_availability: proof } : {}) },
      discovery: { primaryType: call.categories[0], subtype: call.subtype, areas: item.areas,
        editions: [{ id: source.id, name: item.title, stages: stages(call.url, now, item.start) }] },
      contentHash: hash({ version: 1, id: source.id, item, status }),
    };
    return candidate;
  });
}
function normalizeLuma(html: string, source: OfficialSource, call: typeof lumaEvents[number], now: Date): OpportunityCandidate {
  scope(source, call.url);
  const events = structuredEvents(html);
  if (events.length !== 1 || events[0].url !== call.url || clean(String(events[0].name)) !== call.title) throw Error("Evento Luma ausente ou ambíguo");
  const event = events[0];
  const organizers = Array.isArray(event.organizer) ? event.organizer : [event.organizer];
  if (!organizers.some(raw => { const org = asObject(raw); return org?.url === call.organizer_url && org?.name === call.organizer_name; })) throw Error("Organizador Luma diverge do auditado");
  const description = typeof event.description === "string" ? publicText(event.description) : "";
  if (call.checks.some(check => !clean(description).includes(clean(check)))) throw Error("Condições do evento Luma mudaram");
  const address = asObject(asObject(event.location)?.address);
  const stateName = call.state === "SP" ? "São Paulo" : "Rio de Janeiro";
  if (address?.addressCountry !== "BR" || address.addressLocality !== call.city || ![call.state, stateName].includes(String(address.addressRegion))) {
    throw Error("Localidade pública do evento mudou; confirmar nova localização");
  }
  const start = calendarDate(event.startDate), end = calendarDate(event.endDate);
  if (start.length === 10 || end.length === 10 || Date.parse(end) < Date.parse(start)) throw Error("Horário Luma exige fuso e intervalo válido");
  const $ = cheerio.load(html);
  $("script,style,noscript").remove();
  const buttons = $("button").toArray().filter(node => !$(node).is("[disabled],[aria-disabled=\"true\"],[hidden]"))
    .map(node => clean($(node).text()));
  const controls = buttons.filter(text => /^(Register|Request to Join|Get Tickets?|Join Waitlist)$/i.test(text));
  const rawOffers = (Array.isArray(event.offers) ? event.offers : [event.offers]).map(asObject).filter(offer => offer !== null);
  const offers = rawOffers.flatMap(offer => {
    if (offer.url !== call.url || !["https://schema.org/InStock", "https://schema.org/SoldOut"].includes(String(offer.availability))) return [];
    const price = typeof offer.price === "number" ? offer.price : typeof offer.price === "string" && /^\d+(?:\.\d+)?$/.test(offer.price) ? Number(offer.price) : NaN;
    const currency = typeof offer.priceCurrency === "string" ? offer.priceCurrency.toUpperCase() : "";
    if (!Number.isFinite(price) || price < 0 || !/^[A-Z]{3}$/.test(currency)) return [];
    return [{ price, currency, available: offer.availability === "https://schema.org/InStock" }];
  });
  const available = offers.filter(offer => offer.available);
  const terminalText = clean($("body").text());
  const registrationNotice = /Registration (?:Closed|Full)|Event Full/i.exec(terminalText)?.[0] ?? "";
  const waitlist = controls.includes("Join Waitlist") || Boolean(registrationNotice);
  const cancelled = event.eventStatus === "https://schema.org/EventCancelled";
  const scheduled = event.eventStatus === "https://schema.org/EventScheduled";
  const approved = controls.includes("Request to Join");
  const soldOut = rawOffers.length > 0 && rawOffers.every(offer => offer.url === call.url && offer.availability === "https://schema.org/SoldOut");
  const terminal = cancelled || !eventHasNotStarted(start, now) || waitlist || soldOut;
  const advertisedAvailable = rawOffers.filter(offer => offer.availability === "https://schema.org/InStock");
  if (!terminal && (!scheduled || !available.length || available.length !== advertisedAvailable.length ||
    !controls.some(label => /^(Register|Request to Join|Get Tickets?)$/i.test(label)))) {
    // Missing/invalid metadata is an extraction failure, never confirmed closure.
    throw Error("Disponibilidade do evento Luma não confirmada");
  }
  const status = cancelled ? "cancelled" : terminal ? "closed" : "open";
  const admission = available.length && available.every(offer => offer.price === 0) ? "Inscrição gratuita no lote disponível."
    : available.length ? `Ingresso disponível: ${available.map(offer => `${offer.currency} ${offer.price.toFixed(2)}`).join("; ")}.` : "Sem ingresso disponível confirmado.";
  const proof = { source_url: call.url, excerpt: clean(`${call.title}; ${start} a ${end}; ${event.eventStatus}; ${controls.join(", ")}; ${registrationNotice}; ${rawOffers.map(offer => offer.availability).join(", ")}; ${admission}; ${call.checks.join("; ")}`) };
  const requirements = `${call.requirements} ${approved ? "Pedido de inscrição sujeito à aprovação do organizador; cadastro não garante entrada." : "Inscrição sujeita à disponibilidade e às regras da organização."}`;
  return { officialSourceId: source.id, title: call.title, institution: call.organizer, sourcePageUrl: call.url, applicationUrl: call.url,
    applicantType: "mixed", applicationRoute: "direct_application", benefitType: "other", categories: call.competition ? ["competicoes", "eventos"] : ["eventos"],
    isCourse: false, nationallyEligible: false, geographicScopeKind: "city", countryCode: null,
    stateCode: call.state as OpportunityCandidate["stateCode"], cityName: call.city, eventStartsAt: start,
    deadlinePrecision: "not_informed", opportunityStatus: status, reviewStatus: "needs_information",
    requirementsText: requirements, amountText: `${admission} ${call.conditions}`, extractionMethod: "html",
    evidenceJson: { opportunity_status: proof, registration_availability: proof, event_start: proof, requirements: proof, conditions: proof },
    discovery: { primaryType: call.competition ? "competicoes" : "eventos", ...(call.competition ? { subtype: "hackathon" } : {}), areas: ["tecnologia"],
      editions: [{ id: source.id, name: call.title, stages: stages(call.url, now, start, end) }] },
    // Attendance, avatars, organizer profiles and hidden addresses never enter the candidate/hash.
    contentHash: hash({ version: 1, title: call.title, start, end, status, requirements, admission, conditions: call.conditions }),
  };
}
