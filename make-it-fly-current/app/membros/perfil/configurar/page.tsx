import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { UsernameForm } from "@/components/members/username-form";
import styles from "@/components/members/members.module.css";
import { getCurrentMember } from "@/lib/members/dal";
import { isGeneratedGoogleUsername, safeNextPath } from "@/lib/members/validation";

export const metadata: Metadata = { title: "Concluir cadastro" };

export default async function CompleteProfilePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNextPath((await searchParams).next);
  const member = await getCurrentMember();
  if (!member) redirect(`/membros/entrar?next=${encodeURIComponent("/membros/perfil/configurar")}`);
  if (!isGeneratedGoogleUsername(member.username) && !member.nameNeedsConfirmation) redirect(next);

  return (
    <div className={styles.narrow}>
      <header className={styles.authIntro}>
        <p className={styles.eyebrow}>Área de membros</p>
        <h1 className={styles.title}>Confirme seu nome e usuário</h1>
        <p className={styles.lead}>Esta é a última etapa do cadastro com Google. Seu nome de usuário aparecerá no fórum e no perfil</p>
      </header>
      <div className={`${styles.panel} ${styles.authPanel}`}>
        <UsernameForm next={next} name={member.nameNeedsConfirmation ? "" : member.name} username={isGeneratedGoogleUsername(member.username) ? "" : member.username} />
      </div>
    </div>
  );
}
