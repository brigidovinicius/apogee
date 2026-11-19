"use server";

import { notFound, redirect } from "next/navigation";
import { benefitNavigation, type BenefitSearchParams } from "@/lib/benefits/navigation";
import { previewBenefitTitle } from "@/lib/benefits/preview";
import { deliverableMember } from "@/lib/deliverables/store";
import { claimMonthlyDetail } from "@/lib/members/monthly-detail";

export async function openFreeBenefit(id: string, filters: BenefitSearchParams) {
  if (!await previewBenefitTitle(id)) notFound();
  const { detailSearch } = benefitNavigation(filters, "catalogue");
  const path = `/membros/beneficios/${encodeURIComponent(id)}${detailSearch}`;
  const { member, access } = await deliverableMember(path);
  if (!access.allowed) await claimMonthlyDetail(member.id, "beneficios", id);
  redirect(path);
}
