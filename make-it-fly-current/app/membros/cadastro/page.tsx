import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/members/validation";

/** Cadastro é conduzido pelo fluxo oficial do Stack Auth Cloud em /login. */
export default async function LegacySignUpPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  redirect(`/login?next=${encodeURIComponent(next)}`);
}
