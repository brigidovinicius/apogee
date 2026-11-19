import Link from "next/link";
import { communityBillingEnabled } from "@/lib/billing/community-config";
import { COMMUNITY_BENEFITS_TERMS, COMMUNITY_SIGNUP_PATH } from "@/content/community-offer";
import styles from "./community-offer.module.css";

export function CommunityPlans({ preview = false, next }: { preview?: boolean; next?: string }) {
  const annual = `/membros/assinatura${next ? `?next=${encodeURIComponent(next)}` : ""}`;
  const available = !preview && communityBillingEnabled();
  const signup = preview ? "/previa/entrada" : next ? `/membros/cadastro?next=${encodeURIComponent(next)}` : COMMUNITY_SIGNUP_PATH;
  return <div className={styles.scope}>
    <div className={styles.plans}>
      <article id="plano-anual" className={`${styles.plan} ${styles.featured}`} aria-labelledby="community-plan-title">
        <h3 id="community-plan-title">Assinatura anual</h3>
        <p>Use o catálogo de ferramentas, pratique com a trilha de IA e consulte o Radar completo.</p>
        <div data-annual-stage="annual_price" className={`${styles.price} ${styles.annualPrice}`}><strong>R$ 1.438,80</strong><span>/ano</span></div>
        <div>
          <p className={styles.note}>Equivale a R$ 119,90 por mês. O pagamento é integral, uma vez por ano.</p>
          <p className={styles.note}>A renovação é automática. Você pode cancelá-la antes da próxima cobrança e usar o período já pago.</p>
        </div>
        {!available && <p className={styles.note}>A contratação anual está temporariamente indisponível.</p>}
        <div className={styles.actions}><Link className={styles.button} data-behavior-action={available ? "annual_choose" : undefined} href={available ? annual : signup} prefetch={false}>{available ? "Assinar a comunidade por um ano" : "Criar conta gratuita"}</Link></div>
        <ul>
          <li>Caixa de Ferramentas com links oficiais por categoria.</li>
          <li>Trilha inicial com três atividades. Outros módulos estão em preparação.</li>
          <li>Radar completo para pesquisar eventos, bolsas e editais.</li>
        </ul>
        <p className={styles.note}>{COMMUNITY_BENEFITS_TERMS}</p>
        <p className={styles.note}>Os acessos antigos do Radar são preservados.</p>
      </article>
      <article className={styles.plan} aria-labelledby="free-plan-title">
        <h3 id="free-plan-title">Conta gratuita</h3>
        <p>Entre na área de membros e participe das conversas do fórum após a verificação da conta.</p>
        <div className={styles.price}><strong>Grátis</strong><span>sem cartão</span></div>
        <ul><li>Pesquise oportunidades no Radar.</li><li>Detalhes de até 10 eventos distintos por conta.</li><li>Reabra os eventos liberados sem gastar outra consulta.</li><li>Veja prévias dos recursos da assinatura.</li></ul>
        <div className={styles.actions}><Link className={styles.button} href={signup} prefetch={false}>Criar minha conta gratuita</Link></div>
        <p className={styles.note}>As 10 consultas não se renovam automaticamente.</p>
      </article>
    </div>
    <p className={styles.reviewNote}>{available ? "Consulte as entregas e condições antes de confirmar sua assinatura." : "O cadastro gratuito está disponível."}</p>
  </div>;
}
