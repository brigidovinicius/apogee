import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "@/components/members/password-recovery-forms";
import styles from "@/components/members/members.module.css";
import { FORGOT_PASSWORD_PATH, PASSWORD_RESET_INVALID, resetTokenSchema } from "@/lib/members/password-recovery";
import { safeNextPath } from "@/lib/members/validation";

export const metadata: Metadata = { title: "Redefinir senha", referrer: "no-referrer" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ next?: string; token?: string; error?: string }> }) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  const token = resetTokenSchema.safeParse(params.token);
  return <div className={styles.narrow}>
    <header className={styles.authIntro}>
      <p className={styles.eyebrow}>Área de membros</p>
      <h1 className={styles.title}>Redefinir senha</h1>
      <p className={styles.lead}>Escolha sua nova senha. Depois, entre novamente na sua conta.</p>
    </header>
    <div className={`${styles.panel} ${styles.authPanel}`}>
      {!params.error && token.success ? <ResetPasswordForm token={token.data} next={next} /> : <p role="alert">{PASSWORD_RESET_INVALID}</p>}
    </div>
    <p className={styles.switchAuth}><Link href={`${FORGOT_PASSWORD_PATH}?next=${encodeURIComponent(next)}`}>Solicitar novo link</Link></p>
  </div>;
}
