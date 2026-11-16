import "server-only";
import { communityAccess } from "@/lib/billing/community-store";
import type { CurrentMember } from "@/lib/members/dal";

export async function toolboxAccess(member: CurrentMember) {
  // Administrative preview is explicit; a full Radar/legacy grant is never used here.
  if (member.role === "admin") return { allowed: true, source: "admin" as const, paidUntil: null };
  const annual = await communityAccess(member.id, process.env.STRIPE_MODE !== "test");
  return { allowed: annual.active, source: annual.active ? "annual" as const : null, paidUntil: annual.paidUntil };
}
