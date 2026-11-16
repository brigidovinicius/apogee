import { withAdminTransaction } from "@/lib/db/client";
import { fetchPublicJobApi } from "./job-api";
import { parseJobFeed } from "./job-feed";
import { lockSource, persistCandidate } from "./persist-candidate";
import type { OfficialSource } from "./types";

/** One complete board snapshot; all persistence and absence observations commit together. */
export async function ingestJobSource(source: OfficialSource, maxCandidates = 200) {
  if (!Number.isInteger(maxCandidates) || maxCandidates < 1 || maxCandidates > 200) throw Error("Invalid job batch size");
  const resource = await fetchPublicJobApi(source);
  if (!/application\/(?:[\w.-]+\+)?json/i.test(resource.contentType)) throw Error("Job feed must be JSON");
  const feed = parseJobFeed(JSON.parse(resource.body.toString("utf8")), source);
  const offset = source.crawlLinkOffset ?? 0;
  const selected = feed.candidates.slice(offset, offset + maxCandidates);
  const next = offset + selected.length >= feed.candidates.length ? 0 : offset + selected.length;
  const persistence = await withAdminTransaction(async client => {
    await lockSource(client, source);
    const counts = { saved: 0, published: 0, blocked: 0, created: 0, updated: 0 };
    // An explicit hidden flag is stronger evidence than mere absence from a feed.
    await client.query(`update opportunities set publication_issue='job_hidden',published_at=null,version=version+1
      where official_source_id=$1 and employment->>'requisitionId'=any($2::text[]) and published_at is not null`, [source.id, feed.hiddenRequisitions]);
    for (const candidate of selected) {
      const result = await persistCandidate(client, source, candidate, { mode: "automatic" });
      for (const key of Object.keys(counts) as (keyof typeof counts)[]) counts[key] += result[key];
    }
    // A successful complete board read resets absence; it does not renew field verification.
    await client.query(`update opportunities set job_missing_since=null,job_missing_checked_at=null
      where official_source_id=$1 and employment->>'requisitionId'=any($2::text[])`, [source.id, feed.listedRequisitions]);
    // Repeated requests within six hours and failures cannot count as a second absence.
    const closed = await client.query(`update opportunities set opportunity_status='closed',publication_issue='status_unconfirmed',
      published_at=null,last_source_check_at=now(),version=version+1,
      evidence_json=evidence_json || jsonb_build_object('opportunity_status',jsonb_build_object(
        'source_url',$3::text,'excerpt','Ausente em duas consultas completas do quadro oficial, separadas por pelo menos seis horas.'))
      where official_source_id=$1 and employment is not null and deleted_at is null
        and not (employment->>'requisitionId'=any($2::text[])) and opportunity_status='open'
        and job_missing_since<=now()-interval '6 hours' returning id`, [source.id, feed.listedRequisitions, source.listingUrls[0]]);
    for (const row of closed.rows) await client.query(`insert into opportunity_management_events(opportunity_id,actor,action,new_data)
      values($1,'radar:automatic','withdraw',$2)`, [row.id, { reason: "job_absent_twice", sourceUrl: source.listingUrls[0] }]);
    await client.query(`update opportunities set job_missing_since=coalesce(job_missing_since,now()),job_missing_checked_at=now()
      where official_source_id=$1 and employment is not null and deleted_at is null and opportunity_status='open'
        and not (employment->>'requisitionId'=any($2::text[]))`, [source.id, feed.listedRequisitions]);
    // A complete board check also schedules absent/hidden records. Otherwise the
    // generic scheduler would treat them as overdue and poll every five minutes.
    await client.query(`update opportunities set next_source_check_at=now()+interval '6 hours'
      where official_source_id=$1 and employment is not null and deleted_at is null`, [source.id]);
    await client.query("update official_sources set crawl_listing_index=0,crawl_link_offset=$2 where id=$1", [source.id, next]);
    await client.query(`insert into ingestion_runs(official_source_id,started_at,finished_at,status,pages_checked,items_discovered,
      items_created,items_updated,items_ignored,items_failed,execution_metadata)
      values($1,now(),now(),'completed',1,$2,$3,$4,0,0,$5)`,
    [source.id, selected.length, counts.created, counts.updated, { automatic_publish: true, complete_job_feed: true, closed: closed.rowCount, ...counts }]);
    return counts;
  });
  return { startedAt: new Date().toISOString(), automaticPublish: true, pagesChecked: 1, discovered: selected.length,
    sentToReview: 0, ...persistence, sources: [{ sourceId: source.id, failed: 0, ignored: 0, locationRejected: 0,
      warnings: [] as string[], discovered: selected, pagesChecked: 1, nextListingIndex: 0, nextLinkOffset: next, ...persistence }] };
}
