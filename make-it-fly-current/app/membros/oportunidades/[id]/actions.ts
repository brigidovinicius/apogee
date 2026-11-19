"use server";

import { redirect } from "next/navigation";
import { radarOpportunityDetail } from "@/lib/opportunities/detail-access";
import { opportunityDetailPath } from "@/lib/opportunities/detail-path";

export async function openFreeOpportunity(id: string, catalogueQuery = "") {
  const params = new URLSearchParams(catalogueQuery);
  await radarOpportunityDetail(id, true, params);
  redirect(opportunityDetailPath(id, params));
}
