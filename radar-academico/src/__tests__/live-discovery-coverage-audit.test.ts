import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { fetchOfficialResource } from "@/lib/ingestion/fetch-source";
import { discoveryDocument } from "@/lib/discovery/documents";
import { crawlDiscovery } from "@/lib/discovery/crawl";
import { ingestionFailureReason } from "@/lib/ingestion/failure-reason";
import type { DiscoveryTarget } from "@/lib/discovery/watchlist";
import type { OfficialSource } from "@/lib/ingestion/types";

// Explicit bounded operator audit: public GETs only. No DB functions, cron, registration or email.
it.skipIf(!process.env.RADAR_DISCOVERY_AUDIT_SAMPLE)("audits two bounded discovery passes per real verified target without database writes", async () => {
  const targets = JSON.parse(await readFile(process.env.RADAR_DISCOVERY_AUDIT_SAMPLE!, "utf8")) as DiscoveryTarget[];
  expect(targets.length).toBeGreaterThan(0);
  expect(targets.length).toBeLessThanOrEqual(4);
  const results: Record<string, unknown>[] = [];
  for (const target of targets) {
    expect(target.enabled && Boolean(target.official_verified_at) && target.official_verified_url === target.official_url).toBe(true);
    const row: Record<string, unknown> = { target: target.id, url: target.official_url };
    try {
      const source: OfficialSource = { id: target.id, name: target.name, institutionName: target.organizer, institutionAcronym: "",
        sourceType: "official_reference", baseUrl: target.official_url, allowedDomains: [new URL(target.official_url).hostname],
        allowedPathPrefixes: ["/"], listingUrls: [target.official_url], extractionMode: "reference_only", audienceScope: [],
        geographicScope: [], categories: target.topics, priority: target.priority, active: true };
      const resource = await fetchOfficialResource(target.official_url, source, 2 * 1024 * 1024);
      const root = discoveryDocument(resource, target.official_url, target.official_url);
      const hash = createHash("sha256").update(JSON.stringify(root)).digest("hex");
      const first = await crawlDiscovery({ ...target, discovery_crawl: {} }, source, resource, hash, new Set(), false);
      const second = first.state.queue.length ? await crawlDiscovery({ ...target, discovery_crawl: first.state }, source, resource, hash, new Set(), false) : null;
      row.outcome = "checked";
      row.rootCandidates = root.links.length;
      row.linkedDocuments = root.pages.length;
      row.pagesChecked = first.pagesChecked + (second?.pagesChecked ?? 0);
      row.pageFailures = first.failures + (second?.failures ?? 0);
      row.remainingDocuments = (second?.state ?? first.state).queue.length;
      row.sampleLinks = [...first.leads, ...(second?.leads ?? [])].slice(0, 8).map(lead => ({ url: lead.url, title: lead.title, discoveryPath: lead.discoveryPath }));
    } catch (error) { row.outcome = "blocked"; row.reason = ingestionFailureReason(error); }
    results.push(row);
  }
  const report = { checkedAt: new Date().toISOString(), readOnly: true, results };
  if (process.env.RADAR_DISCOVERY_AUDIT_REPORT) await writeFile(process.env.RADAR_DISCOVERY_AUDIT_REPORT, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
}, 240_000);
