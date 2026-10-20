import Link from "next/link";
import { requireMember } from "@/lib/members/dal";
import { billingConfig, RADAR_ACCESS_PATH, radarBillingEnabled } from "@/lib/billing/config";
import { radarAccess, radarPurchaseNeedsVerification } from "@/lib/billing/store";
import { PaymentConfirmation } from "@/components/members/payment-confirmation";
import styles from "@/components/members/members.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Acesso vitalício ao Radar" };

export default async function RadarAccessPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const member = await requireMember(RADAR_ACCESS_PATH);
  const enabled = radarBillingEnabled();
  const params = await searchParams;
  let active = false;
  let needsVerification = false;
  let available = enabled;
  try { if (enabled) {
    const { livemode } = billingConfig();
    active = (await radarAccess(member.id, livemode)).active;
    if (!active) needsVerification = await radarPurchaseNeedsVerification(member.id, livemode);
  } }
  catch { available = false; }
  return <div className={styles.narrow}>
    <p className={styles.eyebrow}>Apogee · Radar de Oportunidades</p>
    <h1 className={styles.title}>{active ? "Seu acesso ao Radar está liberado" : needsVerification ? "Confirme seu e-mail para liberar o Radar" : "Radar para a vida toda"}</h1>
    {active ? <><p className={styles.lead}>Você já tem acesso. Não é necessário comprar novamente.</p><Link href="/membros/oportunidades">Explorar o Radar</Link></> : <>
      {needsVerification ? <p className={styles.lead}>Sua compra de R$ 49,00 foi identificada. Para liberar o acesso vitalício, abra o e-mail de confirmação da Apogee e clique no link. Não é necessário comprar novamente.</p> : <p className={styles.lead}>R$ 49,00 em um pagamento único. Acesso vitalício ao Radar de Oportunidades, sem mensalidade ou renovação.</p>}
      {params.payment === "received" ? <PaymentConfirmation /> : null}
      {params.payment === "cancelled" ? <p>O checkout foi encerrado. Você pode voltar quando quiser.</p> : null}
      {needsVerification ? <p>Se não recebeu a confirmação, confira a pasta de spam ou solicite o reenvio abaixo.</p> : available ? <form action="/api/radar/checkout" method="post" className={styles.form}><button type="submit" className={styles.primary}>Comprar acesso vitalício · R$ 49,00</button></form> : <p role="status">Pagamento temporariamente indisponível.</p>}
      <p>Já comprou por um link de pagamento? Entre com o mesmo e-mail da compra e confirme seu e-mail na Apogee para vincular o acesso.</p>
      {available ? <form action="/api/radar/verify-email" method="post"><button type="submit" className={styles.linkButton}>{needsVerification ? "Reenviar e-mail de confirmação" : "Confirmar meu e-mail"}</button></form> : null}
      {params.verification === "sent" ? <p role="status">Se seu e-mail ainda não estava verificado, solicitamos o envio da confirmação. Confira sua caixa de e-mail.</p> : null}
      <p><Link href={RADAR_ACCESS_PATH}>Verificar meu acesso</Link></p>
    </>}
  </div>;
}
