import Link from "next/link";
import {notFound} from "next/navigation";
import {localStripeSandboxReview} from "@/lib/offer-preview";
import styles from "@/components/members/members.module.css";
export const dynamic="force-dynamic";
export const metadata={title:"Validação Stripe em teste | Apogee",robots:{index:false,follow:false}};
export default function StripeReviewPage() {
  if(!localStripeSandboxReview())notFound();
  return <main className={styles.container} id="experiencia"><h1 className={styles.title}>Checkout anual em teste.</h1>
    <p>Ambiente de teste da Stripe e banco local exclusivo. Não use cartão ou dados pessoais reais. Eventos do catálogo e contas da aplicação são fictícios; checkout, faturas e webhooks usam a API de teste da Stripe.</p>
    <p>Senha das contas locais: <code>RevisaoLocal2026!</code>.</p>
    <ul><li><strong>sandboxcompra@example.test</strong>: compra e cancelamento da renovação.</li><li><strong>sandboxrecusa@example.test</strong>: tentativa de cartão recusado e nova tentativa.</li><li><strong>sandboxcontrole@example.test</strong>: dez consultas, sem assinatura.</li><li><strong>sandboxlegado@example.test</strong>: acesso antigo preservado.</li></ul>
    <p><Link className={styles.primary} href="/membros/entrar?next=%2Fmembros%2Fassinatura">Entrar para validar a assinatura</Link></p>
    <p><Link href="/membros/assinatura">Assinatura e pagamentos</Link> · <Link href="/membros/oportunidades/radar-review-event-11">Conferir acesso ao evento 11</Link></p>
  </main>;
}
