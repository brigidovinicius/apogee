import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SignInForm } from "@/components/members/auth-forms";
import styles from "@/components/members/members.module.css";
import { getCurrentMember } from "@/lib/members/dal";
import { googleOAuthErrorMessage } from "@/lib/members/social-auth";
import { safeNextPath } from "@/lib/members/validation";

export const metadata: Metadata = { title: "Entrar" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  if (await getCurrentMember()) redirect(next);

  return (
    <div className={styles.narrow}>
      <header className={styles.authIntro}>
        <p className={styles.eyebrow}>Área de membros</p>
        <h1 className={styles.title}>Entrar</h1>
        <p className={styles.lead}>Acesse o fórum, seu perfil e o Radar de oportunidades da comunidade Apogee.</p>
      </header>
      <div className={`${styles.panel} ${styles.authPanel}`}>
        <SignInForm next={next} googleError={googleOAuthErrorMessage(params.error)} />
      </div>
      <p className={styles.switchAuth}>
        Ainda não tem conta? <Link href={`/membros/cadastro?next=${encodeURIComponent(next)}`}>Criar conta</Link>
      </p>
    </div>
  );
}
