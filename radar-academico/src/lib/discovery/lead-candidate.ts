import * as cheerio from "cheerio";
import { sinterLeadAliases } from "@/lib/ingestion/normalize-sinter-discovery-20261030";
import { fetchOfficialResource } from "@/lib/ingestion/fetch-source";
import { normalizeOpportunity } from "@/lib/ingestion/normalize-opportunity";
import { normalizeProgrammeCatalogue, programmeCataloguePageCount, programmeSupplementUrl } from "@/lib/ingestion/programme-catalogue";
import { isOfficialSourceUrl } from "@/lib/ingestion/validate-url";
import { publicationIssue } from "@/lib/ingestion/publication";
import { eventHasNotStarted } from "@/lib/ingestion/event-start";
import { parsePdf } from "@/lib/ingestion/parse-pdf";
import type { OfficialSource, OpportunityCandidate } from "@/lib/ingestion/types";
import { isDiscoveredPageSource, normalizeDiscoveredPage } from "@/lib/ingestion/discovered-page";

type Lead = { id: string; target_id: string; url: string; title: string; excerpt?: string };
type Prepared = { source: OfficialSource; candidate: OpportunityCandidate } | { reason: string; retry?: boolean };
const clean = (text: string) => text.replace(/\s+/gu, " ").trim();

function scopeScore(url: string, source: OfficialSource) {
  const path = new URL(url).pathname;
  return (source.baseUrl === url ? 100_000 : 0) +
    Math.max(...source.allowedPathPrefixes.filter(prefix => path.startsWith(prefix)).map(prefix => prefix.length));
}

export async function prepareLeadCandidate(lead: Lead, sources: OfficialSource[]): Promise<Prepared> {
  const matches = sources.filter(source => isOfficialSourceUrl(lead.url, [source]))
    .sort((a, b) => scopeScore(lead.url, b) - scopeScore(lead.url, a));
  if (!matches.length) return { reason: "scope_unverified" };
  if (matches.length > 1 && scopeScore(lead.url, matches[0]) === scopeScore(lead.url, matches[1])) {
    return { reason: "listing_or_ambiguous" };
  }
  const source = matches[0];
  if (!["html", "rss"].includes(source.extractionMode)) return { reason: "unsupported_source" };
  const pages = programmeCataloguePageCount(source.id);
  let candidate: OpportunityCandidate | null = null;
  if (isDiscoveredPageSource(source)) {
    const page = await fetchOfficialResource(lead.url, source, 2 * 1024 * 1024);
    if (!/text\/html|application\/xhtml/i.test(page.contentType)) return { reason: "unsupported_content" };
    candidate = normalizeDiscoveredPage(page.body.toString("utf8"), source);
  } else if (pages) {
    const supplementUrl = pages === 2 ? programmeSupplementUrl(source.id) : null;
    if (source.listingUrls.length !== 1 ||
      ![source.baseUrl, source.listingUrls[0], supplementUrl, ...sinterLeadAliases(source.id)].includes(lead.url)) {
      return { reason: "listing_or_ambiguous" };
    }
    const primary = await fetchOfficialResource(source.listingUrls[0], source, 2 * 1024 * 1024);
    if (!/text\/html|application\/xhtml/i.test(primary.contentType)) return { reason: "unsupported_content" };
    let supplement = "";
    if (supplementUrl) {
      const response = await fetchOfficialResource(supplementUrl, source);
      if (/application\/pdf/i.test(response.contentType)) {
        const doc = await parsePdf(new Uint8Array(response.body), 10);
        if (doc.requiresManualReview) return { reason: "candidate_unconfirmed" };
        supplement = doc.fullText.slice(0, 30_000);
      } else if (/text\/html|application\/xhtml/i.test(response.contentType)) supplement = response.body.toString("utf8");
      else return { reason: "unsupported_content" };
    }
    const candidates = normalizeProgrammeCatalogue(primary.body.toString("utf8"), supplement, source);
    if (candidates.length !== 1) return { reason: "listing_or_ambiguous" };
    candidate = candidates[0];
  } else {
    // These adapters require policy/catalogue context that cannot be replaced
    // with one arbitrary detail page. Their normal ingestion remains in charge.
    if (["evg-enap-open-courses", "acate-audited-events", "fulbright-ruth-cardoso-selection-2026",
      "braskem-internship-programme", "sed-novos-valores-2026"].includes(source.id)) return { reason: "unsupported_source" };
    if (source.listingUrls.includes(lead.url) || new URL(lead.url).pathname === "/") return { reason: "listing_or_ambiguous" };
    const resource = await fetchOfficialResource(lead.url, source, 2 * 1024 * 1024);
    if (!/text\/html|application\/xhtml/i.test(resource.contentType)) return { reason: "unsupported_content" };
    const $ = cheerio.load(resource.body.toString("utf8"));
    $("script,style,noscript,nav,header,footer,aside,.entry-meta,.postmetadata").remove();
    const article = $("article");
    if (article.length !== 1 || article.find("h1").length !== 1) return { reason: "listing_or_ambiguous" };
    const title = clean(article.find("h1").first().text());
    article.find("p,div,h1,h2,h3,li,a").append(" ");
    const text = clean(article.text()).slice(0, 30_000);
    if (!title || !text) return { reason: "candidate_unconfirmed" };
    candidate = normalizeOpportunity({ title, text, url: lead.url, source });
  }
  if (!candidate || candidate.requiresManualReview) return { reason: "candidate_unconfirmed" };
  if (candidate.categories?.includes("eventos") && candidate.eventStartsAt && !eventHasNotStarted(candidate.eventStartsAt)) {
    return { reason: "event_started" };
  }
  const issue = publicationIssue(candidate, source);
  return issue ? { reason: issue } : { source, candidate };
}
