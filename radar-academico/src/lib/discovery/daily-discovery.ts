import crypto from "node:crypto";
import { asObject, publicText, structuredEvents } from "@/lib/ingestion/structured-events";
import { eventHasNotStarted } from "@/lib/ingestion/event-start";
import { isIP } from "node:net";
import * as cheerio from "cheerio";
import { loadActiveOfficialSources } from "@/lib/ingestion/official-source-registry";
import { fetchOfficialResource } from "@/lib/ingestion/fetch-source";
import { parseHtml } from "@/lib/ingestion/parse-html";
import { isAllowedHostname, isOfficialSourceUrl } from "@/lib/ingestion/validate-url";
import type { OfficialSource } from "@/lib/ingestion/types";
import { claimDueDiscoveryTargets, completeDiscoveryTarget, saveDiscoveryLeads, recordDiscoveryObservation, recordDiscoveryObservationChanged, knownOpportunityUrls, type DiscoveryTarget } from "./watchlist";

const relevant = /olimp[ií]ada|torneio|maratona|pitch|build(?:ers)? day|platform|\bia\b|bolsa|auxílio|monitoria|estágio|mobilidade|intercâmbio|oportunidade|curso|oficina|formação|prêmio|premiaç|competição|hackathon|desafio|edital|seleção|inscriç|chamada|programa|evento|workshop|conferência|congresso|seminário|encontro|feira|palestra|webinar|extensão|empreendedorismo|incuba|acelera/i;
const tracking = /^(utm_.+|fbclid|gclid)$/i;
const navigationLabel = /^(?:[«»\s]*(?:anterior|próximo)[«»\s]*|cursos|eventos e cursos|calendário de inscrições|inscrições e acompanhamento|chamadas (?:abertas|andamento)|ver todos os palestrantes|programação|destaques|a feira|acesso à informação)$/i;

export function candidateUrl(input: string): string | null {
  try {
    const url = new URL(input);
    if (url.protocol !== "https:" || url.port && url.port !== "443" || url.username || url.password ||
      isIP(url.hostname) !== 0 || !isAllowedHostname(url.hostname) || input.length > 2048) return null;
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) if (tracking.test(key)) url.searchParams.delete(key);
    return url.toString();
  } catch { return null; }
}

export function discoveryLinks(html: string, target: DiscoveryTarget, mappedSources: OfficialSource[], now = new Date(), knownUrls: ReadonlySet<string> = new Set()) {
  // A known source can expose a new call; persistence, rather than source scope,
  // decides whether an opportunity already exists.
  void mappedSources;
  const seen = new Set<string>();
  const $ = cheerio.load(html);
  $("header,aside").remove();
  const structured = structuredEvents(html);
  const unavailable = new Set(structured.filter(event => typeof event.startDate === "string" && (!eventHasNotStarted(event.startDate, now) || event.eventStatus === "https://schema.org/EventCancelled")).map(event => event.url));
  const metadata = structured.flatMap(event => {
    if (typeof event.url !== "string" || typeof event.name !== "string" || typeof event.startDate !== "string" ||
      !eventHasNotStarted(event.startDate, now) || event.eventStatus === "https://schema.org/EventCancelled") return [];
    return [{ url: event.url, title: event.name, excerpt: `${event.name}; ${event.startDate}` }];
  });
  return [...metadata, ...parseHtml($.html(), target.official_url)].flatMap((item) => {
    const url = candidateUrl(item.url);
    if (!url || knownUrls.has(url) || unavailable.has(url) || url === target.official_url || seen.has(url) || navigationLabel.test(item.title)) return [];
    const path = new URL(url).pathname;
    if (path.includes("@@search") ||
      !relevant.test(`${item.title} ${path}`)) return [];
    seen.add(url);
    return [{ url, title: item.title.slice(0, 240), excerpt: item.excerpt.slice(0, 500) }];
  }).slice(0, 30);
}

function asCrawlSource(target: DiscoveryTarget): OfficialSource {
  const host = new URL(target.official_url).hostname;
  return {
    id: target.id, name: target.name, institutionName: target.organizer, institutionAcronym: "",
    sourceType: "official_reference", baseUrl: target.official_url, allowedDomains: [host],
    allowedPathPrefixes: ["/"], listingUrls: [target.official_url], extractionMode: "reference_only",
    audienceScope: [], geographicScope: [], categories: target.topics, priority: target.priority, active: true,
  };
}

/** Content changes are private discovery signals, never opportunity updates or user alerts. */
export function discoveryObservation(html: string, target: DiscoveryTarget) {
  const $ = cheerio.load(html);
  $("[class*=countdown],[class*=timer],svg,button").remove();
  const events = structuredEvents(html);
  const luma = new URL(target.official_url).hostname === "luma.com";
  const content = luma
    ? JSON.stringify(events.map(event => ({ url: event.url, name: event.name, startDate: event.startDate, endDate: event.endDate,
      eventStatus: event.eventStatus, offers: (Array.isArray(event.offers) ? event.offers : [event.offers]).flatMap(raw => {
        const offer = asObject(raw);
        return offer ? [{ price: offer.price, priceCurrency: offer.priceCurrency, availability: offer.availability }] : [];
      }) })).sort((a,b) => String(a.url).localeCompare(String(b.url))))
    : publicText($.html());
  return { hash: crypto.createHash("sha256").update(content).digest("hex"), excerpt: content.slice(0, 500) };
}

export async function runScheduledDiscovery() {
  const targets = await claimDueDiscoveryTargets(2);
  const mappedSources = await loadActiveOfficialSources();
  const knownUrls = targets.length ? await knownOpportunityUrls() : new Set<string>();
  const results: { targetId: string; status: DiscoveryTarget["last_status"]; links: number; newLeads: number }[] = [];
  for (const target of targets) {
    let status: DiscoveryTarget["last_status"] = "failed";
    let links = 0;
    let newLeads = 0;
    try {
      const source = asCrawlSource(target);
      const resource = await fetchOfficialResource(target.official_url, source, 2 * 1024 * 1024);
      if (!/text\/html|application\/xhtml/i.test(resource.contentType)) {
        status = "blocked";
      } else {
        const html = resource.body.toString("utf8");
        const observation = discoveryObservation(html, target);
        const changed = await recordDiscoveryObservation(target.id, observation);
        const leads = discoveryLinks(html, target, mappedSources, new Date(), knownUrls);
        if (target.id.startsWith("exp-") && !isOfficialSourceUrl(target.official_url, mappedSources)) {
          leads.unshift({ url: target.official_url, title: target.name, excerpt: observation.excerpt });
        }
        if (changed) await recordDiscoveryObservationChanged(target.id);
        links = leads.length;
        newLeads = await saveDiscoveryLeads(target.id, leads);
        status = "checked";
      }
    } catch {
      // Robots, network limits and unavailable pages all fail closed. No lead is published.
      status = "blocked";
    } finally {
      await completeDiscoveryTarget(target.id, status);
    }
    results.push({ targetId: target.id, status, links, newLeads });
  }
  return { targetsChecked: results.length, newLeads: results.reduce((sum, item) => sum + item.newLeads, 0), targets: results };
}
