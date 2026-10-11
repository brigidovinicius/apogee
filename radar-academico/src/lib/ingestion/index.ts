import { loadOfficialSource } from "./official-source-registry";
import { deduplicateCandidates } from "./detect-duplicates";
import { fetchOfficialResource, boundedInteger } from "./fetch-source";
import { normalizeOpportunity } from "./normalize-opportunity";
import { parseHtml } from "./parse-html";
import { parseRss } from "./parse-rss";
import { saveReviewItems } from "./save-review-item";
import type { IngestionResult, OfficialSource } from "./types";
import { isOfficialSourceUrl } from "./validate-url";
import { normalizeBrazilianLocation } from "@/lib/location";

async function ingestSource(
  source: OfficialSource,
  budget: { remaining: number },
  maxCandidates?: number,
): Promise<IngestionResult> {
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
    } catch {
      result.failed += 1;
      result.warnings.push("Falha ao consultar fonte oficial; revisar configuração e disponibilidade.");
    }
  }
  const deduplicated = deduplicateCandidates(result.discovered);
  if (maxCandidates !== undefined && deduplicated.length > maxCandidates) {
    result.ignored += deduplicated.length - maxCandidates;
    result.discovered = deduplicated.slice(0, maxCandidates);
  } else {
    result.discovered = deduplicated;
  }
  return result;
}

export type OfficialSourceIngestionOptions = {
  sourceId?: string;
  maxPages?: number;
  maxCandidates?: number;
};

async function runIngestion(options: OfficialSourceIngestionOptions = {}) {
  if (!options.sourceId) throw new Error("Selecione uma fonte oficial para a coleta controlada");
  const requestedMaxPages = options.maxPages === undefined ? undefined : String(options.maxPages);
  const requestedMaxCandidates = options.maxCandidates === undefined ? undefined : String(options.maxCandidates);
  const budget = {
    remaining: requestedMaxPages === undefined
      ? boundedInteger(process.env.INGESTION_MAX_PAGES_PER_RUN, 20, 1, 100)
      : boundedInteger(requestedMaxPages, 1, 1, 10),
  };
  const report = [];
  const maxCandidates = requestedMaxCandidates === undefined
    ? undefined
    : boundedInteger(requestedMaxCandidates, 10, 1, 10);
  let activeSources: OfficialSource[];
  const source = await loadOfficialSource(options.sourceId);
  if (!source) throw new Error("Fonte oficial inválida, não verificada ou inativa");
  activeSources = [source];
  for (const source of activeSources.sort((a, b) => b.priority - a.priority)) {
    const result = await ingestSource(source, budget, maxCandidates);
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

let running = false;
export async function runOfficialSourceIngestion(options?: OfficialSourceIngestionOptions) {
  if (running) throw new Error("Ingestão já em andamento");
  running = true;
  try { return await runIngestion(options); }
  finally { running = false; }
}
