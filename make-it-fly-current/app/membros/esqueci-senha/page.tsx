import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "@/components/members/password-recovery-forms";
import styles from "@/components/members/members.module.css";
import { safeNextPath } from "@/lib/members/validation";

export const metadata: Metadata = { title: "Esqueci minha senha", referrer: "no-referrer" };

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNextPath((await searchParams).next);
  return <div className={styles.narrow}>
    <header className={styles.authIntro}>
      <p className={styles.eyebrow}>Área de membros</p>
      <h1 className={styles.title}>Esqueci minha senha</h1>
      <p className={styles.lead}>Informe o e-mail da sua conta para receber um link de recuperação.</p>
    </header>
    <div className={`${styles.panel} ${styles.authPanel}`}><ForgotPasswordForm next={next} /></div>
    <p className={styles.switchAuth}><Link href={`/membros/entrar?next=${encodeURIComponent(next)}`}>Voltar para entrar</Link></p>
  </div>;
}
