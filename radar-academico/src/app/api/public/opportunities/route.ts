import { publishedOpportunityPredicate } from "@/lib/db/publication-filter";
import { queryPublic } from "@/lib/db/client";
import { isRadarConsumerAuthorized } from "@/lib/auth/radar-consumer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PublicOpportunityResponse = {
  id: string;
  title: string;
  institution: string;
  benefitType: string;
  applicantType: string;
  deadlineAt: string | null;
  deadlinePrecision: string;
  requirementsText: string;
  amountText: string;
  officialUrl: string;
  applicationUrl: string | null;
  stateCode: string | null;
  cityName: string | null;
  lastCheckedAt: string;
};

/**
 * Private integration contract for the Apogee mural.
 *
 * `queryPublic` opens the transaction with `app.is_admin=false`, so PostgreSQL
 * Explicit filters also protect against accidental RLS bypass: only approved, verified, open and
 * published opportunities can leave this endpoint.
 */
export async function GET(request: Request) {
  if (!isRadarConsumerAuthorized(request)) {
    return Response.json(
      { error: "Não autorizado" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const result = await queryPublic<PublicOpportunityResponse>(
      `select
         o.id,
         o.title,
         o.institution,
         o.benefit_type as "benefitType",
         o.applicant_type as "applicantType",
         o.deadline_at::text as "deadlineAt",
         o.deadline_precision as "deadlinePrecision",
         o.requirements_text as "requirementsText",
         o.amount_text as "amountText",
         o.state_code as "stateCode",
         o.city_name as "cityName",
         coalesce(os.official_document_url, os.source_page_url) as "officialUrl",
         os.application_url as "applicationUrl",
         os.last_checked_at::text as "lastCheckedAt"
       from opportunities o
       join lateral (
         select * from opportunity_sources
         where opportunity_id=o.id and active
         order by is_primary desc, created_at desc
         limit 1
       ) os on true
       where ${publishedOpportunityPredicate}
       order by o.deadline_at nulls last`,
    );

    return Response.json(
      {
        version: 2,
        generatedAt: new Date().toISOString(),
        opportunities: result.rows,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { error: "Catálogo público indisponível" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
