import Link from "next/link";
import { RADAR_FREE_NOTE } from "@/content/community-offer";
import styles from "./community-offer.module.css";

export function RadarOfferIntro({ preview = false, next }: { preview?: boolean; next?: string }) {
  return <aside className={`${styles.scope} ${styles.intro}`} aria-label="Como acessar o Radar">
    <div><h2>Um próximo passo começa com uma descoberta.</h2><p>{RADAR_FREE_NOTE}</p></div>
    <div className={styles.actions}><Link data-ap-button="primary" className={styles.button} href={preview ? "/previa/entrada" : `/membros/cadastro?next=${encodeURIComponent(next || "/membros/oportunidades")}`} prefetch={false}>Começar gratuitamente</Link><Link data-ap-button="secondary" className={styles.secondary} href={`/comunidade${next ? "?next=" + encodeURIComponent(next) : ""}#plano-anual`} prefetch={false}>Ver plano com Radar completo</Link></div>
  </aside>;
}

export function RadarCommunityGate({ next, verificationHref }: { next?: string; verificationHref?: string }) {
  const query = next ? `?next=${encodeURIComponent(next)}` : "";
  return <section className={`${styles.scope} ${styles.overview}`} aria-labelledby="radar-community-title">
    <h2 id="radar-community-title">Continue com a Comunidade Apogee.</h2>
    <p>Conheça a assinatura que reúne Radar completo, aprendizado prático, Caixa de Ferramentas e conexões no fórum. Seus acessos anteriores são preservados.</p>
    <div className={styles.actions}><Link data-ap-button="primary" className={styles.button} href={`/comunidade${query}#plano-anual`} prefetch={false}>Ver plano com Radar completo</Link><Link data-ap-button="secondary" className={styles.secondary} href={verificationHref ?? ("/membros/radar/acesso" + query)} prefetch={false}>Já tenho acesso ao Radar</Link></div>
  </section>;
}
