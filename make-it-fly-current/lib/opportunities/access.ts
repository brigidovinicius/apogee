import "server-only";
import { requireAdmin } from "@/lib/admin/access";
import { requireMember } from "@/lib/members/dal";
import { requireRadarAccess } from "@/lib/billing/access";
import { listRadarOpportunities } from "@/lib/opportunities/radar-client";
import { buildOpportunityPage } from "./catalogue";
import { filterOpportunities } from "./types";
import { orderOpportunityFeed } from "./member-feed";
import { EMPTY_OPPORTUNITY_FILTERS, getOpportunityFilterOptions, sanitizeOpportunityFilters, type OpportunityFilters, sortByDeadline, type StudentOpportunity } from "@/lib/opportunities/types";
export async function listPublicOpportunities(filters: OpportunityFilters = EMPTY_OPPORTUNITY_FILTERS): Promise<StudentOpportunity[]> {
  const opportunities = await listRadarOpportunities();
  const normalizedFilters = sanitizeOpportunityFilters(filters, getOpportunityFilterOptions(opportunities));
  return filterOpportunities(orderOpportunityFeed(opportunities, normalizedFilters), normalizedFilters, undefined, true);
}
export async function listMemberOpportunities(filters: OpportunityFilters = EMPTY_OPPORTUNITY_FILTERS): Promise<StudentOpportunity[]> {
  const member = await requireMember("/membros/oportunidades");
  await requireRadarAccess(member.id);
  return listPublicOpportunities(filters);
}
export async function listAdminOpportunityCatalogue(): Promise<StudentOpportunity[]> {
  await requireAdmin("/admin/radar");
  return sortByDeadline(await listRadarOpportunities());
}

export async function listPublicOpportunityPage(params: URLSearchParams) {
  return buildOpportunityPage(await listRadarOpportunities(), params);
}
export async function listMemberOpportunityPage(params: URLSearchParams) {
  const member = await requireMember("/membros/oportunidades");
  await requireRadarAccess(member.id);
  return listPublicOpportunityPage(params);
}
