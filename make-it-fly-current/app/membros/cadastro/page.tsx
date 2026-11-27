import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SignUpForm } from "@/components/members/auth-forms";
import styles from "@/components/members/members.module.css";
import { getCurrentMember } from "@/lib/members/dal";
import { googleOAuthErrorMessage } from "@/lib/members/social-auth";
import { isAnnualPurchasePath } from "@/lib/billing/community-navigation";
import { safeNextPath } from "@/lib/members/validation";

export const metadata: Metadata = { title: "Criar conta" };

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  const annual = isAnnualPurchasePath(next);
  if (await getCurrentMember()) redirect(next);

  return (
    <div className={styles.narrow}>
      <header className={styles.authIntro}>
        <p className={styles.eyebrow}>{annual ? "Comunidade Apogee · Plano anual" : "Comunidade Apogee"}</p>
        <h1 className={styles.title}>{annual ? "Crie sua conta para continuar a assinatura" : "Crie sua conta gratuita"}</h1>
        <p className={styles.lead}>{annual ? "R$ 1.438,80 por ano, com renovação automática. Revise o total antes de pagar." : "Sem cartão. Consulte até 10 oportunidades no Radar e 10 ofertas em Benefícios por mês. Verifique a conta para participar do fórum."}</p>
      </header>
      <div className={`${styles.panel} ${styles.authPanel}`}>
        <SignUpForm next={next} googleError={googleOAuthErrorMessage(params.error)}/>
      </div>
      <p className={styles.switchAuth}>
        Já tem conta? <Link href={`/membros/entrar?next=${encodeURIComponent(next)}`}>Entrar</Link>
      </p>
      <p className={styles.switchAuth}><Link href="/membros/suporte">Preciso de ajuda com meu cadastro</Link></p>
    </div>
  );
}
