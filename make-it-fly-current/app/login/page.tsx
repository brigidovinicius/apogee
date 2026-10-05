import { redirect } from "next/navigation";
import { SignIn } from "@hexclave/next";
import { safeNextPath } from "@/lib/members/validation";
import { getCurrentMember } from "@/lib/members/dal";
import styles from "@/components/members/members.module.css";

/** Entrada pública e canônica para a autenticação de membros. */
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  if (await getCurrentMember()) redirect(next);

  return (
    <div className={styles.narrow}>
      <p className={styles.eyebrow}>Área de membros</p>
      <h1 className={styles.title}>Entrar</h1>
      <p className={styles.lead}>Acesse o fórum da comunidade Apogee com sua conta Google.</p>
      <div className={styles.panel} style={{ marginTop: "2rem" }}>
        <SignIn />
      </div>
    </div>
  );
}
