import Link from "next/link";
import { MemberWorkspace } from "@/components/members/member-workspace";
import { requireSignedInMember } from "@/lib/members/dal";
import { RADAR_ACCESS_PATH, radarBillingEnabled } from "@/lib/billing/config";
import { radarAccess, radarPurchaseNeedsVerification } from "@/lib/billing/store";
import { PaymentConfirmation } from "@/components/members/payment-confirmation";
import { RadarCommunityGate } from "@/components/community/radar-offer-intro";
import { annualResourceLabel } from "@/lib/billing/community-navigation";
import { radarDetailReturnPath } from "@/lib/opportunities/detail-path";
import styles from "@/components/members/members.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Seu acesso ao Radar | Apogee" };

export default async function RadarAccessPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const next = radarDetailReturnPath(params.next);
  const returnQuery = next === "/membros/oportunidades" ? "" : `next=${encodeURIComponent(next)}`;
  const member = await requireSignedInMember(`${RADAR_ACCESS_PATH}${returnQuery ? `?${returnQuery}` : ""}`);
  const livemode = process.env.STRIPE_MODE !== "test";
  let active = false;
  let annual = false;
  let needsVerification = false;
  let accessUnavailable = false;
  try {
    const access = await radarAccess(member.id, livemode);
    active = access.active;
    annual = access.source === "community";
    if (!active) needsVerification = await radarPurchaseNeedsVerification(member.id, livemode);
  } catch { accessUnavailable = true; }
  return <MemberWorkspace member={member} current="radar"><div className={styles.narrow}>
    <p className={styles.eyebrow}>Apogee Radar</p>
    <h1 className={styles.title}>{active ? annual ? "Seu acesso ao Radar está liberado." : "Seu acesso ao Radar está preservado." : needsVerification ? "Confirme seu e-mail para liberar o Radar." : params.payment === "received" ? "Confirmação do pagamento" : "Seu próximo passo com a Apogee."}</h1>
    {accessUnavailable ? <p role="alert">Não foi possível consultar seu acesso agora. Tente novamente antes de continuar.</p> : active ? <><p className={styles.lead}>{annual ? "Sua assinatura anual inclui o Radar completo durante o período pago." : "Você já tem acesso. Não é necessário comprar novamente. Conheça a comunidade se quiser explorar os demais pilares."}</p><Link className={styles.primary} href={next}>{annualResourceLabel(next)}</Link> {annual ? <Link href="/membros/assinatura">Gerenciar assinatura</Link> : null}</> : <>
      {needsVerification ? <p className={styles.lead}>Sua compra anterior foi identificada. Abra o e-mail de confirmação da Apogee para liberar seu acesso, sem comprar novamente.</p> : params.payment !== "received" ? <RadarCommunityGate next={next} verificationHref="#acesso-anterior" /> : null}
      {params.payment === "received" ? <PaymentConfirmation /> : params.payment === "cancelled" ? <p>O checkout foi encerrado. Confira seu acesso antes de continuar.</p> : null}
      <p id="acesso-anterior" tabIndex={-1}>Já adquiriu acesso ao Radar? Entre com o mesmo e-mail da compra e confirme seu e-mail para vincular o acesso.</p>
      {radarBillingEnabled() ? <form action={`/api/radar/verify-email${returnQuery ? `?${returnQuery}` : ""}`} method="post"><button type="submit" className={styles.linkButton}>{needsVerification ? "Reenviar confirmação" : "Confirmar meu e-mail"}</button></form> : null}
      {params.verification === "sent" ? <p role="status">Confira o e-mail de confirmação na sua caixa de entrada.</p> : null}
    </>}
    <p><Link href={`${RADAR_ACCESS_PATH}${returnQuery ? `?${returnQuery}` : ""}`}>Verificar meu acesso</Link></p>
    <p><Link href="/membros/oportunidades">Voltar ao Radar</Link></p>
  </div></MemberWorkspace>;
}
