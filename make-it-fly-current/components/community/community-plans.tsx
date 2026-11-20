import Link from "next/link";
import { communityBillingEnabled } from "@/lib/billing/community-config";
import { localFunctionalReview } from "@/lib/offer-preview";
import { COMMUNITY_BENEFITS_TERMS, COMMUNITY_SIGNUP_PATH } from "@/content/community-offer";
import styles from "./community-offer.module.css";

import type { PublishedResources } from "./community-deliverables";

export function CommunityPlans({ preview = false, signedIn = false, subscribed = false, next, resources }: { preview?: boolean; signedIn?: boolean; subscribed?: boolean; next?: string; resources?: PublishedResources }) {
  const annual = `/membros/assinatura${next ? `?next=${encodeURIComponent(next)}` : ""}`;
  const available = !preview && communityBillingEnabled();
  const reviewing = !preview && localFunctionalReview();
  const signup = preview ? "/previa/entrada" : next ? `/membros/cadastro?next=${encodeURIComponent(next)}` : COMMUNITY_SIGNUP_PATH;
  const free = signedIn ? next ?? "/membros" : signup;
  return <div className={styles.scope}>
    <div className={styles.plans}>
      <article id="plano-anual" className={`${styles.plan} ${styles.featured}`} aria-labelledby="community-plan-title">
        <h3 data-ap-art="assinatura" data-ap-heading="" id="community-plan-title">Assinatura anual</h3>
        <p>{resources?.trilha && resources.ferramentas ? "Use o catálogo de ferramentas, pratique com a trilha de IA e consulte o Radar completo." : "Consulte o Radar completo e acesse os recursos publicados da comunidade."}</p>
        <div data-annual-stage="annual_price" className={`${styles.price} ${styles.annualPrice}`}><strong>R$ 1.438,80</strong><span>/ano</span></div>
        <div>
          <p className={styles.note}>Equivale a R$ 119,90 por mês. O pagamento é integral, uma vez por ano.</p>
          <p className={styles.note}>A renovação é automática. Você pode cancelá-la antes da próxima cobrança e usar o período já pago.</p>
        </div>
        {!available && !subscribed && <p className={styles.note}>{reviewing ? "Prévia local, sem cobrança." : "A contratação anual está temporariamente indisponível."}</p>}
        {subscribed && <div className={styles.actions}><Link data-ap-button="primary" className={styles.button} href="/membros" prefetch={false}>Acessar a área de membros</Link></div>}
        {!subscribed && (available || reviewing) && <div className={styles.actions}><Link data-ap-button="primary" className={styles.button} data-behavior-action={available ? "annual_choose" : undefined} href={annual} prefetch={false}>Assinar a comunidade por um ano</Link></div>}
        <ul>
          <li>Caixa de Ferramentas com links oficiais por categoria.</li>
          <li>Trilha inicial com três atividades. Outros módulos estão em preparação.</li>
          <li>Radar completo para pesquisar eventos, bolsas e editais.</li>
        </ul>
        <p className={styles.note}>{COMMUNITY_BENEFITS_TERMS}</p>
        <p className={styles.note}>Os acessos antigos do Radar são preservados.</p>
      </article>
      <article className={styles.plan} aria-labelledby="free-plan-title">
        <h3 data-ap-art="perfil" data-ap-heading="" id="free-plan-title">Conta gratuita</h3>
        <p>Entre na área de membros e participe das conversas do fórum após a verificação da conta.</p>
        <div className={styles.price}><strong>Grátis</strong><span>sem cartão</span></div>
        <ul><li>Pesquise e navegue pelo Radar e por Benefícios.</li><li>10 consultas mensais no Radar e 10 em Benefícios.</li><li>Reabra itens já liberados no mesmo mês sem usar outra consulta.</li></ul>
        {!subscribed && <div className={styles.actions}><Link data-ap-button="primary" className={styles.button} href={free} prefetch={false}>{signedIn ? "Continuar com minha conta gratuita" : "Criar minha conta gratuita"}</Link></div>}
        {!signedIn && !preview && <p className={styles.note}>Já tem conta? <Link href={`/membros/entrar?next=${encodeURIComponent(next ?? "/membros")}`} prefetch={false}>Entrar</Link></p>}
      </article>
    </div>
    <p className={styles.reviewNote}>{available ? "Consulte as entregas e condições antes de confirmar sua assinatura." : "O cadastro gratuito está disponível."}</p>
  </div>;
}
