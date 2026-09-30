import Image from "next/image";
import { ABERTURA } from "@/content/site";
import { ApplicationLink } from "@/components/application/ApplicationLink";
import styles from "./apogee.module.css";

export function HeroContent() {
  return (
    <div className={styles.content}>
      <div className={styles.topline}>
        <div className={styles.support}>
          <span>{ABERTURA.apoio.rotulo}</span>
          <Image src={ABERTURA.apoio.logo} alt={ABERTURA.apoio.logoAlt} width={1726} height={4918} sizes="30px" />
        </div>
      </div>
      <div className={styles.statement}>
        <p className={styles.eyebrow}>{ABERTURA.iniciativa}</p>
        <p className={styles.subtitle}>{ABERTURA.subtitulo}</p>
        <p className={styles.description}>{ABERTURA.descricao}</p>
      </div>
      <div className={styles.bottom}>
        <h1 id="hero-title" className={styles.title}>
          <span className={styles.srOnly}>{ABERTURA.titulo} {ABERTURA.destaque}</span>
          <Image src="/brand/make-it-fly-wordmark.png" alt="" aria-hidden="true" width={2097} height={523}
            className={styles.wordmark} loading="eager" fetchPriority="high" sizes="94vw" />
        </h1>
        <div className={styles.footer}>
          <ul aria-label="Informações do evento">{ABERTURA.meta.map(item => <li key={item}>{item}</li>)}</ul>
          <ApplicationLink className={styles.cta}>{ABERTURA.cta}</ApplicationLink>
          <a className={styles.scrollCue} href="#experiencia">{ABERTURA.scroll}<span aria-hidden="true">↓</span></a>
        </div>
      </div>
    </div>
  );
}
