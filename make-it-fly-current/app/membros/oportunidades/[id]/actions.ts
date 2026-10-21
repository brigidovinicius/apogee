"use server";

import { redirect } from "next/navigation";
import { RADAR_ACCESS_PATH } from "@/lib/billing/config";
import { radarOpportunityDetail } from "@/lib/opportunities/detail-access";
import { opportunityDetailPath } from "@/lib/opportunities/detail-path";

export async function openFreeOpportunity(id: string) {
  const result = await radarOpportunityDetail(id, true);
  const next = opportunityDetailPath(id);
  if (result.status === "purchase") redirect(`${RADAR_ACCESS_PATH}?next=${encodeURIComponent(next)}&from=detail`);
  redirect(next);
}
