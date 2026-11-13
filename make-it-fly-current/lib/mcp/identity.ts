import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/members/db";
import { user } from "@/lib/members/schema";
import { nameSchema } from "@/lib/members/validation";

/** Resolve the current account; an OAuth grant never freezes its status. */
export async function getMcpMember(id: string) {
  const [member] = await getDb().select().from(user).where(eq(user.id, id)).limit(1);
  if (!member || member.blocked) return null;
  return {
    id: member.id, username: member.username ?? "",
    nameNeedsConfirmation: member.nameNeedsConfirmation || !nameSchema.safeParse(member.name).success,
  };
}
