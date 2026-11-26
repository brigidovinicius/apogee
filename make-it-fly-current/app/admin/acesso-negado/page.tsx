import Link from "next/link";
import { redirect } from "next/navigation";
import { adminStyles as styles } from "@/components/admin/admin-ui";
import { requireMember } from "@/lib/members/dal";

export const dynamic = "force-dynamic";

export default async function AdminAccessDeniedPage() {
  const member = await requireMember("/admin/acesso-negado");
  if (member.role === "admin") redirect("/admin");

  return (
    <section className={styles.accessDenied} role="alert">
      <div className={styles.stateCard}>
        <h1>Esta área exige papel administrativo.</h1>
        <p>Sua sessão de membro continua ativa.</p>
        <div className={styles.stateActions}>
          <Link className={styles.button} href="/membros">Voltar para membros</Link>
          <Link className={styles.secondaryButton} href="/">Ir ao início</Link>
        </div>
      </div>
    </section>
  );
}
