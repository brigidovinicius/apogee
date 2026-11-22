import Link from "next/link";
import { communityBillingEnabled } from "@/lib/billing/community-config";
import { CommunityCheckoutButton } from "./community-checkout-button";
import { COMMUNITY_SIGNUP_PATH } from "@/content/community-offer";
import styles from "./community-offer.module.css";

import type { PublishedResources } from "./community-deliverables";

export function CommunityPlans({ preview = false, signedIn = false, subscribed = false, next, resources }: { preview?: boolean; signedIn?: boolean; subscribed?: boolean; next?: string; resources?: PublishedResources }) {
  const available = !preview && communityBillingEnabled();
  const signup = preview ? "/previa/entrada" : next ? `/membros/cadastro?next=${encodeURIComponent(next)}` : COMMUNITY_SIGNUP_PATH;
  const free = signedIn ? next ?? "/membros" : signup;
  return <div className={styles.scope}>
    <div className={styles.plans}>
      <article id="plano-anual" className={`${styles.plan} ${styles.featured}`} aria-labelledby="community-plan-title">
        <h3 id="community-plan-title">Assinatura anual</h3>
        <p>Consulte o Radar completo e acesse os recursos publicados da comunidade.</p>
        <div data-annual-stage="annual_price" className={`${styles.price} ${styles.annualPrice}`}><strong>R$ 1.438,80</strong><span>/ano</span></div>
        <div>
          <p className={styles.note}>Equivale a R$ 119,90/mês. Pagamento integral anual.</p>
          <p className={styles.note}>Renovação automática. Cancele antes da próxima cobrança e mantenha o período pago.</p>
        </div>
        {!available && !preview && !subscribed && <p className={styles.note}>A contratação anual está temporariamente indisponível.</p>}
        <div className={styles.actions}><CommunityCheckoutButton signedIn={signedIn} preview={preview} subscribed={subscribed} next={next} /></div>
        {!subscribed && (available || preview) && <p className={styles.note}>Pagamento seguro com a Stripe.</p>}
        <ul>
          {resources?.ferramentas && <li>Caixa de Ferramentas organizada por tarefa.</li>}
          <li>Radar completo: eventos, bolsas e editais.</li>
        </ul>
        <p className={styles.note}>Benefícios de parceiros conforme disponibilidade e elegibilidade. Licenças de ferramentas não incluídas.</p>
      </article>
      <article className={styles.plan} aria-labelledby="free-plan-title">
        <h3 id="free-plan-title">Conta gratuita</h3>
        <p>Explore os catálogos e participe do fórum após verificar sua conta.</p>
        <div className={styles.price}><strong>Grátis</strong><span>sem cartão</span></div>
        <ul><li>Pesquise e navegue pelo Radar e por Benefícios.</li><li>10 consultas mensais no Radar e 10 em Benefícios.</li><li>Reabra itens no mesmo mês sem gastar outra consulta.</li></ul>
        {!subscribed && <div className={styles.actions}><Link data-ap-button="secondary" className={styles.secondary} href={free} prefetch={false}>{signedIn ? "Continuar com minha conta gratuita" : "Criar minha conta gratuita"}</Link></div>}
        {!signedIn && !preview && <p className={styles.note}>Já tem conta? <Link href={`/membros/entrar?next=${encodeURIComponent(next ?? "/membros")}`} prefetch={false}>Entrar</Link></p>}
      </article>
    </div>
  </div>;
}
