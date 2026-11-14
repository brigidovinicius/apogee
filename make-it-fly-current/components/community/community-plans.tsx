import Link from "next/link";
import { COMMUNITY_SIGNUP_PATH } from "@/content/community-offer";
import styles from "./community-offer.module.css";

export function CommunityPlans({ preview = false, next }: { preview?: boolean; next?: string }) {
  const signup = preview ? "/previa/entrada" : next ? `/membros/cadastro?next=${encodeURIComponent(next)}` : COMMUNITY_SIGNUP_PATH;
  return <div className={styles.scope}>
    <div className={styles.plans}>
      <article className={styles.plan} aria-labelledby="free-plan-title">
        <h3 id="free-plan-title">Comece gratuitamente.</h3>
        <p>Conheça a Apogee e encontre um próximo passo para você.</p>
        <div className={styles.price}><strong>Grátis</strong><span>sem cartão</span></div>
        <ul><li>Descoberta no Radar e conteúdo público.</li><li>Detalhes de até 10 eventos distintos por conta.</li><li>Reabra os eventos liberados sem gastar outra consulta.</li><li>Conheça as experiências gratuitas da Apogee.</li></ul>
        <div className={styles.actions}><Link className={styles.button} href={signup} prefetch={false}>Criar minha conta gratuita</Link></div>
        <p className={styles.note}>As 10 consultas não se renovam automaticamente.</p>
      </article>
      <article className={`${styles.plan} ${styles.featured}`} aria-labelledby="community-plan-title">
        <h3 id="community-plan-title">Comunidade anual.</h3>
        <p>Radar completo, aprendizado prático, conexões e benefícios em uma assinatura anual.</p>
        <div className={`${styles.price} ${styles.annualPrice}`}><strong>R$ 1.438,80</strong><span>/ano</span></div>
        <div>
          <p className={styles.note}>Equivalente a R$ 119,90 por mês. A contratação é anual.</p>
          <p className={styles.note}>Forma de pagamento, renovação e cancelamento em definição.</p>
        </div>
        <ul><li>Radar completo incluído na assinatura.</li><li>Trilhas de IA aplicada conforme o programa do plano.</li><li>Conexões, atividades e projetos da comunidade.</li><li>Perks conforme disponibilidade e elegibilidade.</li></ul>
        <div className={styles.actions}><Link className={styles.button} href={signup} prefetch={false}>Começar pela entrada gratuita</Link></div>
        <p className={styles.note}>Os acessos antigos do Radar são preservados.</p>
      </article>
    </div>
    <p className={styles.reviewNote}>Assinatura anual proposta para revisão. A contratação ainda não está disponível. O programa das trilhas, as atividades e os benefícios incluídos serão apresentados antes da adesão.</p>
  </div>;
}
