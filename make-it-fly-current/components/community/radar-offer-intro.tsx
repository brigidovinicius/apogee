import Link from "next/link";
import { COMMUNITY_SIGNUP_PATH, RADAR_FREE_NOTE } from "@/content/community-offer";
import styles from "./community-offer.module.css";

export function RadarOfferIntro({ preview = false }: { preview?: boolean }) {
  return <aside className={`${styles.scope} ${styles.intro}`} aria-label="Como acessar o Radar">
    <div><h2>Um próximo passo começa com uma descoberta.</h2><p>{RADAR_FREE_NOTE}</p></div>
    <div className={styles.actions}><Link className={styles.button} href={preview ? "/previa/entrada" : COMMUNITY_SIGNUP_PATH} prefetch={false}>Começar gratuitamente</Link><Link className={styles.secondary} href="/comunidade#planos" prefetch={false}>Conhecer a comunidade</Link></div>
  </aside>;
}

export function RadarCommunityGate({ next }: { next?: string }) {
  const query = next ? `?next=${encodeURIComponent(next)}` : "";
  return <section className={`${styles.scope} ${styles.overview}`} aria-labelledby="radar-community-title">
    <h2 id="radar-community-title">Continue com a Comunidade Apogee.</h2>
    <p>Conheça a assinatura que reúne Radar completo, aprendizado prático, benefícios e conexões. Seus acessos anteriores são preservados.</p>
    <div className={styles.actions}><Link className={styles.button} href={`/comunidade${query}#planos`} prefetch={false}>Conhecer a Comunidade Apogee</Link><Link className={styles.secondary} href="/membros/radar/acesso" prefetch={false}>Já tenho acesso ao Radar</Link></div>
  </section>;
}
