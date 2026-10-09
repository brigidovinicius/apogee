import { loadActiveOfficialSources, officialSourceRegistry } from "./official-source-registry";
import { deduplicateCandidates } from "./detect-duplicates";
import { fetchOfficialResource } from "./fetch-source";
import { normalizeOpportunity } from "./normalize-opportunity";
import { parseHtml } from "./parse-html";
import { parseRss } from "./parse-rss";
import { saveReviewItems } from "./save-review-item";
import type { IngestionResult, OfficialSource } from "./types";
import { isOfficialSourceUrl } from "./validate-url";
import { normalizeBrazilianLocation } from "@/lib/location";

async function ingestSource(source: OfficialSource, budget: { remaining: number }): Promise<IngestionResult> {
  const result: IngestionResult = { sourceId: source.id, pagesChecked: 0, discovered: [], ignored: 0, failed: 0, locationRejected: 0, warnings: [] };
  if (normalizeBrazilianLocation(source.location ?? {}).status === "invalid") {
    result.failed = 1;
    result.locationRejected = 1;
    result.warnings.push(`Fonte ${source.id}: localização estruturada inválida; execução interrompida.`);
    return result;
  }
  if (source.extractionMode === "reference_only" || source.extractionMode === "disabled") return result;
  if (source.extractionMode === "manual_assisted") {
    result.warnings.push("Fonte configurada para importação manual assistida.");
    return result;
  }

  for (const listingUrl of source.listingUrls) {
    if (budget.remaining <= 0) break;
    budget.remaining -= 1;
    try {
      const resource = await fetchOfficialResource(listingUrl, source);
      result.pagesChecked += 1;
      const body = resource.body.toString("utf8");
      const items = /rss|xml/.test(resource.contentType)
        ? await parseRss(body)
        : parseHtml(body, listingUrl);
      for (const item of items) {
        if (!isOfficialSourceUrl(item.url, [source])) {
          result.ignored += 1;
          continue;
        }
        const candidate = normalizeOpportunity({ title: item.title, text: item.excerpt, url: item.url, source });
        if (candidate) result.discovered.push(candidate);
        else result.ignored += 1;
      }
    } catch (error) {
      result.failed += 1;
      result.warnings.push(`${listingUrl}: ${error instanceof Error ? error.message : "erro desconhecido"}`);
    }
  }
  result.discovered = deduplicateCandidates(result.discovered);
  return result;
}

export async function runOfficialSourceIngestion() {
  const budget = { remaining: Number(process.env.INGESTION_MAX_PAGES_PER_RUN ?? 20) };
  const report = [];
  if (process.env.DATABASE_URL) {
    const { syncOfficialSource } = await import("./save-review-item");
    for (const source of officialSourceRegistry) await syncOfficialSource(source);
  }
  const activeSources = await loadActiveOfficialSources();
  for (const source of activeSources.sort((a, b) => b.priority - a.priority)) {
    const result = await ingestSource(source, budget);
    const persistence = await saveReviewItems(source, result);
    report.push({ ...result, ...persistence });
    if (budget.remaining <= 0) break;
  }
  return {
    startedAt: new Date().toISOString(),
    automaticPublish: false,
    pagesChecked: report.reduce((sum, item) => sum + item.pagesChecked, 0),
    discovered: report.reduce((sum, item) => sum + item.discovered.length, 0),
    sentToReview: report.reduce((sum, item) => sum + item.saved, 0),
    published: 0,
    sources: report,
  };
}
