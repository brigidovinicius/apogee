import { queryPublic, withAdminTransaction } from "./client";
import { publishedOpportunityPredicate } from "./publication-filter";

const liveQuery = `select
         o.id,
         o.opportunity_status as "opportunityStatus",
         o.verification_method as "verificationMethod",
         o.verified_at::text as "verifiedAt",
         o.title,
         o.institution,
         o.benefit_type as "benefitType",
         o.categories,
         o.is_course as "isCourse",
         o.nationally_eligible as "nationallyEligible",
         o.applicant_type as "applicantType",
         o.event_starts_at as "eventStartsAt",
         o.deadline_at::text as "deadlineAt",
         o.deadline_precision as "deadlinePrecision",
         o.requirements_text as "requirementsText",
         o.amount_text as "amountText",
         o.state_code as "stateCode",
         o.city_name as "cityName",
         o.geographic_scope_kind as "geographicScopeKind",
         o.country_code as "countryCode",
         os.source_page_url as "officialUrl",
         os.application_url as "applicationUrl",
         coalesce(o.last_source_check_at,o.verified_at)::text as "lastCheckedAt"
       from opportunities o
       join official_sources source on source.id=o.official_source_id
         and source.active and source.verification_status='verified'
       join lateral (
         select * from opportunity_sources
         where opportunity_id=o.id and active
         order by is_primary desc, created_at desc
         limit 1
       ) os on true
       where ${publishedOpportunityPredicate}
       order by o.deadline_at nulls last`;
export async function listLiveCatalogue(management = false) {
  if (management) return withAdminTransaction(async (client) => (await client.query(
    liveQuery.replace('o.id,', `o.id, o.version, o.official_source_id as "officialSourceId", o.application_route as "applicationRoute", o.evidence_json as evidence,`)
  )).rows);
  return (await queryPublic(liveQuery)).rows;
}
