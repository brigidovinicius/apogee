import { withAdminTransaction } from "@/lib/db/client";
import type { IngestionResult, OfficialSource, OpportunityCandidate } from "./types";
import { persistCandidate, lockSource } from "./persist-candidate";
import { deadlineIsCurrent } from "./publication";
import { normalizeBrazilianLocation } from "@/lib/location";

export async function syncOfficialSource(source: OfficialSource) {
  if (!process.env.DATABASE_EDITOR_URL) return;
  const normalizedLocation = normalizeBrazilianLocation(source.location ?? {});
  if (normalizedLocation.status === "invalid") throw new Error(`Fonte ${source.id} com localização inválida`);
  await withAdminTransaction(async (client) => {
    await client.query(
      `insert into official_sources
       (id,name,institution_name,institution_acronym,source_type,base_url,allowed_domains,allowed_path_prefixes,listing_urls,extraction_mode,audience_scope,geographic_scope,state_code,city_name,categories,priority,active,verification_status,notes)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,false,'pending',$17)
       on conflict (id) do update set
       name=excluded.name, allowed_domains=excluded.allowed_domains,
       allowed_path_prefixes=excluded.allowed_path_prefixes, listing_urls=excluded.listing_urls,
       extraction_mode=excluded.extraction_mode, geographic_scope=excluded.geographic_scope,
       state_code=excluded.state_code, city_name=excluded.city_name, updated_at=now()`,
      [source.id, source.name, source.institutionName, source.institutionAcronym, source.sourceType,
       source.baseUrl, source.allowedDomains, source.allowedPathPrefixes, source.listingUrls,
       source.extractionMode, source.audienceScope, source.geographicScope,
       normalizedLocation.location.stateCode, normalizedLocation.location.cityName, source.categories,
       source.priority, source.notes ?? null],
    );
  });
}

export async function saveReviewItems(source: OfficialSource, result: IngestionResult) {
  if (!process.env.DATABASE_EDITOR_URL) return { saved: 0, published: 0, blocked: 0, created: 0, updated: 0, persistence: "skipped_no_database" };
  let saved = 0, published = 0, blocked = 0, created = 0, updated = 0;
  await withAdminTransaction(async (client) => {
    await lockSource(client, source);
    for (const candidate of result.discovered) {
      const outcome = await persistCandidate(client, source, candidate, { mode: "automatic" });
      saved += outcome.saved; published += outcome.published; blocked += outcome.blocked; created += outcome.created; updated += outcome.updated;
    }
    await client.query(`insert into ingestion_runs
      (official_source_id,started_at,finished_at,status,pages_checked,items_discovered,items_created,items_updated,items_ignored,items_failed,error_summary,execution_metadata)
      values ($1,now(),now(),$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [source.id, result.failed ? "completed_with_warnings" : "completed", result.pagesChecked, result.discovered.length,
       created, updated, result.ignored, result.failed, result.warnings.join("\n") || null,
       { automatic_publish: true, published, blocked, location: { rejected: result.locationRejected } }]);
    if (result.nextListingIndex !== undefined && result.nextLinkOffset !== undefined) {
      await client.query("update official_sources set crawl_listing_index=$2,crawl_link_offset=$3 where id=$1", [source.id, result.nextListingIndex, result.nextLinkOffset]);
    }
  });
  return { saved, published, blocked, created, updated, persistence: "postgres" };
}

export function isPublishable(candidate: OpportunityCandidate) {
  return candidate.reviewStatus === "approved" && Boolean(candidate.officialSourceId) &&
    !candidate.sourceConflict && ["open", "upcoming"].includes(candidate.opportunityStatus) && deadlineIsCurrent(candidate);
}
export function isVisiblePublicOpportunity(candidate: OpportunityCandidate, now = new Date()) {
  return candidate.reviewStatus === "approved" && Boolean(candidate.officialSourceId) &&
    !candidate.sourceConflict && ["open", "upcoming"].includes(candidate.opportunityStatus) && deadlineIsCurrent(candidate, now);
}
