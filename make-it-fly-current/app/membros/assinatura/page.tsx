import { localFunctionalReview } from "@/lib/offer-preview";
import Link from "next/link";
import { COMMUNITY_BENEFITS_TERMS } from "@/content/community-offer";
import { ArrowRight, BookOpen, Compass, LockKeyhole, MessageCircle, ShieldCheck, Wrench } from "lucide-react";
import { requireSignedInMember } from "@/lib/members/dal";
import { adultAccess } from "@/lib/members/protection";
import { MemberWorkspace } from "@/components/members/member-workspace";
import { communityBillingEnabled, COMMUNITY_ACCESS_PATH } from "@/lib/billing/community-config";
import { communityMembership } from "@/lib/billing/community-store";
import { radarAccess } from "@/lib/billing/store";
import { annualResourceLabel, annualSummaryPath, communityReturnPath } from "@/lib/billing/community-navigation";
import styles from "@/components/members/members.module.css";
import annual from "@/components/members/subscription.module.css";
import { AnnualPaymentConfirmation } from "@/components/members/annual-payment-confirmation";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sua assinatura anual | Apogee", robots: { index:false,follow:false } };
const date = (iso:string) => new Intl.DateTimeFormat("pt-BR", {dateStyle:"long",timeZone:"America/Sao_Paulo"}).format(new Date(iso));
export default async function MembershipPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const reviewing = localFunctionalReview();
  const params = await searchParams, next = communityReturnPath(params.next);
  const member = await requireSignedInMember(`${COMMUNITY_ACCESS_PATH}?next=${encodeURIComponent(next)}`);
  const livemode = process.env.STRIPE_MODE !== "test";
  const membership = await communityMembership(member.id,livemode);
  const radar = await radarAccess(member.id,livemode);
  const legacy = radar.active && radar.source !== "community";
  const verified = await adultAccess(member.id);
  const continueLabel = annualResourceLabel(next);
  const verificationHref = `/membros/protecao?next=${encodeURIComponent(annualSummaryPath(next))}`;
  const pending = membership.subscription && !["canceled","incomplete_expired"].includes(membership.subscription.status);
  const awaitingPayment = params.payment === "received" && !membership.active &&
    !["refunded", "disputed", "fraud"].includes(membership.paymentStatus ?? "") &&
    !["canceled", "incomplete_expired", "past_due", "unpaid"].includes(membership.subscription?.status ?? "");
  return <MemberWorkspace member={member} current="assinatura"><div className={`${styles.container} ${annual.annualPage}`}>

    <header className={annual.annualHero}><p className={styles.eyebrow}>Comunidade Apogee · Plano anual</p><h1 className={styles.title}>{membership.active ? "Minha assinatura" : awaitingPayment || pending ? "Situação da assinatura" : "Resumo da assinatura"}</h1></header>
    {reviewing ? <p role="note">Validação local com contas e pagamentos sintéticos. Nenhuma cobrança ou alteração na Stripe é realizada aqui.</p> : null}
    {params.billing_error ? <p role="alert">{params.billing_error === "409" ? "Já existe uma assinatura ou um pagamento em andamento. Confira o estado abaixo antes de tentar novamente." : params.billing_error === "403" ? "Conclua a verificação da sua conta antes de contratar." : params.billing_error === "429" ? "Muitas tentativas. Aguarde alguns minutos antes de tentar novamente." : "Não foi possível concluir a operação. Confira o estado abaixo antes de tentar novamente."}</p> : null}
    {params.payment === "received" && membership.active ? <p role="status" data-annual-stage="confirmed_return" className={annual.annualStatus}>Pagamento confirmado. Sua assinatura anual está ativa. Vamos começar?</p> : null}
    {params.payment === "cancelled" ? <p role="status">Você voltou do checkout. Confira abaixo a situação atual da assinatura.</p> : null}
    {params.cancellation === "requested" ? <p role="status">{membership.subscription?.cancelAtPeriodEnd ? "Renovação anual cancelada. O período pago está preservado." : "Solicitação de cancelamento da renovação enviada. Atualize esta página em instantes para conferir a confirmação."}</p> : null}
    <div className={annual.annualLayout}>
    <section className={annual.annualCard} aria-labelledby="annual-plan-title"><h2 id="annual-plan-title">Comunidade Apogee · Anual</h2>
      <p className={annual.annualPrice}><strong>R$ 1.438,80</strong><span>por ano</span></p>
      <p className={annual.annualEquivalent}>Equivalente a R$ 119,90 por mês.</p>
      <p className={annual.annualTerms}>Cobrança integral anual, com renovação automática a cada 12 meses. Não há contratação mensal. Você pode cancelar a renovação antes da próxima cobrança e manter o acesso até o fim do período pago.</p>
      {membership.active && membership.paidUntil ? <>
        <p role="status"><strong>Assinatura ativa. Acesso pago até {date(membership.paidUntil)}.</strong></p>
        <p>{membership.subscription?.cancelAtPeriodEnd ? "A renovação está cancelada. Seu acesso continua até o fim do período pago." : "A renovação automática está habilitada. Você pode cancelá-la antes da próxima cobrança."}</p>
        <Link className={annual.annualCta} href={next}>{continueLabel}<ArrowRight size={18} aria-hidden="true" /></Link>
      </> : membership.paymentStatus === "refunded" ? <p role="status">A fatura anual foi reembolsada integralmente. O acesso incluído nessa fatura foi encerrado. Seus acessos antigos válidos ao Radar continuam preservados.</p> : ["disputed","fraud"].includes(membership.paymentStatus ?? "") ? <p role="status">O pagamento está em análise. O acesso anual depende da conclusão dessa análise. Seus acessos antigos válidos ao Radar continuam preservados.</p> : membership.subscription?.status === "past_due" || membership.subscription?.status === "unpaid" ? <p role="status">O pagamento anual está pendente. Confira a fatura e a forma de pagamento no portal antes de tentar novamente. Uma renovação não paga não estende o acesso.</p> : awaitingPayment ? <AnnualPaymentConfirmation /> : pending ? <p role="status">Há uma assinatura ou pagamento em andamento. Se uma renovação falhar, o acesso continua somente até o fim do último período pago. Confira o pagamento antes de iniciar outra assinatura.</p> : reviewing ? <p>A contratação anual está implementada e testada com pagamentos sintéticos. A conexão ao checkout Stripe será validada separadamente antes da publicação.</p> : !communityBillingEnabled() ? <p>A contratação anual está em validação. A entrada gratuita continua disponível.</p> : !verified ? <div><p>Verifique sua conta antes de seguir para o pagamento. Depois você retorna a este resumo.</p><Link className={annual.annualCta} href={verificationHref}>Verificar minha conta</Link></div> : <form data-behavior-action="checkout_start" data-annual-stage="account_ready" action={`/api/comunidade/assinatura/checkout?next=${encodeURIComponent(next)}`} method="post">
        <p className={annual.annualActivation}><ShieldCheck size={20} aria-hidden="true" />Acesso liberado automaticamente após a confirmação do pagamento.</p>
        <p className={annual.annualCheckoutNote}>Na próxima etapa, você revisa o total e conclui sua assinatura no checkout seguro da Stripe.</p>
        <button className={annual.annualCta} type="submit">Continuar para pagamento<ArrowRight size={18} aria-hidden="true" /></button>
        <p className={annual.annualTrust}><LockKeyhole size={14} aria-hidden="true" />Pagamento seguro com a Stripe</p>
      </form>}
    </section>
    <section className={annual.annualBenefits} aria-labelledby="annual-benefits-title"><h2 id="annual-benefits-title">Recursos da assinatura</h2>
      <ul className={annual.annualList}>
        <li><Compass size={22} aria-hidden="true" /><div><h3>Radar completo</h3><p>Explore oportunidades e consulte os detalhes sem o limite das 10 consultas gratuitas.</p></div></li>
        <li><Wrench size={22} aria-hidden="true" /><div><h3>Caixa de Ferramentas</h3><p>Encontre ferramentas e recursos para apoiar suas ideias e colocar projetos em prática.</p></div></li>
        <li><BookOpen size={22} aria-hidden="true" /><div><h3>Seu primeiro resultado com IA</h3><p>Comece a Trilha com o exercício “Um primeiro resultado com IA”: três atividades para sair da intenção e experimentar.</p></div></li>
        <li><MessageCircle size={22} aria-hidden="true" /><div><h3>Fórum da comunidade</h3><p>Troque experiências, compartilhe dúvidas e participe das conversas.</p></div></li>
      </ul>
      <p className={annual.annualScope}>{COMMUNITY_BENEFITS_TERMS} A Trilha está em sua etapa inicial. <Link href="/comunidade">Conheça todas as entregas</Link>.</p>
      {legacy ? <p className={annual.annualLegacy}><strong>Seu Radar continua com você.</strong><br />Seu acesso antigo ao Radar está preservado e independe desta assinatura.</p> : null}
    </section>
    </div>
    {membership.subscription && !reviewing && (process.env.STRIPE_COMMUNITY_PORTAL_CONFIGURATION_ID || (pending && !membership.subscription.cancelAtPeriodEnd)) ? <section className={`${styles.panel} ${annual.annualManage}`}><h2>Gerencie sua assinatura</h2>
      {!reviewing && process.env.STRIPE_COMMUNITY_PORTAL_CONFIGURATION_ID ? <form action={`/api/comunidade/assinatura/portal?next=${encodeURIComponent(next)}`} method="post"><button className={styles.primary} type="submit">Ver faturas e forma de pagamento</button></form> : null}
      {!reviewing && pending && !membership.subscription.cancelAtPeriodEnd ? <form action={`/api/comunidade/assinatura/cancelar?next=${encodeURIComponent(next)}`} method="post"><p>Cancele a renovação automática. O acesso do período já pago será mantido, sem nova cobrança anual.</p><button className={styles.primary} type="submit">Cancelar renovação anual</button></form> : null}
    </section> : null}
    <nav className={annual.annualLinks} aria-label="Ajuda com sua assinatura"><Link href="/membros">Explorar meus recursos</Link><Link href="/membros/suporte">Precisa de ajuda com o pagamento?</Link></nav>
    <p className={annual.annualFootnote}>Prefere continuar no acesso gratuito? Você tem 10 consultas a eventos distintos por conta, sem renovação automática da cota. Reabrir um evento já liberado não gasta outra consulta. <Link href="/membros/oportunidades">Voltar ao Radar</Link>.</p>
  </div></MemberWorkspace>;
}
