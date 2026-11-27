"use server";

import { revalidatePath } from "next/cache";
import { requireSignedInMember } from "@/lib/members/dal";
import { dismissRadarOpportunity } from "@/lib/opportunities/radar-preference-store";
import { RADAR_FOR_YOU } from "@/lib/opportunities/radar-preferences";

export async function dismissRecommendation(opportunityId: string) {
  const member = await requireSignedInMember(RADAR_FOR_YOU);
  if (!/^radar-[A-Za-z0-9_-]{1,194}$/.test(opportunityId)) return;
  await dismissRadarOpportunity(member.id, opportunityId);
  revalidatePath(RADAR_FOR_YOU);
}
