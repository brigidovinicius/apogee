import Link from "next/link";
import { redirect } from "next/navigation";
import { MemberWorkspace } from "@/components/members/member-workspace";
import { requireSignedInMember } from "@/lib/members/dal";
import { hasVerifiedMemberEmail } from "@/lib/members/email-verification";
import { emailVerificationDestination } from "@/lib/members/validation";
import { GOOGLE_CALENDAR_ANCHOR } from "@/lib/opportunities/google-calendar-navigation";
import { sendMemberVerification } from "./actions";
import styles from "./protection.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Confirmação de e-mail", robots: { index: false, follow: false } };

export default async function EmailVerificationPage({ searchParams }: {
  searchParams: Promise<{ resultado?: string; next?: string }>;
}) {
  const query = await searchParams;
  const next = emailVerificationDestination(query.next);
  // Links do cadastro protegido anterior continuam apontando para a área pedida.
  if (!next.endsWith(GOOGLE_CALENDAR_ANCHOR)) redirect(next);
  const member = await requireSignedInMember("/membros/protecao?next=" + encodeURIComponent(next));
  if (await hasVerifiedMemberEmail(member.id)) redirect(next);

  return <MemberWorkspace member={member} current="protecao"><div className={styles.page}>
    <h1>Confirme seu e-mail</h1>
    <p>Para conectar o Google Agenda, solicite o link de confirmação e abra-o no e-mail cadastrado.</p>
    {query.resultado === "enviado" && <p role="status">Confira a caixa de entrada e a pasta de spam.</p>}
    {query.resultado === "erro" && <p role="alert">Não foi possível enviar a confirmação. Tente novamente em instantes.</p>}
    <form action={sendMemberVerification}>
      <input type="hidden" name="next" value={next} />
      <button data-ap-button="primary" type="submit">Enviar confirmação de e-mail</button>
    </form>
    <p><Link href={next}>Voltar</Link> · <Link href="/membros/suporte">Preciso de ajuda</Link></p>
  </div></MemberWorkspace>;
}
