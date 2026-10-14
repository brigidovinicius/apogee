import "server-only";
import { requireAdmin } from "@/lib/admin/access";
import { requireMember } from "@/lib/members/dal";
import { listRadarOpportunities } from "@/lib/opportunities/radar-client";
import { sortByDeadline, type StudentOpportunity } from "@/lib/opportunities/types";
export async function listPublicOpportunities(): Promise<StudentOpportunity[]> {
  return sortByDeadline(await listRadarOpportunities());
}
export async function listMemberOpportunities(): Promise<StudentOpportunity[]> {
  await requireMember("/membros/oportunidades");
  return listPublicOpportunities();
}
export async function listAdminOpportunityCatalogue(): Promise<StudentOpportunity[]> {
  await requireAdmin("/admin/radar");
  return listPublicOpportunities();
}
