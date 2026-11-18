import Link from "next/link";
import { communityBillingEnabled } from "@/lib/billing/community-config";
import { COMMUNITY_SIGNUP_PATH } from "@/content/community-offer";
import styles from "./community-offer.module.css";

export function CommunityPlans({ preview = false, next }: { preview?: boolean; next?: string }) {
  const annual = `/membros/assinatura${next ? `?next=${encodeURIComponent(next)}` : ""}`;
  const available = !preview && communityBillingEnabled();
  const signup = preview ? "/previa/entrada" : next ? `/membros/cadastro?next=${encodeURIComponent(next)}` : COMMUNITY_SIGNUP_PATH;
  return <div className={styles.scope}>
    <div className={styles.plans}>
      <article id="plano-anual" className={`${styles.plan} ${styles.featured}`} aria-labelledby="community-plan-title">
        <h3 id="community-plan-title">Comunidade anual</h3>
        <p>Radar completo, Caixa de Ferramentas e Trilha inicial parcial em uma assinatura anual.</p>
        <div data-annual-stage="annual_price" className={`${styles.price} ${styles.annualPrice}`}><strong>R$ 1.438,80</strong><span>/ano</span></div>
        <div>
          <p className={styles.note}>Equivalente a R$ 119,90 por mês. A contratação é anual.</p>
          <p className={styles.note}>Cobrança anual de R$ 1.438,80, com renovação automática. Cancele a renovação antes da próxima cobrança.</p>
        </div>
        {!available && <p className={styles.note}>A contratação anual está temporariamente indisponível.</p>}
        <div className={styles.actions}><Link className={styles.button} data-behavior-action={available ? "annual_choose" : undefined} href={available ? annual : signup} prefetch={false}>{available ? "Assinar a comunidade anual" : "Começar pela entrada gratuita"}</Link></div>
        <ul><li>Radar completo incluído na assinatura.</li><li>Caixa de Ferramentas organizada por categorias.</li><li>Trilha inicial parcial: um exercício com três atividades.</li><li>Conexões no fórum da comunidade.</li></ul>
        <p className={styles.note}>Benefícios de parceiros estão em preparação e não estão disponíveis neste lançamento.</p>
        <p className={styles.note}>Os acessos antigos do Radar são preservados.</p>
      </article>
      <article className={styles.plan} aria-labelledby="free-plan-title">
        <h3 id="free-plan-title">Comece gratuitamente.</h3>
        <p>Conheça a Apogee e encontre um próximo passo para você.</p>
        <div className={styles.price}><strong>Grátis</strong><span>sem cartão</span></div>
        <ul><li>Descoberta no Radar e conteúdo público.</li><li>Detalhes de até 10 eventos distintos por conta.</li><li>Reabra os eventos liberados sem gastar outra consulta.</li><li>Conheça as experiências gratuitas da Apogee.</li></ul>
        <div className={styles.actions}><Link className={styles.button} href={signup} prefetch={false}>Criar minha conta gratuita</Link></div>
        <p className={styles.note}>As 10 consultas não se renovam automaticamente.</p>
      </article>
    </div>
    <p className={styles.reviewNote}>{available ? "Consulte as entregas e condições antes de confirmar sua assinatura." : "A contratação anual será disponibilizada após a validação. A entrada gratuita continua disponível."}</p>
  </div>;
}
