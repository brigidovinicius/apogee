import "server-only";
import { redirect } from "next/navigation";
import { getCurrentMember, type CurrentMember } from "@/lib/members/dal";

/**
 * Admin pages repeat this check before reading any operational data. The proxy
 * only avoids unnecessary rendering when there is no session cookie.
 */
export async function requireAdmin(next = "/admin"): Promise<CurrentMember> {
  const member = await getCurrentMember();

  if (!member) {
    redirect(`/membros/entrar?next=${encodeURIComponent(next)}`);
  }

  if (member.role !== "admin") {
    redirect("/admin/acesso-negado");
  }

  return member;
}
