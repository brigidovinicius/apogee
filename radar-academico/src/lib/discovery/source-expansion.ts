import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import * as cheerio from "cheerio";
import type { PoolClient } from "pg";
import { candidateUrl } from "./daily-discovery";
import { fetchOfficialResource } from "@/lib/ingestion/fetch-source";
import { isOfficialSourceUrl } from "@/lib/ingestion/validate-url";
import { normalizeDiscoveredPage } from "@/lib/ingestion/discovered-page";
import { publicationIssue } from "@/lib/ingestion/publication";
import { structuredEvents } from "@/lib/ingestion/structured-events";
import type { OfficialSource, OpportunityCandidate } from "@/lib/ingestion/types";

export type ExpansionLead = {
  url: string; title: string; target_id: string; target_official_url: string;
  target_verified_at: string | null; target_enabled: boolean; target_verified_url: string | null;
  target_name?: string; target_organizer?: string; target_priority?: number;
};
export type SourceRegistration = {
  checkedAt: string; targetHash: string; pageHash: string;
  organizer: string; targetUrl: string; targetVerifiedAt: string; targetPriority: number;
};
export type PreparedDiscoveryCandidate = { source: OfficialSource; candidate: OpportunityCandidate; registration?: SourceRegistration }
  | { reason: string; retry?: boolean };

function pageSource(lead: ExpansionLead): OfficialSource {
  const url = new URL(lead.url);
  return {
    id: `auto-page-${createHash("sha256").update(lead.url).digest("hex").slice(0, 32)}`,
    name: lead.title, institutionName: lead.target_organizer!, institutionAcronym: "",
    sourceType: "official_reference", baseUrl: lead.url, allowedDomains: [url.hostname],
    allowedPathPrefixes: [url.pathname], listingUrls: [lead.url], extractionMode: "html",
    audienceScope: [], geographicScope: [], categories: [], priority: Math.min(70, lead.target_priority ?? 0), active: true,
    notes: `radar:discovery-page:v1; target=${lead.target_id}; authority=${lead.target_official_url}`,
  };
}

/** Verify the actual parent link and eligible detail before granting one exact URL any authority. */
export async function prepareSourceExpansion(lead: ExpansionLead): Promise<PreparedDiscoveryCandidate> {
  const url = candidateUrl(lead.url), parent = candidateUrl(lead.target_official_url);
  if (!lead.target_enabled || !lead.target_verified_at || lead.target_verified_url !== lead.target_official_url ||
    !lead.target_organizer?.trim() || !url || url !== lead.url || !parent ||
    new URL(url).origin !== new URL(parent).origin) return { reason: "source_authority_unverified" };
  // Profiles, forms and city aggregators are not independently verified organizers.
  const host = new URL(url).hostname;
  if (/^(?:www\.)?(?:youtube\.com|youtu\.be|forms\.gle|docs\.google\.com)$/.test(host) ||
    host === "luma.com" && lead.target_organizer === "Luma") return { reason: "unsupported_source" };
  const source = pageSource(lead);
  // Preserve the target's audited ID for existing, narrowly scoped transport exceptions.
  const parentSource: OfficialSource = { ...source, id: lead.target_id, baseUrl: parent,
    listingUrls: [parent], allowedPathPrefixes: [new URL(parent).pathname] };
  const target = await fetchOfficialResource(parent, parentSource, 2 * 1024 * 1024);
  if (!/text\/html|application\/xhtml/i.test(target.contentType)) return { reason: "unsupported_content" };
  const $ = cheerio.load(target.body.toString("utf8"));
  const linked = url === parent || structuredEvents(target.body.toString("utf8")).some(event => event.url === url) || $("a[href]").toArray().some(node => {
    try { return candidateUrl(new URL($(node).attr("href")!, parent).href) === url; } catch { return false; }
  });
  if (!linked) return { reason: "source_link_missing" };
  const resource = url === parent ? target : await fetchOfficialResource(url, source, 2 * 1024 * 1024);
  if (!/text\/html|application\/xhtml/i.test(resource.contentType)) return { reason: "unsupported_content" };
  const candidate = normalizeDiscoveredPage(resource.body.toString("utf8"), source);
  if (!candidate || candidate.requiresManualReview) return { reason: "candidate_unconfirmed" };
  const issue = publicationIssue(candidate, source);
  if (issue) return { reason: issue };
  return { source, candidate, registration: { checkedAt: new Date().toISOString(), targetHash: target.hash,
    pageHash: resource.hash, organizer: source.institutionName, targetUrl: lead.target_official_url,
    targetVerifiedAt: lead.target_verified_at, targetPriority: lead.target_priority ?? 0 } };
}

