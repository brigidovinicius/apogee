import type { PoolClient } from "pg";
import type { OfficialSource, OpportunityCandidate } from "./types";
import { canonicalOpportunityKey } from "./revision-key";
import { publicationIssue } from "./publication";
import { categoriesFromEvidence } from "./categories";

export const candidateColumns = {
  title: "title", institution: "institution", applicantType: "applicant_type", applicationRoute: "application_route",
  benefitType: "benefit_type", categories: "categories", isCourse: "is_course", nationallyEligible: "nationally_eligible",
  deadlineAt: "deadline_at", deadlinePrecision: "deadline_precision", stateCode: "state_code", cityName: "city_name",
  requirementsText: "requirements_text", amountText: "amount_text", opportunityStatus: "opportunity_status",
} as const;
export type CandidateField = keyof typeof candidateColumns;
export type StoredOpportunity = Record<string, unknown> & {
  id: string; version: number; deleted_at: string | null; management_overrides: Partial<OpportunityCandidate>;
  content_hash: string; official_source_id: string;
};

export async function lockSource(client: PoolClient, source: OfficialSource) {
  // Serializes ingestion and management for this source, including first insert.
  await client.query("select pg_advisory_xact_lock(hashtextextended($1,0))", [source.id]);
  const active = await client.query("select id from official_sources where id=$1 and active and verification_status='verified' for share", [source.id]);
  if (!active.rows.length) throw new Error("Fonte oficial inativa ou não verificada");
}

export async function findCandidate(client: PoolClient, candidate: OpportunityCandidate) {
  const result = await client.query<StoredOpportunity>(
    `select * from opportunities where official_source_id=$1 and canonical_key=$2 order by created_at limit 2 for update`,
    [candidate.officialSourceId, canonicalOpportunityKey(candidate.officialSourceId, candidate.title, candidate.sourcePageUrl)],
  );
  if (result.rows.length > 1) throw new Error("Identidade ambígua; coleta não aplicada");
  if (result.rows[0]) return result.rows[0];
  if (candidate.extractionMethod === "manual_assisted") return undefined;
  // A changed headline on the same detail page retains its identity, including tombstones.
  const byUrl = await client.query<StoredOpportunity>(`select o.* from opportunities o
    where o.official_source_id=$1 and exists (select 1 from opportunity_sources os
      where os.opportunity_id=o.id and os.source_page_url=$2)
    order by o.created_at limit 2 for update`, [candidate.officialSourceId, candidate.sourcePageUrl]);
  if (byUrl.rows.length > 1 || byUrl.rows[0]?.ingestion_origin === "manual") throw new Error("Página com múltiplas fichas; identidade ambígua");
  return byUrl.rows[0];
}

