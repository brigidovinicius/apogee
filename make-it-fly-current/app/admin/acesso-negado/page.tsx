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
        <p className={styles.eyebrow}>Acesso restrito</p>
        <h1>Esta área exige papel administrativo.</h1>
        <p>Sua sessão continua válida como membro, mas ela não autoriza leitura de dados operacionais.</p>
        <div className={styles.stateActions}>
          <Link className={styles.button} href="/membros">Voltar para membros</Link>
          <Link className={styles.secondaryButton} href="/">Ir ao início</Link>
        </div>
      </div>
    </section>
  );
}
