import "server-only";
import { requireAdmin } from "@/lib/admin/access";
import { requireMember } from "@/lib/members/dal";
import { listRadarOpportunities } from "@/lib/opportunities/radar-client";
import { orderMemberFeed } from "./member-feed";
import { EMPTY_OPPORTUNITY_FILTERS, getOpportunityFilterOptions, sanitizeOpportunityFilters, type OpportunityFilters, sortByDeadline, type StudentOpportunity } from "@/lib/opportunities/types";
export async function listPublicOpportunities(): Promise<StudentOpportunity[]> {
  return sortByDeadline(await listRadarOpportunities());
}
export async function listMemberOpportunities(filters: OpportunityFilters = EMPTY_OPPORTUNITY_FILTERS): Promise<StudentOpportunity[]> {
  await requireMember("/membros/oportunidades");
  const opportunities = await listPublicOpportunities();
  const normalizedFilters = sanitizeOpportunityFilters(filters, getOpportunityFilterOptions(opportunities));
  return orderMemberFeed(opportunities, normalizedFilters);
}
export async function listAdminOpportunityCatalogue(): Promise<StudentOpportunity[]> {
  await requireAdmin("/admin/radar");
  return listPublicOpportunities();
}