export async function persistCandidate(client: PoolClient, source: OfficialSource, incoming: OpportunityCandidate,
  options: { mode: "automatic" | "admin"; actor?: string; existing?: StoredOpportunity; overrides?: Partial<OpportunityCandidate> }) {
  const existing = options.existing ?? await findCandidate(client, incoming);
  if (existing?.deleted_at) return { id: existing.id, saved: 0, published: 0, blocked: 0, created: 0, updated: 0 };
  const overrides = options.overrides ?? existing?.management_overrides ?? {};
  if (options.mode === "automatic" && overrides.sourcePageUrl && overrides.sourcePageUrl !== incoming.sourcePageUrl) return { id: existing?.id, saved: 0, published: 0, blocked: 0, created: 0, updated: 0 };
  const candidate = { ...incoming, categories: incoming.categories ?? categoriesFromEvidence(incoming.benefitType, incoming.isCourse === true), ...overrides };
  // A source that closed or became ambiguous cannot be kept live by a stale manual override.
  const issue = publicationIssue(incoming, source) ?? publicationIssue(candidate, source);
  const values: Record<string, unknown> = {};
  for (const [field, column] of Object.entries(candidateColumns)) values[column] = candidate[field as CandidateField] ?? null;
  values.is_course = candidate.isCourse === true;
  values.nationally_eligible = candidate.nationallyEligible === true;
  const scope = candidate.cityName ? "city" : candidate.stateCode ? "state" : candidate.nationallyEligible ? "country" : candidate.geographicScopeKind ?? "unknown";
  values.geographic_scope_kind = scope;
  values.country_code = candidate.countryCode ?? (scope === "state" || scope === "city" || candidate.nationallyEligible ? "BR" : null);
  Object.assign(values, {
    review_status: issue ? "needs_information" : "approved", publication_issue: issue,
    source_conflict: incoming.sourceConflict === true,
    extraction_method: incoming.extractionMethod, evidence_json: incoming.evidenceJson,
    content_hash: incoming.contentHash, management_overrides: overrides,
    has_retification: incoming.hasRetification === true,
  });
  const fields = Object.keys(values);
  const args: unknown[] = Object.values(values);
  const now = new Date().toISOString();
  const changed = !existing || existing.content_hash !== incoming.contentHash || options.mode === "admin" || existing.publication_issue !== issue;
  let id: string;
  if (existing) {
    args.push(now, options.mode, existing.id);
    const dateIndex = args.length - 2;
    await client.query(`update opportunities set ${fields.map((field, index) => `${field}=$${index + 1}`).join(",")},
      next_source_check_at=now()+interval '24 hours',
      last_source_check_at=case when $${dateIndex+1}='automatic' then $${dateIndex}::timestamptz else last_source_check_at end,
      verified_at=$${dateIndex},verification_method=$${dateIndex+1},
      published_at=case when publication_issue is null and $${fields.indexOf("publication_issue")+1}::text is null then coalesce(published_at,$${dateIndex}::timestamptz) when $${fields.indexOf("publication_issue")+1}::text is null then $${dateIndex}::timestamptz else null end,
      version=version+${changed ? 1 : 0},updated_at=case when ${changed} then $${dateIndex}::timestamptz else updated_at end
      where id=$${args.length}`, args);
    id = existing.id;
  } else {
    Object.assign(values, { ingestion_origin: incoming.extractionMethod === "manual_assisted" ? "manual" : "automatic", official_source_id: source.id, canonical_key: canonicalOpportunityKey(source.id, incoming.title, incoming.sourcePageUrl),
      target_academic_levels: [candidate.applicantType], verified_at: now, verification_method: options.mode,
      next_source_check_at: now, last_source_check_at: options.mode === "automatic" ? now : null, published_at: issue ? null : now, extracted_at: now });
    const cols = Object.keys(values);
    const inserted = await client.query<{ id: string }>(`insert into opportunities (${cols.join(",")}) values (${cols.map((_, i) => `$${i+1}`).join(",")}) returning id`, Object.values(values));
    id = inserted.rows[0].id;
  }
  const links = await client.query("select id,source_page_url from opportunity_sources where opportunity_id=$1 and is_primary order by created_at limit 1", [id]);
  const sameUrl = links.rows[0]?.source_page_url === candidate.sourcePageUrl;
  if (links.rows[0] && !sameUrl) {
    // Keep previous URLs as identity aliases, so old crawls cannot recreate deleted records.
    await client.query("update opportunity_sources set active=false,is_primary=false where id=$1", [links.rows[0].id]);
  }
  if (links.rows[0] && sameUrl) {
    await client.query(`update opportunity_sources set source_page_url=$2,content_hash=$3,
      source_excerpt=$4, last_checked_at=case when $5 then now() else last_checked_at end where id=$1`,
    [links.rows[0].id, candidate.sourcePageUrl, incoming.contentHash, incoming.evidenceJson.opportunity_status?.excerpt ?? "", options.mode === "automatic"]);
  } else {
    await client.query(`insert into opportunity_sources (opportunity_id,official_source_id,source_role,source_page_url,retrieved_at,last_checked_at,content_hash,source_excerpt,is_primary,active)
      values ($1,$2,'primary_application_source',$3,now(),now(),$4,$5,true,true)`,
    [id, source.id, candidate.sourcePageUrl, incoming.contentHash, incoming.evidenceJson.opportunity_status?.excerpt ?? ""]);
  }
  if (changed) {
    await client.query(`insert into opportunity_management_events (opportunity_id,actor,action,previous_data,new_data)
      values ($1,$2,$3,$4,$5)`, [id, options.actor ?? "radar:automatic", existing ? "update" : "create", existing ?? null,
      { candidate, publicationIssue: issue, verificationMethod: options.mode }]);
  }
  return { id, saved: changed ? 1 : 0, published: !issue && changed ? 1 : 0, blocked: issue ? 1 : 0, created: existing ? 0 : 1, updated: existing && changed ? 1 : 0 };
}
