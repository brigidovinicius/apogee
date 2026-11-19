import { calendarEntries } from "./discovery";
import "server-only";
import { notFound } from "next/navigation";
import { requireSignedInMember } from "@/lib/members/dal";
import { radarAccess } from "@/lib/billing/store";
import { listRadarOpportunities } from "@/lib/opportunities/radar-client";
import { isOpportunityOpen } from "./types";
import { freeRadarState, isFreeRadarEvent, claimFreeRadarEvent, claimFreeRadarOpportunity } from "./detail-store";
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
  if (access.active) return { member, title: opportunity.title, opportunity, status: "unlimited" as const, quota: null, isEvent: false };
  let quota = await freeRadarState(member.id, catalogue);
  const event = isFreeRadarEvent(opportunity);
  if (claim && !quota.readableIds.includes(id)) {
    if (event && quota.remaining > 0) await claimFreeRadarEvent(member.id,id,quota.previousEvent);
    else if (!event && quota.selected === null) await claimFreeRadarOpportunity(member.id,id);
    quota = await freeRadarState(member.id,catalogue);
  }
  const readable = quota.readableIds.includes(id);
  const status = readable ? "free" : (event ? quota.remaining > 0 : quota.selected === null) ? "available" : "purchase";
  return { member, title: opportunity.title, opportunity: readable ? opportunity : null, status, quota, isEvent: event };
}
