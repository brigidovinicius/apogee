import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { withAdminTransaction } from "@/lib/db/client";
import { loadActiveOfficialSources } from "@/lib/ingestion/official-source-registry";
import { lockSource, persistCandidate } from "@/lib/ingestion/persist-candidate";
import { publicationIssue } from "@/lib/ingestion/publication";
import { ingestionFailureReason } from "@/lib/ingestion/failure-reason";
import { isOfficialSourceUrl } from "@/lib/ingestion/validate-url";
import type { OfficialSource, OpportunityCandidate } from "@/lib/ingestion/types";
import { prepareLeadCandidate } from "./lead-candidate";

export type ProcessingLead = {
  id: string; target_id: string; url: string; title: string; excerpt: string;
  status: "new" | "reviewing" | "mapped" | "dismissed";
  processing_lease_token: string; processing_attempts: number; processing_run_id: string;
  target_official_url: string; target_verified_at: string | null;
  target_enabled: boolean; target_verified_url: string | null;
};

export const LEAD_PROCESSING_REASONS = new Set([
  "scope_unverified", "source_unavailable", "source_changed", "target_unavailable", "target_changed", "lead_changed",
  "candidate_unconfirmed", "unsupported_source", "unsupported_content", "listing_or_ambiguous", "expired", "event_started",
  "invalid_source", "source_conflict", "status_unconfirmed", "invalid_deadline", "application_route_unconfirmed",
  "missing_evidence", "national_scope_unconfirmed", "deleted", "identity_conflict", "manual_override",
  "unchanged", "published", "updated", "processing_failed", "retry_exhausted", "previously_reviewed", "lease_expired",
  "robots_unavailable_or_disallowed", "url_or_network_disallowed", "redirect_disallowed_or_exhausted",
  "response_limit_exceeded", "evidence_changed_or_unconfirmed", "request_timeout", "dns_failure",
  "tls_verification_failed", "source_request_failed", "http_400", "http_401", "http_403", "http_404",
  "http_408", "http_410", "http_429", "http_500", "http_502", "http_503", "http_504",
]);

export function sanitizedLeadReason(reason: string) {
  return LEAD_PROCESSING_REASONS.has(reason) ? reason : "candidate_unconfirmed";
}

const MAX_ATTEMPTS = 4;
const RETRYABLE_REASONS = new Set(["processing_failed", "request_timeout", "dns_failure", "source_request_failed",
  "robots_unavailable_or_disallowed", "http_408", "http_429", "http_500", "http_502", "http_503", "http_504"]);
export function leadRetryDelayMinutes(attempt: number) {
  return Math.min(24 * 60, 60 * 2 ** Math.max(0, attempt - 1));
}

export async function claimDueDiscoveryLeads(): Promise<ProcessingLead[]> {
  return withAdminTransaction(async (client) => {
    await client.query(
      `with exhausted as (
         update discovery_leads set processing_status='blocked',processing_reason='retry_exhausted',processed_at=now(),
           processing_lease_until=null,processing_lease_token=null
         where processing_status='processing' and processing_lease_until<=now() and processing_attempts >= $1
         returning processing_run_id
       ) update ingestion_runs set status='failed',finished_at=now(),items_failed=1,error_summary='retry_exhausted',
         execution_metadata=execution_metadata || '{"reason":"retry_exhausted","outcome":"blocked"}'::jsonb
         where id in (select processing_run_id from exhausted) and status='running'`, [MAX_ATTEMPTS]);
    const { rows } = await client.query<ProcessingLead & { previous_run_id: string | null }>(
      `with due as (
         select lead.id,lead.processing_run_id as previous_run_id,
           target.official_url as target_official_url,target.official_verified_at::text as target_verified_at,
           target.enabled as target_enabled,target.official_verified_url as target_verified_url
         from discovery_leads lead join discovery_targets target on target.id=lead.target_id
         where lead.status in ('new','reviewing')
           and lead.processing_attempts < $1
           and ((lead.processing_status in ('pending','retry') and lead.processing_next_at<=now())
             or (lead.processing_status='processing' and lead.processing_lease_until<=now()))
         order by lead.processing_next_at,lead.first_seen_at,lead.id
         limit 2 for update of lead skip locked
       ) update discovery_leads lead set processing_status='processing',
         processing_lease_until=now()+interval '10 minutes',processing_lease_token=$2,
         processing_attempts=lead.processing_attempts+1,processing_reason=null
       from due where lead.id=due.id
       returning lead.*,due.target_official_url,due.target_verified_at,due.target_enabled,due.target_verified_url,due.previous_run_id`,
      [MAX_ATTEMPTS, randomUUID()],
    );
    for (const lead of rows) {
      if (lead.previous_run_id) await client.query(
        `update ingestion_runs set status='failed',finished_at=now(),items_failed=1,error_summary='lease_expired',
          execution_metadata=execution_metadata || '{"reason":"lease_expired"}'::jsonb
         where id=$1 and status='running'`, [lead.previous_run_id]);
      const run = await client.query<{ id: string }>(
        `insert into ingestion_runs(started_at,status,execution_metadata) values(now(),'running',$1) returning id`,
        [{ component: "discovery-lead", lead_id: lead.id, attempt: lead.processing_attempts, lease_token: lead.processing_lease_token }],
      );
      lead.processing_run_id = run.rows[0].id;
      await client.query("update discovery_leads set processing_run_id=$2 where id=$1", [lead.id, lead.processing_run_id]);
    }
    return rows;
  });
}

