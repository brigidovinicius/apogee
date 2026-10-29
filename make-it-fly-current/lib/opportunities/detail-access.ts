import { calendarEntries } from "./discovery";
import "server-only";
import { notFound } from "next/navigation";
import { requireMember } from "@/lib/members/dal";
import { radarAccess } from "@/lib/billing/store";
import { listRadarOpportunities } from "@/lib/opportunities/radar-client";
import { isOpportunityOpen } from "./types";
import { freeRadarOpportunity, claimFreeRadarOpportunity } from "./detail-store";
import { opportunityDetailPath } from "./detail-path";

export async function radarOpportunityDetail(id: string, claim = false) {
  const member = await requireMember(opportunityDetailPath(id));
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(id)) notFound();
  const opportunity = (await listRadarOpportunities(true)).find(item => item.id === id && (isOpportunityOpen(item) || calendarEntries([item]).length > 0));
  if (!opportunity) notFound();
  // Reading existing rights does not need a working checkout or its secret key.
  // Missing billing configuration never makes all details public.
  const access = await radarAccess(member.id, process.env.STRIPE_MODE !== "test");
  if (access.active) return { member, title: opportunity.title, opportunity, status: "unlimited" as const };
  let selected = await freeRadarOpportunity(member.id);
  if (claim && selected === null) {
    if (await claimFreeRadarOpportunity(member.id, id)) selected = id;
    else selected = await freeRadarOpportunity(member.id);
  }
  const status = selected === id ? "free" : selected === null ? "available" : "purchase";
  return { member, title: opportunity.title, opportunity: status === "free" ? opportunity : null, status };
}
