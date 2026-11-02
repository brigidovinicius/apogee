import crypto from "node:crypto";
import { asObject, publicText, structuredEvents } from "@/lib/ingestion/structured-events";
import * as cheerio from "cheerio";
import { loadActiveOfficialSources } from "@/lib/ingestion/official-source-registry";
import { fetchOfficialResource } from "@/lib/ingestion/fetch-source";
import { isOfficialSourceUrl } from "@/lib/ingestion/validate-url";
import type { OfficialSource } from "@/lib/ingestion/types";
import { claimDueDiscoveryTargets, completeDiscoveryTarget, saveDiscoveryLeads, recordDiscoveryObservation, recordDiscoveryObservationChanged, knownOpportunityUrls, type DiscoveryTarget } from "./watchlist";
import { candidateUrl, discoveryDocument } from "./documents";
import { crawlDiscovery, type CrawlState } from "./crawl";
export { candidateUrl } from "./documents";

export function discoveryLinks(html: string, target: DiscoveryTarget, mappedSources: OfficialSource[], now = new Date(), knownUrls: ReadonlySet<string> = new Set()) {
  // A known source can expose a new call; persistence, rather than source scope,
  // decides whether an opportunity already exists.
  void mappedSources;
  return discoveryDocument({ body: Buffer.from(html), contentType: "text/html" }, target.official_url, target.official_url, now)
    .links.filter(link => !knownUrls.has(link.url)).slice(0, 30);
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
  $("nav,header,footer,aside,form").remove();
  const urls = $("a[href],link[href]").toArray().flatMap(node => {
    try { const url = candidateUrl(new URL($(node).attr("href")!, target.official_url).href); return url ? [url] : []; }
    catch { return []; }
  });
  const content = luma
    ? JSON.stringify(events.map(event => ({ url: event.url, name: event.name, startDate: event.startDate, endDate: event.endDate,
      eventStatus: event.eventStatus, offers: (Array.isArray(event.offers) ? event.offers : [event.offers]).flatMap(raw => {
        const offer = asObject(raw);
        return offer ? [{ price: offer.price, priceCurrency: offer.priceCurrency, availability: offer.availability }] : [];
      }) })).sort((a,b) => String(a.url).localeCompare(String(b.url))))
    : `${publicText($.html())}\n${JSON.stringify(urls)}`;
  return { hash: crypto.createHash("sha256").update(content).digest("hex"), excerpt: content.slice(0, 500) };
}

export async function runScheduledDiscovery() {
  const targets = await claimDueDiscoveryTargets(2);
  const mappedSources = await loadActiveOfficialSources();
  const knownUrls = targets.length ? await knownOpportunityUrls() : new Set<string>();
  const results: { targetId: string; status: DiscoveryTarget["last_status"]; links: number; newLeads: number; pagesChecked: number; pageFailures: number; continued: boolean }[] = [];
  for (const target of targets) {
    let status: DiscoveryTarget["last_status"] = "failed";
    let links = 0;
    let newLeads = 0;
    let pagesChecked = 0, pageFailures = 0;
    let checkpoint: CrawlState | undefined;
    try {
      const source = asCrawlSource(target);
      const resource = await fetchOfficialResource(target.official_url, source, 2 * 1024 * 1024);
      const root = discoveryDocument(resource, target.official_url, target.official_url);
      {
        const html = resource.body.toString("utf8");
        const observation = /text\/html|application\/xhtml/i.test(resource.contentType) ? discoveryObservation(html, target)
          : { hash: crypto.createHash("sha256").update(JSON.stringify(root)).digest("hex"), excerpt: "Documento de descoberta oficial RSS/Atom/sitemap." };
        const changed = await recordDiscoveryObservation(target.id, observation);
        const crawlHash = crypto.createHash("sha256").update(JSON.stringify(root)).digest("hex");
        const crawled = await crawlDiscovery(target, source, resource, crawlHash, knownUrls,
          target.id.startsWith("exp-") && !isOfficialSourceUrl(target.official_url, mappedSources));
        const leads = crawled.leads;
        pagesChecked = crawled.pagesChecked;
        pageFailures = crawled.failures;
        if (crawled.state.queue.length || asObject(target.discovery_crawl)?.queue) checkpoint = crawled.state;
        if (changed) await recordDiscoveryObservationChanged(target.id);
        links = leads.length;
        newLeads = await saveDiscoveryLeads(target.id, leads);
        status = "checked";
      }
    } catch {
      // Robots, network limits and unavailable pages all fail closed. No lead is published.
      status = "blocked";
      pageFailures++;
    } finally {
      if (checkpoint) await completeDiscoveryTarget(target.id, status, checkpoint);
      else await completeDiscoveryTarget(target.id, status);
    }
    results.push({ targetId: target.id, status, links, newLeads, pagesChecked, pageFailures, continued: Boolean(checkpoint?.queue.length) });
  }
  return { targetsChecked: results.length, newLeads: results.reduce((sum, item) => sum + item.newLeads, 0),
    pagesChecked: results.reduce((sum, item) => sum + item.pagesChecked, 0),
    pageFailures: results.reduce((sum, item) => sum + item.pageFailures, 0), targets: results };
}
