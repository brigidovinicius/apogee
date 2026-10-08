import "server-only";
import { STUDENT_OPPORTUNITIES } from "@/content/opportunities";
import { requireAdmin } from "@/lib/admin/access";
import { requireMember } from "@/lib/members/dal";
import { mergeOpportunities, listRadarOpportunities } from "@/lib/opportunities/radar-client";
import {
  isOpportunityOpen,
  sortByDeadline,
  type OpportunityPreview,
  type StudentOpportunity,
} from "@/lib/opportunities/types";

export const PUBLIC_OPPORTUNITY_SAMPLE_SIZE = 3;

async function listAllOpportunities(): Promise<StudentOpportunity[]> {
  const radarOpportunities = await listRadarOpportunities();
  return sortByDeadline(mergeOpportunities(STUDENT_OPPORTUNITIES, radarOpportunities));
}

function toPublicPreview(opportunity: StudentOpportunity): OpportunityPreview {
  return {
    id: opportunity.id,
    title: opportunity.title,
    organization: opportunity.organization,
    kind: opportunity.kind,
    level: opportunity.level,
  };
}

/**
 * A amostra aberta passa por esta DTO no servidor. Nenhum campo editorial,
 * prazo, URL ou requisito chega ao HTML/RSC público.
 */
export async function listPublicOpportunityPreviews(): Promise<OpportunityPreview[]> {
  return (await listAllOpportunities())
    .filter((opportunity) => isOpportunityOpen(opportunity))
    .slice(0, PUBLIC_OPPORTUNITY_SAMPLE_SIZE)
    .map(toPublicPreview);
}

/** A fonte completa só pode ser consultada depois de uma sessão válida. */
export async function listMemberOpportunities(): Promise<StudentOpportunity[]> {
  await requireMember("/membros/oportunidades");
  return listAllOpportunities();
}

/** A administração atual pode auditar o catálogo, mas ainda não há fila de revisão. */
export async function listAdminOpportunityCatalogue(): Promise<StudentOpportunity[]> {
  await requireAdmin("/admin/curadoria");
  return listAllOpportunities();
}