type Prepared = { source: OfficialSource; candidate: OpportunityCandidate } | { reason: string; retry?: boolean };
type Outcome = { reason: string; state: "retry" | "blocked" | "completed" | "ignored"; created: number; updated: number; published: number; opportunityId?: string; sourceId?: string };

function blocked(reason: string, retry: boolean, attempt: number): Outcome {
  const shouldRetry = retry && RETRYABLE_REASONS.has(reason);
  return { reason: shouldRetry && attempt >= MAX_ATTEMPTS ? "retry_exhausted" : sanitizedLeadReason(reason),
    state: shouldRetry && attempt < MAX_ATTEMPTS ? "retry" : "blocked", created: 0, updated: 0, published: 0 };
}

async function recordOutcome(client: PoolClient, lead: ProcessingLead, outcome: Outcome) {
  await client.query(
    `update discovery_leads set processing_status=$3,processing_reason=$4,processed_at=now(),
       processing_next_at=now()+make_interval(mins=>$5),processing_lease_until=null,processing_lease_token=null,
       processing_source_id=$6,processing_opportunity_id=$7,
       status=case when $3='completed' then 'mapped' else status end,
       reviewed_at=case when $3='completed' then now() else reviewed_at end
     where id=$1 and processing_lease_token=$2 and processing_status='processing'`,
    [lead.id, lead.processing_lease_token, outcome.state, outcome.reason,
      leadRetryDelayMinutes(lead.processing_attempts), outcome.sourceId ?? null, outcome.opportunityId ?? null],
  );
  await client.query(
    `update ingestion_runs set official_source_id=$2,finished_at=now(),status=$3,
       pages_checked=$4,items_discovered=$5,items_created=$6,items_updated=$7,items_ignored=$8,items_failed=$9,
       error_summary=$10,execution_metadata=execution_metadata || $11::jsonb where id=$1 and status='running'`,
    [lead.processing_run_id, outcome.sourceId ?? null,
      outcome.state === "retry" ? "failed" : outcome.state === "blocked" ? "completed_with_warnings" : "completed",
      outcome.sourceId ? 1 : 0, outcome.opportunityId ? 1 : 0, outcome.created, outcome.updated,
      outcome.state === "ignored" ? 1 : 0, outcome.state === "retry" ? 1 : 0,
      ["retry", "blocked"].includes(outcome.state) ? outcome.reason : null,
      { outcome: outcome.state, reason: outcome.reason, published: outcome.published, opportunity_id: outcome.opportunityId ?? null }],
  );
  return outcome;
}

