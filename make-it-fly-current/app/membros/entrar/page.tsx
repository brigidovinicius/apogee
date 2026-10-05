import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/members/validation";

/** Rota legada: /login é a entrada canônica do Stack Auth Cloud. */
export default async function LegacySignInPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  redirect(`/login?next=${encodeURIComponent(next)}`);
}
