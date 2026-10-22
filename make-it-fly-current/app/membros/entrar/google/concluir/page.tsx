import type { Metadata } from "next";
import Link from "next/link";
import { GoogleLoginComplete } from "@/components/members/google-login-complete";
import styles from "@/components/members/members.module.css";
import { getCurrentMember } from "@/lib/members/dal";
import { googleLoginDestination } from "@/lib/members/google-login-flow";
import { googleOAuthErrorMessage } from "@/lib/members/social-auth";

export const metadata: Metadata = { title: "Entrada com Google", robots: { index: false, follow: false } };

export default async function GoogleCompletionPage({ searchParams }: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const next = googleLoginDestination(params.next ?? "/membros");
  const authenticated = Boolean(await getCurrentMember());
  return <div className={styles.narrow}>
    <h1>{authenticated ? "Login concluído" : "Entrada com Google"}</h1>
    <p>{authenticated ? "Continue na aba da Apogee em que você iniciou a entrada. Esta janela pode ser fechada."
      : googleOAuthErrorMessage(params.error) ?? "A entrada não foi concluída. Volte à aba da Apogee para tentar novamente."}</p>
    <GoogleLoginComplete authenticated={authenticated} />
    <p><Link href={authenticated ? next : `/membros/entrar?next=${encodeURIComponent(next)}`}>
      {authenticated ? "Continuar nesta janela" : "Voltar para a entrada"}
    </Link></p>
  </div>;
}
