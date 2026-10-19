import "server-only";
import { requireAdmin } from "@/lib/admin/access";
import { requireMember } from "@/lib/members/dal";
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
  await requireMember("/membros/oportunidades");
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
  await requireMember("/membros/oportunidades");
  return listPublicOpportunityPage(params);
}
