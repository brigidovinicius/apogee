import { recheckKnownOpportunities } from "./recheck";
import { claimDueOfficialSources, completeScheduledSource, loadOfficialSource } from "./official-source-registry";
import { deduplicateCandidates } from "./detect-duplicates";
import { fetchOfficialResource, boundedInteger } from "./fetch-source";
import { normalizeOpportunity } from "./normalize-opportunity";
import { parseHtml } from "./parse-html";
import { parseRss } from "./parse-rss";
import { parsePdf } from "./parse-pdf";
import { saveReviewItems } from "./save-review-item";
import type { IngestionResult, OfficialSource } from "./types";
import { isOfficialSourceUrl } from "./validate-url";
import { normalizeBrazilianLocation } from "@/lib/location";
import * as cheerio from "cheerio";
import { IFC_APPLICATION_URL } from "./normalize-ifc-integrated";
import { normalizeProgrammeCatalogue, programmeCataloguePageCount } from "./programme-catalogue";

const promisingLink = /bolsa|auxílio|monitoria|estágio|mobilidade|intercâmbio|iniciação|oportunidade|curso|qualificaç|capacitaç|oficina|formação|premiaç|prêmio|concurso cultural|desafio|hackathon|edital|seleção|inscriç/i;

async function detailText(body: Buffer, contentType: string) {
  if (/application\/pdf/i.test(contentType)) {
    const document = await parsePdf(new Uint8Array(body), 10);
    return document.requiresManualReview ? "" : document.fullText.slice(0, 30_000);
  }
  if (!/text\/html|application\/xhtml/i.test(contentType)) return "";
  const $ = cheerio.load(body.toString("utf8"));
  $("script,style,noscript,nav,footer,header").remove();
  const article = $("article").first().text();
  const main = $("main").first().text();
  // Some official sites put a short accessibility/modal <main> before the actual page.
  return (article || (main.replace(/\s+/g, " ").trim().length >= 500 ? main : $("body").text()))
    .replace(/\s+/g, " ").trim().slice(0, 30_000);
}

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
  if (source.extractionMode !== "rss" && source.extractionMode !== "html") {
    result.warnings.push("Modo de extração sem adaptador automático; revisar fonte.");
    return result;
  }

  if (!source.listingUrls.length) {
    result.warnings.push("Fonte sem URL de listagem.");
    return result;
  }
  const cataloguePages = programmeCataloguePageCount(source.id);
  if (budget.remaining < (cataloguePages ?? 1)) {
    result.failed = 1;
    result.warnings.push("Orçamento de páginas insuficiente para confirmar a fonte.");
    return result;
  }
  const listingIndex = (source.crawlListingIndex ?? 0) % source.listingUrls.length;
  const listingUrl = source.listingUrls[listingIndex];
  budget.remaining -= 1;
  try {
    const resource = await fetchOfficialResource(listingUrl, source);
    result.pagesChecked += 1;
    if (cataloguePages) {
      let applicationHtml = "";
      if (cataloguePages === 2) {
        budget.remaining -= 1;
        const application = await fetchOfficialResource(IFC_APPLICATION_URL, source);
        result.pagesChecked += 1;
        applicationHtml = application.body.toString("utf8");
      }
      const candidates = normalizeProgrammeCatalogue(resource.body.toString("utf8"), applicationHtml, source);
      if (!candidates.length) throw new Error("Oferta ou inscrição não confirmada");
      const start = source.crawlLinkOffset ?? 0;
      const selected = candidates.slice(start, start + (maxCandidates ?? 10));
      result.discovered = selected;
      result.nextListingIndex = 0;
      result.nextLinkOffset = start + selected.length >= candidates.length ? 0 : start + selected.length;
      return result;
    }
    // An organizer's edition-specific announcement is itself the evidence page.
    if (source.id === "braskem-internship-programme" || source.id === "sed-novos-valores-2026") {
      const text = await detailText(resource.body, resource.contentType);
      const candidate = text ? normalizeOpportunity({ title: source.name, text, url: listingUrl, source }) : null;
      if (candidate) result.discovered.push(candidate);
      else result.ignored += 1;
      result.nextListingIndex = 0;
      result.nextLinkOffset = 0;
      return result;
    }
    const body = resource.body.toString("utf8");
    const items = /rss|xml/.test(resource.contentType)
      ? await parseRss(body)
      : parseHtml(body, listingUrl);
    const visited = new Set<string>();
    const eligibleItems = items.filter((item) => {
      if (!isOfficialSourceUrl(item.url, [source]) || item.url === listingUrl || visited.has(item.url)) {
        result.ignored += 1;
        return false;
      }
      visited.add(item.url);
      if (source.id === "fapesp-open-fellowships" && !/^https:\/\/(?:www\.)?fapesp\.br\/oportunidades\/[^/]+\/\d+\/$/.test(item.url)) {
        result.ignored += 1;
        return false;
      }
      return promisingLink.test(`${item.title} ${item.excerpt}`) ||
        source.id === "cnpq-chamadas-abertas-2026" && /chamada/i.test(item.title);
    });
    const start = source.crawlLinkOffset ?? 0;
    let processed = 0;
    for (const item of eligibleItems.slice(start)) {
      if (budget.remaining <= 0 || maxCandidates !== undefined && result.discovered.length >= maxCandidates) break;
      budget.remaining -= 1;
      processed += 1;
      try {
        const detail = await fetchOfficialResource(item.url, source);
        result.pagesChecked += 1;
        const text = await detailText(detail.body, detail.contentType);
        if (!text) {
          result.ignored += 1;
          continue;
        }
        const candidate = normalizeOpportunity({ title: item.title, text, url: item.url, source });
        if (candidate) result.discovered.push(candidate);
        else result.ignored += 1;
      } catch {
        result.failed += 1;
        result.warnings.push("Falha ao consultar página de oportunidade oficial.");
      }
    }
    const nextOffset = start + processed;
    if (nextOffset >= eligibleItems.length) {
      result.nextListingIndex = (listingIndex + 1) % source.listingUrls.length;
      result.nextLinkOffset = 0;
    } else {
      result.nextListingIndex = listingIndex;
      result.nextLinkOffset = nextOffset;
    }
  } catch {
    result.failed += 1;
    result.warnings.push("Falha ao consultar fonte oficial; revisar configuração e disponibilidade.");
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
  if (!process.env.DATABASE_URL) throw new Error("Banco do Radar não configurado");
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
  const source = await loadOfficialSource(options.sourceId);
  if (!source) throw new Error("Fonte oficial inválida, não verificada ou inativa");
  const activeSources: OfficialSource[] = [source];
  for (const source of activeSources.sort((a, b) => b.priority - a.priority)) {
    const cataloguePages = programmeCataloguePageCount(source.id);
    // Catalogue records share evidence pages. Recheck the complete edition using
    // one page budget, rather than repeating its URLs for a few records per cycle.
    const recheckLimit = cataloguePages
      ? budget.remaining >= cataloguePages * 2 ? 200 : 0
      : Math.min(2, Math.max(0, budget.remaining - 2));
    const rechecked = await recheckKnownOpportunities(source, recheckLimit, detailText);
    budget.remaining -= rechecked.pagesChecked + rechecked.failed;
    const result = await ingestSource(source, budget, maxCandidates);
    result.pagesChecked += rechecked.pagesChecked;
    result.failed += rechecked.failed;
    if (rechecked.failed) result.warnings.push("Falha ao reconsultar ficha existente; verificação anterior preservada.");
    const persistence = await saveReviewItems(source, result);
    report.push({ ...result, ...persistence, published: persistence.published + rechecked.published });
    if (budget.remaining <= 0) break;
  }
  return {
    startedAt: new Date().toISOString(),
    automaticPublish: true,
    pagesChecked: report.reduce((sum, item) => sum + item.pagesChecked, 0),
    discovered: report.reduce((sum, item) => sum + item.discovered.length, 0),
    sentToReview: 0,
    published: report.reduce((sum, item) => sum + item.published, 0),
    blocked: report.reduce((sum, item) => sum + item.blocked, 0),
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

export async function runScheduledOfficialSourceIngestion() {
  const sources = await claimDueOfficialSources(3);
  const reports: Array<{ sourceId: string; pagesChecked: number; discovered: number; sentToReview: number; published: number; failed: number }> = [];
  for (const source of sources) {
    let failed = true;
    try {
      const report = await runOfficialSourceIngestion({ sourceId: source.id, maxPages: 5, maxCandidates: 10 });
      const sourceReport = report.sources[0];
      failed = sourceReport.failed > 0;
      reports.push({ sourceId: source.id, pagesChecked: report.pagesChecked,
        discovered: report.discovered, sentToReview: 0, published: report.published, failed: sourceReport.failed });
    } catch {
      reports.push({ sourceId: source.id, pagesChecked: 0, discovered: 0, sentToReview: 0, published: 0, failed: 1 });
    } finally {
      await completeScheduledSource(source.id, failed);
    }
  }
  return {
    automaticPublish: true, sourcesChecked: reports.length,
    pagesChecked: reports.reduce((sum, item) => sum + item.pagesChecked, 0),
    discovered: reports.reduce((sum, item) => sum + item.discovered, 0),
    sentToReview: reports.reduce((sum, item) => sum + item.sentToReview, 0),
    failed: reports.reduce((sum, item) => sum + item.failed, 0),
    published: reports.reduce((sum, item) => sum + item.published, 0), sources: reports,
  };
}
