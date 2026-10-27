import Link from "next/link";
import type { Metadata } from "next";
import styles from "@/components/members/members.module.css";
import { InvitationAcceptance } from "@/components/members/invitation-acceptance";
import { getCurrentMember } from "@/lib/members/dal";
import { previewInvitation, InvitationError } from "@/lib/members/invitations";
import { nameSchema } from "@/lib/members/validation";

export const metadata: Metadata = { title: "Convite para a Apogee", referrer: "no-referrer", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function InvitationPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const token = (await searchParams).token ?? "";
  let invite;
  try { invite = await previewInvitation(token); }
  catch (error) {
    if (!(error instanceof InvitationError)) throw error;
    return <div className={styles.narrow}><h1 className={styles.title}>Convite indisponível</h1><p>O link é inválido ou foi substituído. Peça um novo convite à administração</p></div>;
  }
  const member = await getCurrentMember();
  const next = `/membros/convite?token=${encodeURIComponent(token)}`;
  return <div className={styles.narrow}>
    <header className={styles.authIntro}><p className={styles.eyebrow}>Apogee</p><h1 className={styles.title}>Seu convite de {invite.role === "admin" ? "administrador" : "membro"}</h1>
      <p className={styles.lead}>Entre com o e-mail destinatário e confirme seu nome para aceitar. Verificar o e-mail confirma o controle dessa caixa</p></header>
    <div className={`${styles.panel} ${styles.authPanel}`}>
      {invite.status === "revoked" || invite.status === "expired" ? <p>Este convite foi {invite.status === "revoked" ? "revogado" : "expirado"}. Peça um novo convite</p> :
        !member ? <><p>Já tem uma conta? Entre com suas credenciais habituais</p>
          <Link href={`/membros/entrar?next=${encodeURIComponent(next)}`}>Entrar</Link>{" · "}
          <Link href={`/membros/cadastro?next=${encodeURIComponent(next)}`}>Criar conta</Link></> :
          <InvitationAcceptance token={token} initialName={nameSchema.safeParse(member.name).success && !member.nameNeedsConfirmation ? member.name : ""} />}
    </div>
  </div>;
}
