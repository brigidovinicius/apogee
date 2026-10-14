import { withAdminTransaction } from "@/lib/db/client";
import { officialSourceRegistry, getOfficialSource } from "@/lib/official-sources/registry";
import type { OfficialSource } from "./types";

export { officialSourceRegistry, getOfficialSource };

interface SourceRow {
  id: string;
  name: string;
  institution_name: string;
  institution_acronym: string;
  source_type: OfficialSource["sourceType"];
  base_url: string;
  allowed_domains: string[];
  allowed_path_prefixes: string[];
  listing_urls: string[];
  extraction_mode: OfficialSource["extractionMode"];
  audience_scope: OfficialSource["audienceScope"];
  geographic_scope: string[];
  state_code: string | null;
  city_name: string | null;
  categories: string[];
  priority: number;
  active: boolean;
  notes: string | null;
  crawl_listing_index: number;
  crawl_link_offset: number;
}

function toOfficialSource(row: SourceRow): OfficialSource {
  return {
    id: row.id, name: row.name, institutionName: row.institution_name,
    institutionAcronym: row.institution_acronym, sourceType: row.source_type,
    baseUrl: row.base_url, allowedDomains: row.allowed_domains,
    allowedPathPrefixes: row.allowed_path_prefixes, listingUrls: row.listing_urls,
    extractionMode: row.extraction_mode, audienceScope: row.audience_scope,
    geographicScope: row.geographic_scope, categories: row.categories,
    location: { stateCode: row.state_code, cityName: row.city_name },
    priority: row.priority, active: row.active, notes: row.notes ?? undefined,
    crawlListingIndex: row.crawl_listing_index, crawlLinkOffset: row.crawl_link_offset,
  };
}

export async function loadOfficialSource(id: string): Promise<OfficialSource | null> {
  if (!process.env.DATABASE_URL) return getOfficialSource(id) ?? null;
  const rows = await withAdminTransaction(async (client) =>
    (await client.query<SourceRow>("select * from official_sources where id=$1 and active=true and verification_status='verified'", [id])).rows,
  );
  return rows[0] ? toOfficialSource(rows[0]) : null;
}

export async function loadActiveOfficialSources(): Promise<OfficialSource[]> {
  if (!process.env.DATABASE_URL) return officialSourceRegistry.filter((source) => source.active);
  const rows = await withAdminTransaction(async (client) =>
    (await client.query<SourceRow>("select * from official_sources where active=true and verification_status='verified' order by priority desc")).rows,
  );
  return rows.map(toOfficialSource);
}

// Claim a small batch atomically so overlapping scheduler calls do not crawl
// the same source. The lease outlives the HTTP request and expires after a
// worker crash; each completed source then receives its own configured interval.
export async function claimDueOfficialSources(limit: number): Promise<OfficialSource[]> {
  if (!process.env.DATABASE_URL) throw new Error("Banco do Radar não configurado");
  const rows = await withAdminTransaction(async (client) =>
    (await client.query<SourceRow>(
      `with due as (
         select id from official_sources
         where active=true and verification_status='verified'
           and (extraction_mode in ('rss','html') or (
             extraction_mode='manual_assisted' and exists (
               select 1 from opportunities o where o.official_source_id=official_sources.id
                 and o.deleted_at is null and (o.next_source_check_at is null or o.next_source_check_at<=now())
             )
           ))
           and (next_crawl_at is null or next_crawl_at <= now())
         order by next_crawl_at nulls first, priority desc, id
         limit $1 for update skip locked
       )
       update official_sources as source
       set next_crawl_at=now() + interval '10 minutes', updated_at=now()
       from due where source.id=due.id returning source.*`,
      [limit],
    )).rows,
  );
  return rows.map(toOfficialSource);
}

export async function completeScheduledSource(id: string, failed: boolean) {
  await withAdminTransaction((client) => client.query(
    `update official_sources
     set last_crawled_at=now(),
         next_crawl_at=now() + case when $2 then interval '1 hour'
           when crawl_listing_index>0 or crawl_link_offset>0 or exists (select 1 from opportunities o where o.official_source_id=official_sources.id and o.deleted_at is null and (o.next_source_check_at is null or o.next_source_check_at<=now())) then interval '5 minutes'
           else make_interval(hours => crawl_interval_hours) end,
         updated_at=now()
     where id=$1`,
    [id, failed],
  ));
}
