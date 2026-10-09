import { withAdminTransaction } from "@/lib/db/client";
import type { IngestionResult, OfficialSource, OpportunityCandidate } from "./types";
import { canonicalOpportunityKey } from "./revision-key";
import { normalizeBrazilianLocation } from "@/lib/location";

export async function syncOfficialSource(source: OfficialSource) {
  if (!process.env.DATABASE_URL) return;
  const normalizedLocation = normalizeBrazilianLocation(source.location ?? {});
  if (normalizedLocation.status === "invalid") throw new Error(`Fonte ${source.id} com localização inválida`);
  await withAdminTransaction(async (client) => {
    await client.query(
      `insert into official_sources
       (id,name,institution_name,institution_acronym,source_type,base_url,allowed_domains,allowed_path_prefixes,listing_urls,extraction_mode,audience_scope,geographic_scope,state_code,city_name,categories,priority,active,verification_status,notes)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,'verified',$18)
       on conflict (id) do update set
       name=excluded.name, allowed_domains=excluded.allowed_domains,
       allowed_path_prefixes=excluded.allowed_path_prefixes, listing_urls=excluded.listing_urls,
       extraction_mode=excluded.extraction_mode, geographic_scope=excluded.geographic_scope,
       state_code=excluded.state_code, city_name=excluded.city_name, updated_at=now()`,
      [source.id, source.name, source.institutionName, source.institutionAcronym, source.sourceType,
       source.baseUrl, source.allowedDomains, source.allowedPathPrefixes, source.listingUrls,
       source.extractionMode, source.audienceScope, source.geographicScope,
       normalizedLocation.location.stateCode, normalizedLocation.location.cityName, source.categories,
       source.priority, source.active, source.notes ?? null],
    );
  });
}

export async function saveReviewItems(source: OfficialSource, result: IngestionResult) {
  if (!process.env.DATABASE_URL) return { saved: 0, persistence: "skipped_no_database" };
  await syncOfficialSource(source);
  let saved = 0;
  await withAdminTransaction(async (client) => {
    const run = await client.query<{ id: string }>(
      `insert into ingestion_runs
       (official_source_id,started_at,finished_at,status,pages_checked,items_discovered,items_created,items_ignored,items_failed,error_summary,execution_metadata)
       values ($1,now(),now(),$2,$3,$4,0,$5,$6,$7,$8) returning id`,
      [source.id, result.failed ? "completed_with_warnings" : "completed", result.pagesChecked,
       result.discovered.length, result.ignored, result.failed, result.warnings.join("\n") || null,
       { automatic_publish: false, location: {
         valid: result.discovered.filter((candidate) => candidate.stateCode !== null).length,
         missing: result.discovered.filter((candidate) => candidate.stateCode === null).length,
         rejected: result.locationRejected,
       } }],
    );
    for (const candidate of result.discovered) {
      const canonicalKey = canonicalOpportunityKey(candidate.officialSourceId, candidate.title);
      if (candidate.hasRetification) {
        const original = await client.query<{ id: string; data: unknown }>(
          "select id, to_jsonb(opportunities.*) as data from opportunities where official_source_id=$1 and canonical_key=$2 order by created_at desc limit 1",
          [candidate.officialSourceId, canonicalKey],
        );
        if (original.rows[0]) {
          await client.query(
            `insert into opportunity_revisions
             (opportunity_id,source_url,revision_type,previous_data,new_data,change_summary,review_status)
             values ($1,$2,'retification',$3,$4,$5,'pending_review')`,
            [original.rows[0].id, candidate.sourcePageUrl, original.rows[0].data, candidate,
             "Retificação detectada automaticamente; alterações aguardam revisão humana."],
          );
          await client.query(
            "update opportunities set has_retification=true, retification_summary=$1, review_status='pending_review', updated_at=now() where id=$2",
            ["Retificação pendente de revisão", original.rows[0].id],
          );
          continue;
        }
      }
      const inserted = await client.query<{ id: string }>(
        `insert into opportunities
         (title,institution,review_status,opportunity_status,applicant_type,application_route,
          target_academic_levels,benefit_type,deadline_at,deadline_precision,state_code,city_name,official_source_id,
          extraction_method,extracted_at,evidence_json,content_hash,canonical_key,requirements_text,amount_text)
         values ($1,$2,'pending_review',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,now(),$14,$15,$16,$17,$18)
         on conflict (official_source_id,content_hash) do nothing returning id`,
        [candidate.title, candidate.institution, candidate.opportunityStatus, candidate.applicantType,
         candidate.applicationRoute, [candidate.applicantType], candidate.benefitType,
         candidate.deadlineAt ?? null, candidate.deadlinePrecision, candidate.stateCode, candidate.cityName,
         candidate.officialSourceId, candidate.extractionMethod, candidate.evidenceJson, candidate.contentHash, canonicalKey,
         candidate.requirementsText, candidate.amountText],
      );
      const opportunityId = inserted.rows[0]?.id;
      if (!opportunityId) continue;
      saved += 1;
      await client.query(
        `insert into opportunity_sources
         (opportunity_id,official_source_id,source_role,source_page_url,retrieved_at,last_checked_at,content_hash,source_excerpt,is_primary,active)
         values ($1,$2,'primary_application_source',$3,now(),now(),$4,$5,true,true)`,
        [opportunityId, source.id, candidate.sourcePageUrl, candidate.contentHash,
         candidate.evidenceJson.application_route?.excerpt ?? ""],
      );
    }
    await client.query("update ingestion_runs set items_created=$1 where id=$2", [saved, run.rows[0].id]);
  });
  return { saved, persistence: "postgres" };
}

export function isPublishable(candidate: OpportunityCandidate & { humanVerifiedAt?: string }) {
  return candidate.reviewStatus === "approved" &&
    Boolean(candidate.humanVerifiedAt) &&
    Boolean(candidate.officialSourceId) &&
    Boolean(candidate.deadlineAt || candidate.deadlinePrecision === "continuous_flow") &&
    !["institution", "company", "professor", "researcher"].includes(candidate.applicantType) &&
    candidate.opportunityStatus === "open";
}

export function isVisiblePublicOpportunity(candidate: OpportunityCandidate & { humanVerifiedAt?: string }, now = new Date()) {
  if (!isPublishable(candidate)) return false;
  if (!candidate.deadlineAt || candidate.deadlinePrecision === "continuous_flow") return true;
  return new Date(candidate.deadlineAt).getTime() >= now.getTime();
}