export async function finishDiscoveryLead(lead: ProcessingLead, prepared: Prepared): Promise<Outcome | null> {
  return withAdminTransaction(async (client) => {
    const current = await client.query<ProcessingLead & { target_enabled: boolean; target_current_url: string; target_current_verified_url: string | null; target_current_verified_at: string | null }>(
      `select lead.*,target.enabled as target_enabled,target.official_url as target_current_url,
         target.official_verified_url as target_current_verified_url,target.official_verified_at::text as target_current_verified_at
       from discovery_leads lead join discovery_targets target on target.id=lead.target_id
       where lead.id=$1 and lead.processing_lease_token=$2 and lead.processing_status='processing'
         and lead.processing_lease_until>now() for update of lead for share of target`,
      [lead.id, lead.processing_lease_token],
    );
    const row = current.rows[0];
    if (!row) return null; // A reclaimed lease owns any subsequent write.
    if (!["new", "reviewing"].includes(row.status)) return recordOutcome(client, lead,
      { ...blocked("previously_reviewed", false, lead.processing_attempts), state: "ignored" });
    if (row.url !== lead.url || row.target_id !== lead.target_id || row.title !== lead.title) {
      return recordOutcome(client, lead, blocked("lead_changed", false, lead.processing_attempts));
    }
    if (!row.target_enabled || !row.target_current_verified_at || row.target_current_verified_url !== row.target_current_url) {
      return recordOutcome(client, lead, blocked("target_unavailable", false, lead.processing_attempts));
    }
    if (row.target_current_url !== lead.target_official_url || row.target_current_verified_at !== lead.target_verified_at) {
      return recordOutcome(client, lead, blocked("target_changed", false, lead.processing_attempts));
    }
    if ("reason" in prepared) return recordOutcome(client, lead, blocked(prepared.reason, prepared.retry === true, lead.processing_attempts));
    const { source, candidate } = prepared;
    // Advisory source lock and the shared row lock protect the last check through persistence.
    try { await lockSource(client, source); }
    catch (error) {
      if (error instanceof Error && error.message === "Fonte oficial inativa ou não verificada") {
        return recordOutcome(client, lead, blocked("source_unavailable", false, lead.processing_attempts));
      }
      throw error;
    }
    const live = await client.query<{ allowed_domains: string[]; allowed_path_prefixes: string[]; extraction_mode: string; base_url: string; listing_urls: string[] }>(
      "select allowed_domains,allowed_path_prefixes,extraction_mode,base_url,listing_urls from official_sources where id=$1 and active and verification_status='verified' for share", [source.id]);
    const liveSource = live.rows[0];
    if (!liveSource || !["html", "rss"].includes(liveSource.extraction_mode)) {
      return recordOutcome(client, lead, blocked("source_unavailable", false, lead.processing_attempts));
    }
    if (liveSource.base_url !== source.baseUrl || liveSource.extraction_mode !== source.extractionMode ||
      JSON.stringify(liveSource.allowed_domains) !== JSON.stringify(source.allowedDomains) ||
      JSON.stringify(liveSource.allowed_path_prefixes) !== JSON.stringify(source.allowedPathPrefixes) ||
      JSON.stringify(liveSource.listing_urls) !== JSON.stringify(source.listingUrls)) {
      return recordOutcome(client, lead, blocked("source_changed", false, lead.processing_attempts));
    }
    if (!isOfficialSourceUrl(lead.url, [source]) || !isOfficialSourceUrl(candidate.sourcePageUrl, [source])) {
      return recordOutcome(client, lead, blocked("scope_unverified", false, lead.processing_attempts));
    }
    const issue = publicationIssue(candidate, source);
    if (issue || candidate.requiresManualReview) {
      return recordOutcome(client, lead, blocked(issue ?? "candidate_unconfirmed", false, lead.processing_attempts));
    }
    let result: Awaited<ReturnType<typeof persistCandidate>>;
    try { result = await persistCandidate(client, source, candidate, { mode: "automatic" }); }
    catch (error) {
      if (error instanceof Error && /identidade ambígua|Página com múltiplas fichas|Página já pertence a outro catálogo/i.test(error.message)) {
        return recordOutcome(client, lead, blocked("identity_conflict", false, lead.processing_attempts));
      }
      throw error;
    }
    if (!result.id) return recordOutcome(client, lead, blocked("candidate_unconfirmed", false, lead.processing_attempts));
    const stored = await client.query<{ deleted_at: string | null; official_source_id: string; publication_issue: string | null; published_at: string | null; source_page_url: string | null }>(
      `select o.deleted_at,o.official_source_id,o.publication_issue,o.published_at,
         (select os.source_page_url from opportunity_sources os where os.opportunity_id=o.id and os.active and os.is_primary limit 1) as source_page_url
       from opportunities o where o.id=$1`, [result.id]);
    const opportunity = stored.rows[0];
    if (opportunity?.deleted_at) return recordOutcome(client, lead,
      { ...blocked("deleted", false, lead.processing_attempts), state: "ignored", opportunityId: result.id, sourceId: source.id });
    if (!opportunity || opportunity.official_source_id !== source.id || result.blocked || opportunity.publication_issue || !opportunity.published_at) {
      return recordOutcome(client, lead, { ...blocked("identity_conflict", false, lead.processing_attempts), sourceId: source.id });
    }
    if (opportunity.source_page_url !== candidate.sourcePageUrl) {
      return recordOutcome(client, lead, { ...blocked("manual_override", false, lead.processing_attempts), sourceId: source.id });
    }
    return recordOutcome(client, lead, { state: "completed", reason: result.created ? "published" : result.updated ? "updated" : "unchanged",
      created: result.created, updated: result.updated, published: result.published, opportunityId: result.id, sourceId: source.id });
  });
}

export async function runScheduledLeadProcessing() {
  const leads = await claimDueDiscoveryLeads();
  const sources = await loadActiveOfficialSources();
  const report = { leadsChecked: leads.length, created: 0, updated: 0, published: 0, blocked: 0, retried: 0, ignored: 0, leaseLost: 0, failed: 0, reasons: {} as Record<string, number> };
  for (const lead of leads) {
    let prepared: Prepared;
    try {
      prepared = !lead.target_enabled || !lead.target_verified_at || lead.target_verified_url !== lead.target_official_url
        ? { reason: "target_unavailable" } : await prepareLeadCandidate(lead, sources);
    }
    catch (error) { prepared = { reason: ingestionFailureReason(error), retry: true }; }
    let outcome: Outcome | null;
    try { outcome = await finishDiscoveryLead(lead, prepared); }
    catch {
      try { outcome = await finishDiscoveryLead(lead, { reason: "processing_failed", retry: true }); }
      catch { report.failed += 1; continue; } // Lease expires; the running audit remains visible.
    }
    if (!outcome) { report.leaseLost += 1; continue; }
    report.created += outcome.created; report.updated += outcome.updated; report.published += outcome.published;
    if (outcome.state === "blocked") report.blocked += 1;
    if (outcome.state === "retry") report.retried += 1;
    if (outcome.state === "ignored") report.ignored += 1;
    report.reasons[outcome.reason] = (report.reasons[outcome.reason] ?? 0) + 1;
  }
  return report;
}
