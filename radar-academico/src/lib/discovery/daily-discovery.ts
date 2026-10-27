import { isIP } from "node:net";
import * as cheerio from "cheerio";
import { loadActiveOfficialSources } from "@/lib/ingestion/official-source-registry";
import { fetchOfficialResource } from "@/lib/ingestion/fetch-source";
import { parseHtml } from "@/lib/ingestion/parse-html";
import { isAllowedHostname, isOfficialSourceUrl } from "@/lib/ingestion/validate-url";
import type { OfficialSource } from "@/lib/ingestion/types";
import { claimDueDiscoveryTargets, completeDiscoveryTarget, saveDiscoveryLeads, type DiscoveryTarget } from "./watchlist";

const relevant = /bolsa|auxílio|monitoria|estágio|mobilidade|intercâmbio|oportunidade|curso|oficina|formação|prêmio|premiaç|competição|hackathon|desafio|edital|seleção|inscriç|chamada|programa|evento|workshop|conferência|congresso|seminário|encontro|feira|palestra|webinar|extensão|empreendedorismo|incuba|acelera/i;
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

export function discoveryLinks(html: string, target: DiscoveryTarget, mappedSources: OfficialSource[]) {
  const seen = new Set<string>();
  const $ = cheerio.load(html);
  $("header,aside").remove();
  return parseHtml($.html(), target.official_url).flatMap((item) => {
    const url = candidateUrl(item.url);
    if (!url || url === target.official_url || seen.has(url) || navigationLabel.test(item.title)) return [];
    const path = new URL(url).pathname;
    if (path.includes("@@search") || isOfficialSourceUrl(url, mappedSources) ||
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

export async function runScheduledDiscovery() {
  const targets = await claimDueDiscoveryTargets(2);
  const mappedSources = await loadActiveOfficialSources();
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
        const leads = discoveryLinks(resource.body.toString("utf8"), target, mappedSources);
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
