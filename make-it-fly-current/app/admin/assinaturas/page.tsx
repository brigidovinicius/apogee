import Link from "next/link";
import { listAnnualMemberships } from "@/lib/billing/community-operations";
import { communityBillingEnabled, communityServiceConfig } from "@/lib/billing/community-config";
import { AdminPageHeader } from "@/components/admin/admin-ui";
import { ReconcileForm } from "./reconcile-form";
import styles from "@/components/community/deliverables.module.css";
export const dynamic = "force-dynamic";
export const metadata = { title: "Assinaturas anuais" };
export default async function MembershipAdmin({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) {
  const params = await searchParams, result = await listAnnualMemberships(Number(params.pagina ?? 1));
  let serviceConfigured = false;
  try { communityServiceConfig(); serviceConfigured = true; } catch { /* Keep incomplete configuration unavailable. */ }
  return <div className={styles.admin}><AdminPageHeader title="Assinaturas anuais" description="Períodos e faturas separados dos acessos antigos do Radar. Conciliação consulta a Stripe e não cria cobranças." />
    <p>Ambiente: {result.livemode ? "produção" : "teste"}. {communityBillingEnabled() ? "Novas assinaturas habilitadas." : "Novas assinaturas pausadas."} {serviceConfigured ? "A gestão e a conciliação dos contratos existentes continuam disponíveis." : "A gestão anual está indisponível enquanto a configuração do serviço estiver incompleta."}</p>
    <section className={styles.card}><h2>Compra e primeiro uso · últimos 30 dias</h2>
      {result.cohort ? <dl>
      <dt>Contas com primeiro período pago no intervalo</dt><dd>{result.cohort.buyers}</dd>
      <dt>Dessas contas, quantas salvaram uma oportunidade ou concluíram uma atividade da Trilha durante um período pago</dt><dd>{result.cohort.activated}</dd>
    </dl> : <p>Indicadores de primeiro uso indisponíveis neste ambiente.</p>}
      <p>Contas distintas neste ambiente. Faturas reembolsadas, em disputa ou sinalizadas não entram na base paga. As contagens operacionais não atribuem dispositivo à fatura.</p>
    </section>
    {!result.rows.length ? <p>Nenhuma assinatura registrada neste ambiente. Leads, contas gratuitas e acessos antigos ao Radar não são assinaturas.</p> : result.rows.map(s => <article key={String(s.id)} className={styles.card}><h2>@{String(s.username ?? "conta")}</h2><p>Situação da assinatura: {String(s.status)}. Fatura: {String(s.payment_status ?? "aguardando")}.</p><p>{s.paid_until ? `Período pago vigente até ${new Date(s.paid_until).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}.` : "Sem período anual pago vigente."} {s.cancel_at_period_end ? "Renovação cancelada." : "Confira a renovação na Stripe."}</p><ReconcileForm id={String(s.id)} enabled={serviceConfigured} /></article>)}
    <nav aria-label="Páginas de assinaturas"><p>Página {result.page} de {result.pages}</p>{result.page > 1 ? <Link href={`/admin/assinaturas?pagina=${result.page - 1}`}>Anterior</Link> : null} {result.page < result.pages ? <Link href={`/admin/assinaturas?pagina=${result.page + 1}`}>Próxima</Link> : null}</nav>
  </div>;
}
