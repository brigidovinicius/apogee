import { localFunctionalReview } from "@/lib/offer-preview";
import Link from "next/link";
import { requireSignedInMember } from "@/lib/members/dal";
import { adultAccess } from "@/lib/members/protection";
import { MemberBar } from "@/components/members/member-bar";
import { communityBillingEnabled, COMMUNITY_ACCESS_PATH } from "@/lib/billing/community-config";
import { communityMembership } from "@/lib/billing/community-store";
import { radarAccess } from "@/lib/billing/store";
import { radarDetailReturnPath } from "@/lib/opportunities/detail-path";
import styles from "@/components/members/members.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sua assinatura anual | Apogee", robots: { index:false,follow:false } };
const date = (iso:string) => new Intl.DateTimeFormat("pt-BR", {dateStyle:"long",timeZone:"America/Sao_Paulo"}).format(new Date(iso));
export default async function MembershipPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const reviewing = localFunctionalReview();
  const member = await requireSignedInMember(COMMUNITY_ACCESS_PATH);
  const params = await searchParams, next = radarDetailReturnPath(params.next);
  const livemode = process.env.STRIPE_MODE !== "test";
  const membership = await communityMembership(member.id,livemode);
  const radar = await radarAccess(member.id,livemode);
  const legacy = radar.active && radar.source !== "community";
  const verified = await adultAccess(member.id);
  const pending = membership.subscription && !["canceled","incomplete_expired"].includes(membership.subscription.status);
  return <div className={styles.container}>
    <MemberBar member={member} current="home" />
    <header className={styles.pageHead}><div><p className={styles.eyebrow}>Comunidade Apogee</p><h1 className={styles.title}>Sua assinatura anual.</h1><p className={styles.lead}>Radar completo, aprendizado prático, conexões e benefícios.</p></div></header>
    {reviewing ? <p role="note">Validação local com contas e pagamentos sintéticos. Nenhuma cobrança ou alteração na Stripe é realizada aqui.</p> : null}
    {params.billing_error ? <p role="alert">{params.billing_error === "409" ? "Já existe uma assinatura ou um pagamento em andamento. Confira o estado abaixo antes de tentar novamente." : params.billing_error === "403" ? "Conclua a verificação da sua conta antes de contratar." : params.billing_error === "429" ? "Muitas tentativas. Aguarde alguns minutos antes de tentar novamente." : "Não foi possível concluir a operação. Confira o estado abaixo antes de tentar novamente."}</p> : null}
    {params.payment === "received" ? <p role="status">{membership.active ? "Pagamento confirmado. Sua assinatura anual está ativa." : "Recebemos seu retorno do checkout. Confira abaixo o estado do pagamento; atualize esta página em instantes se a confirmação ainda estiver pendente."}</p> : null}
    {params.payment === "cancelled" ? <p role="status">Você voltou do checkout. Confira abaixo a situação atual da assinatura.</p> : null}
    {params.cancellation === "requested" ? <p role="status">{membership.subscription?.cancelAtPeriodEnd ? "Renovação anual cancelada. O período pago está preservado." : "Solicitação de cancelamento da renovação enviada. Atualize esta página em instantes para conferir a confirmação."}</p> : null}
    {legacy ? <p>Seu acesso antigo ao Radar está preservado e independe desta assinatura.</p> : null}
    <section className={styles.panel} aria-labelledby="annual-plan-title"><h2 id="annual-plan-title">Comunidade anual · R$ 1.438,80 por ano</h2>
      <p>Equivalente a R$ 119,90 por mês. Cobrança integral anual, com renovação automática pelo mesmo período. Não há contratação mensal.</p>
      <p>Inclui Radar completo, trilhas de IA aplicada, conexões e atividades da comunidade e benefícios conforme o programa e a elegibilidade. <Link href="/comunidade">Confira as entregas do plano</Link>.</p>
      {membership.active && membership.paidUntil ? <>
        <p role="status"><strong>Assinatura ativa. Acesso pago até {date(membership.paidUntil)}.</strong></p>
        <p>{membership.subscription?.cancelAtPeriodEnd ? "A renovação está cancelada. Seu acesso continua até o fim do período pago." : "A renovação automática está habilitada. Você pode cancelá-la antes da próxima cobrança."}</p>
        <Link className={styles.primary} href={next}>Continuar no Radar</Link>
      </> : membership.paymentStatus === "refunded" ? <p role="status">A fatura anual foi reembolsada integralmente. O acesso incluído nessa fatura foi encerrado. Seus acessos antigos válidos ao Radar continuam preservados.</p> : ["disputed","fraud"].includes(membership.paymentStatus ?? "") ? <p role="status">O pagamento está em análise. O acesso anual depende da conclusão dessa análise. Seus acessos antigos válidos ao Radar continuam preservados.</p> : membership.subscription?.status === "past_due" || membership.subscription?.status === "unpaid" ? <p role="status">O pagamento anual está pendente. Confira a fatura e a forma de pagamento no portal antes de tentar novamente. Uma renovação não paga não estende o acesso.</p> : pending ? <p role="status">Há uma assinatura ou pagamento em andamento. Se uma renovação falhar, o acesso continua somente até o fim do último período pago. Confira o pagamento antes de iniciar outra assinatura.</p> : reviewing ? <p>A contratação anual está implementada e testada com pagamentos sintéticos. A conexão ao checkout Stripe será validada separadamente antes da publicação.</p> : !communityBillingEnabled() ? <p>A contratação anual está em validação. A entrada gratuita continua disponível.</p> : !verified ? <p>Para contratar, <Link href="/membros/protecao">conclua a verificação da sua conta</Link>.</p> : <form action={`/api/comunidade/assinatura/checkout?next=${encodeURIComponent(next)}`} method="post">
        <p>Ao continuar, você será encaminhado ao checkout seguro para revisar o total e confirmar a assinatura anual. O retorno do checkout, sozinho, não libera acesso.</p>
        <button className={styles.primary} type="submit">Continuar para assinatura anual</button>
      </form>}
    </section>
    {membership.subscription && !reviewing && (process.env.STRIPE_COMMUNITY_PORTAL_CONFIGURATION_ID || (pending && !membership.subscription.cancelAtPeriodEnd)) ? <section className={styles.panel}><h2>Gerencie sua assinatura</h2>
      {!reviewing && process.env.STRIPE_COMMUNITY_PORTAL_CONFIGURATION_ID ? <form action="/api/comunidade/assinatura/portal" method="post"><button className={styles.primary} type="submit">Ver faturas e forma de pagamento</button></form> : null}
      {!reviewing && pending && !membership.subscription.cancelAtPeriodEnd ? <form action="/api/comunidade/assinatura/cancelar" method="post"><p>Cancele a renovação automática. O acesso do período já pago será mantido, sem nova cobrança anual.</p><button className={styles.primary} type="submit">Cancelar renovação anual</button></form> : null}
    </section> : null}
    <p>As 10 consultas gratuitas são de eventos distintos por conta, sem renovação automática. Reabrir um evento já liberado não gasta outra consulta. <Link href="/membros/oportunidades">Voltar ao Radar</Link>.</p>
  </div>;
}
