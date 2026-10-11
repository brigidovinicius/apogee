import { withAdminTransaction } from "@/lib/db/client";
import { openDeadlinePredicate } from "@/lib/db/publication-filter";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class OpportunityReviewError extends Error {}

export type PendingOpportunity = {
  id: string;
  title: string;
  institution: string;
  applicantType: string;
  applicationRoute: string;
  isCourse: boolean;
  nationallyEligible: boolean;
  stateCode: string | null;
  cityName: string | null;
  deadlineAt: string | null;
  deadlinePrecision: string;
  evidence: Record<string, { source_url: string; excerpt: string; page?: number }>;
  officialUrl: string | null;
};

type PendingRow = {
  id: string; title: string; institution: string; applicant_type: string;
  application_route: string; is_course: boolean; nationally_eligible: boolean;
  state_code: string | null; city_name: string | null;
  deadline_at: string | null; deadline_precision: string;
  evidence_json: PendingOpportunity["evidence"]; official_url: string | null;
};

export async function listPendingOpportunities(): Promise<PendingOpportunity[]> {
  return withAdminTransaction(async (client) => {
    const result = await client.query<PendingRow>(
      `select o.id,o.title,o.institution,o.applicant_type,o.application_route,
         o.is_course,o.nationally_eligible,o.state_code,o.city_name,
         o.deadline_at::text as deadline_at,o.deadline_precision,o.evidence_json,
         coalesce(os.official_document_url,os.source_page_url) as official_url
       from opportunities o
       left join lateral (
         select official_document_url,source_page_url from opportunity_sources
         where opportunity_id=o.id and active
         order by is_primary desc,created_at desc limit 1
       ) os on true
       where o.review_status in ('pending_review','needs_information')
       order by o.created_at limit 100`,
    );
    return result.rows.map((row) => ({
      id: row.id, title: row.title, institution: row.institution,
      applicantType: row.applicant_type, applicationRoute: row.application_route,
      isCourse: row.is_course, nationallyEligible: row.nationally_eligible,
      stateCode: row.state_code, cityName: row.city_name,
      deadlineAt: row.deadline_at, deadlinePrecision: row.deadline_precision,
      evidence: row.evidence_json, officialUrl: row.official_url,
    }));
  });
}

export async function decideOpportunity(input: { id: unknown; decision: unknown; reviewer: unknown }) {
  const { id, decision, reviewer } = input;
  if (typeof id !== "string" || !UUID.test(id) ||
      (decision !== "approve" && decision !== "reject") ||
      typeof reviewer !== "string" || !/^[a-zA-Z0-9:_-]{1,128}$/.test(reviewer)) {
    throw new OpportunityReviewError("Decisão inválida");
  }

  await withAdminTransaction(async (client) => {
    const result = await client.query(
      `select o.*, ${openDeadlinePredicate} as deadline_open
       from opportunities o
       where o.id=$1 and o.review_status in ('pending_review','needs_information')
       for update`,
      [id],
    );
    const item = result.rows[0];
    if (!item) throw new OpportunityReviewError("Oportunidade não está pendente de revisão");

    if (decision === "reject") {
      await client.query(
        "update opportunities set review_status='rejected',published_at=null,updated_at=now() where id=$1",
        [id],
      );
      return;
    }
    const officialSource = await client.query<{ active: boolean; verification_status: string; geographic_scope: string[] }>(
      "select active,verification_status,geographic_scope from official_sources where id=$1 for share",
      [item.official_source_id],
    );
    if (!officialSource.rows[0]?.active || officialSource.rows[0].verification_status !== "verified") {
      throw new OpportunityReviewError("Fonte oficial precisa estar verificada e ativa");
    }
    if (item.nationally_eligible && !officialSource.rows[0].geographic_scope.includes("Brasil")) {
      throw new OpportunityReviewError("Abrangência nacional não confirmada pela fonte");
    }
    const sources = await client.query<{ source_count: number }>(
      `select count(*)::int as source_count from opportunity_sources
       where opportunity_id=$1 and official_source_id=$2 and active and source_role in
         ('primary_application_source','official_notice','official_document')`,
      [id, item.official_source_id],
    );
    if (Number(sources.rows[0]?.source_count ?? 0) < 1 || !item.official_source_id) {
      throw new OpportunityReviewError("Fonte oficial obrigatória");
    }
    if (!item.deadline_at && item.deadline_precision !== "continuous_flow") {
      throw new OpportunityReviewError("Prazo obrigatório");
    }
    if (!item.deadline_open) throw new OpportunityReviewError("Oportunidade vencida");
    if (["institution","company","professor","researcher"].includes(item.applicant_type)) {
      throw new OpportunityReviewError("Chamada não elegível para estudantes");
    }
    if (!item.evidence_json || Object.keys(item.evidence_json).length === 0) {
      throw new OpportunityReviewError("Evidência oficial obrigatória");
    }
    await client.query(
      `update opportunities set review_status='approved',opportunity_status='open',
       human_verified_at=now(),human_verified_by=$2,published_at=now(),updated_at=now()
       where id=$1`,
      [id, reviewer],
    );
  });
}
