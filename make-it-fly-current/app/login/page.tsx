import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/members/validation";

/** Entrada pública e canônica para a autenticação de membros. */
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  redirect(`/membros/entrar?next=${encodeURIComponent(next)}`);
}
