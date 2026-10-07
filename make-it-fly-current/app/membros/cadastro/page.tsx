import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SignUpForm } from "@/components/members/auth-forms";
import styles from "@/components/members/members.module.css";
import { getCurrentMember } from "@/lib/members/dal";
import { googleOAuthErrorMessage } from "@/lib/members/social-auth";
import { safeNextPath } from "@/lib/members/validation";

export const metadata: Metadata = { title: "Criar conta" };

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  if (await getCurrentMember()) redirect("/membros");

  return (
    <div className={styles.narrow}>
      <header className={styles.authIntro}>
        <p className={styles.eyebrow}>Área de membros</p>
        <h1 className={styles.title}>Criar conta</h1>
        <p className={styles.lead}>Entre para a comunidade, participe do fórum e acompanhe o Radar de oportunidades.</p>
      </header>
      <div className={`${styles.panel} ${styles.authPanel}`}>
        <SignUpForm next={next} googleError={googleOAuthErrorMessage(params.error)} />
      </div>
      <p className={styles.switchAuth}>
        Já tem conta? <Link href={`/membros/entrar?next=${encodeURIComponent(next)}`}>Entrar</Link>
      </p>
    </div>
  );
}