/** Called inside the same transaction as opportunity persistence and lead completion. */
export async function registerDiscoveredSource(client: PoolClient, lead: ExpansionLead,
  prepared: Extract<PreparedDiscoveryCandidate, { source: OfficialSource }>): Promise<{ added: number } | { reason: string }> {
  const proof = prepared.registration;
  if (!proof || !Number.isFinite(Date.parse(proof.checkedAt)) || Date.now() - Date.parse(proof.checkedAt) > 5 * 60_000 || Date.parse(proof.checkedAt) > Date.now() ||
    !/^[a-f0-9]{64}$/.test(proof.targetHash) || !/^[a-f0-9]{64}$/.test(proof.pageHash) ||
    proof.organizer !== lead.target_organizer || proof.targetUrl !== lead.target_official_url ||
    proof.targetVerifiedAt !== lead.target_verified_at || proof.targetPriority !== (lead.target_priority ?? 0) ||
    !isDeepStrictEqual(prepared.source, pageSource(lead)) || !isOfficialSourceUrl(lead.url, [prepared.source])) {
    return { reason: "source_changed" };
  }
  const source = prepared.source, url = new URL(lead.url);
  await client.query("select pg_advisory_xact_lock(hashtextextended($1,0))", [source.id]);
  await client.query("select pg_advisory_xact_lock(hashtextextended($1,0))", [`radar:page:${lead.url}`]);
  const existing = await client.query<{ id: string; active: boolean; verification_status: string; base_url: string;
    allowed_domains: string[]; allowed_path_prefixes: string[]; listing_urls: string[]; notes: string;
    institution_name: string; extraction_mode: string }>(
    `select id,active,verification_status,base_url,allowed_domains,allowed_path_prefixes,listing_urls,notes,institution_name,extraction_mode
     from official_sources where id=$1 or base_url=$2 or $2=any(listing_urls)
       or ($3=any(allowed_domains) and exists(select 1 from unnest(allowed_path_prefixes) prefix
         where left($4,length(prefix))=prefix)) for share`, [source.id, lead.url, url.hostname, url.pathname]);
  if (existing.rows.length) {
    const row = existing.rows[0];
    // Never shadow a disabled/pending source or overwrite operator configuration.
    if (existing.rows.length !== 1 || row.id !== source.id || !row.active || row.verification_status !== "verified" ||
      row.base_url !== source.baseUrl || row.institution_name !== source.institutionName || row.notes !== source.notes ||
      row.extraction_mode !== "html" || !isDeepStrictEqual(row.allowed_domains, source.allowedDomains) ||
      !isDeepStrictEqual(row.allowed_path_prefixes, source.allowedPathPrefixes) || !isDeepStrictEqual(row.listing_urls, source.listingUrls)) {
      return { reason: "source_registration_conflict" };
    }
    return { added: 0 };
  }
  const identity = await client.query<{ deleted_at: string | null }>(`select o.deleted_at from opportunities o
    where exists(select 1 from opportunity_sources os where os.opportunity_id=o.id and os.source_page_url=$1) limit 1`, [lead.url]);
  if (identity.rows.length) return { reason: identity.rows[0].deleted_at ? "deleted" : "identity_conflict" };
  await client.query(`insert into official_sources(id,name,institution_name,institution_acronym,source_type,base_url,
    allowed_domains,allowed_path_prefixes,listing_urls,extraction_mode,audience_scope,geographic_scope,categories,priority,
    active,verification_status,verification_method,verification_evidence_url,verified_at,verified_by,
    audit_evidence_url,audited_at,audited_by,robots_checked_at,notes,next_crawl_at)
    values($1,$2,$3,'','official_reference',$4,$5,$6,$7,'html','{}','{}','{}',$8,
      true,'verified','automatic',$9,now(),'radar:discovery', $9,now(),'radar:discovery',now(),$10,now()+interval '24 hours')`,
    [source.id, source.name, source.institutionName, source.baseUrl, source.allowedDomains, source.allowedPathPrefixes,
      source.listingUrls, source.priority, proof.targetUrl, source.notes]);
  return { added: 1 };
}
