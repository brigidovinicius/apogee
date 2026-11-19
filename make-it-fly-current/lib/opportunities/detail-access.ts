import { calendarEntries } from "./discovery";
import "server-only";
import { notFound } from "next/navigation";
import { requireSignedInMember } from "@/lib/members/dal";
import { radarAccess } from "@/lib/billing/store";
import { listRadarOpportunities } from "@/lib/opportunities/radar-client";
import { isOpportunityOpen } from "./types";
import { radarMonthlyState } from "./detail-store";
import { claimMonthlyDetail } from "@/lib/members/monthly-detail";
import { opportunityDetailPath } from "./detail-path";

export async function radarOpportunityDetail(id: string, claim = false, params?: URLSearchParams) {
  const member = await requireSignedInMember(opportunityDetailPath(id, params));
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(id)) notFound();
  const catalogue = await listRadarOpportunities(true);
  const opportunity = catalogue.find(item => item.id === id && (isOpportunityOpen(item) || calendarEntries([item]).length > 0));
  if (!opportunity) notFound();
  // Reading existing rights does not need a working checkout or its secret key.
  // Missing billing configuration never makes all details public.
  const access = await radarAccess(member.id, process.env.STRIPE_MODE !== "test");
  if (access.active) return { member, title: opportunity.title, opportunity, status: "unlimited" as const, quota: null };
  let quota = await radarMonthlyState(member.id);
  if (claim && !quota.readableIds.includes(id) && quota.remaining > 0) {
    await claimMonthlyDetail(member.id, "radar", id);
    quota = await radarMonthlyState(member.id);
  }
  const readable = quota.readableIds.includes(id);
  const status = readable ? "free" : quota.remaining > 0 ? "available" : "purchase";
  return { member, title: opportunity.title, opportunity: readable ? opportunity : null, status, quota };
}
