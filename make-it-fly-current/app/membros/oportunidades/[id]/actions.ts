"use server";

import { redirect } from "next/navigation";
import { radarOpportunityDetail } from "@/lib/opportunities/detail-access";
import { opportunityDetailPath } from "@/lib/opportunities/detail-path";

export async function openFreeOpportunity(id: string) {
  await radarOpportunityDetail(id, true);
  const next = opportunityDetailPath(id);
  redirect(next);
}
