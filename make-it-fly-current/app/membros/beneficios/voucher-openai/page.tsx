import Link from "next/link";
import { notFound } from "next/navigation";
import { MemberWorkspace } from "@/components/members/member-workspace";
import { VoucherForm } from "@/components/workshop-voucher/form";
import styles from "@/components/benefits/benefits.module.css";
import shared from "@/components/members/members.module.css";
import { getCurrentMember, requireSignedInMember } from "@/lib/members/dal";
import { linkVoucherAction, verifyVoucherEmailAction } from "@/lib/workshop-voucher/actions";
import { VOUCHER_OPEN_PATH, VOUCHER_PATH } from "@/lib/workshop-voucher/input";
import { voucherConfigured } from "@/lib/workshop-voucher/secrets";
import { memberVoucherState } from "@/lib/workshop-voucher/store";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Voucher OpenAI",
  referrer: "same-origin" as const,
  robots: { index: false, follow: false },
};

export default async function WorkshopVoucherPage({ searchParams }: { searchParams: Promise<{ resultado?: string }> }) {
  if (!voucherConfigured()) notFound();
  const signedIn = await getCurrentMember();
  const member = signedIn ? await requireSignedInMember(VOUCHER_PATH) : null;
  const state = member ? await memberVoucherState(member.id).catch(() => null) : null;
  const next = encodeURIComponent(VOUCHER_PATH);
  const { resultado } = await searchParams;

  return <MemberWorkspace current="beneficios" member={member}>
    <div data-ap-benefits="detail" className={`${shared.container} ${styles.root}`}>
      <Link href="/membros/beneficios" className={styles.back}>← Benefícios</Link>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Codex Community Workshop · Florianópolis</p>
        <h1>Voucher OpenAI</h1>
      </header>
      <section data-ap-card="" className={`${styles.card} ${styles.detail}`}>
        {resultado === "indisponivel" && <p role="alert">Não foi possível abrir o voucher. Tente novamente ou fale com a equipe.</p>}
        {!member ? <>
          <h2>Acesse sua reserva pela Apogee</h2>
          <p>Os vouchers são reservados por ordem de check-in no workshop. Entre com a sua conta ou crie uma conta gratuita para consultar a sua reserva.</p>
          <p><Link href={`/membros/entrar?next=${next}`} data-ap-button="primary">Entrar na minha conta</Link>{" "}
            <Link href={`/membros/cadastro?next=${next}`} data-ap-button="secondary">Criar conta gratuita</Link></p>
        </> : !state ? <p role="alert">A consulta está temporariamente indisponível. Tente novamente em instantes.</p> :
          !state.released ? <p>As reservas ainda estão sendo preparadas. A equipe avisará os contemplados pelo e-mail do ingresso.</p> :
          state.canOpen ? <>
            <h2>Seu voucher está reservado</h2>
            <p>Abra o seu link individual para seguir as instruções da OpenAI. Você pode voltar a esta página para abrir o mesmo link.</p>
            <form action={VOUCHER_OPEN_PATH} method="post">
              <button type="submit" data-ap-button="primary">{state.opened ? "Reabrir meu voucher na OpenAI" : "Abrir meu voucher na OpenAI"}</button>
            </form>
          </> : <>
            <h2>Consulte sua reserva</h2>
            <p>{state.verified ? "Ainda não há um voucher disponível para o e-mail confirmado desta conta." :
              "Confirme o e-mail desta conta se ele for o mesmo do ingresso no Luma."}</p>
            {!state.verified && <VoucherForm action={verifyVoucherEmailAction} label="Confirmar o e-mail da minha conta" />}
            <h3>Recebeu um código no e-mail do workshop?</h3>
            <p>Use o código individual para vincular a reserva à conta em que você entrou. Ele também funciona se você usa outro e-mail na Apogee.</p>
            <VoucherForm action={linkVoucherAction} label="Vincular meu voucher">
              <label>Código recebido por e-mail <input name="codigo" required maxLength={40} autoComplete="off" spellCheck={false} /></label>
            </VoucherForm>
          </>}
      </section>
      <p className={styles.support}><Link href="/membros/suporte">Preciso de ajuda</Link></p>
    </div>
  </MemberWorkspace>;
}
