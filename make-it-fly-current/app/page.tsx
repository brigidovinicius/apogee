import Image from "next/image";
import Link from "next/link";
import styles from "./home.module.css";

// Home provisória da Apogee até o site oficial existir. O Make It Fly vive em /makeitfly.
export default function ApogeeHome() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Image className={styles.logo} src="/brand/apogee-logo-white.svg" alt="Apogee" width={1595} height={986} sizes="120px" priority />
        <nav className={styles.nav} aria-label="Navegação principal">
          <Link href="/oportunidades">Oportunidades</Link>
          <Link href="/galeria">Galeria</Link>
          <Link href="/loja">Loja</Link>
        </nav>
      </header>

      <main id="experiencia" className={styles.main} tabIndex={-1}>
        <p className={styles.eyebrow}>Apogee</p>
        <h1 className={styles.title}>Ideias que chegam ao <em>ponto mais alto.</em></h1>
        <p className={styles.lead}>Comunidade e experiências para quem quer tirar uma ideia do papel. O site completo está a caminho.</p>

        <Link href="/makeitfly" className={styles.card}>
          <Image className={styles.wordmark} src="/brand/make-it-fly-wordmark.png" alt="Make It Fly — Building the future" width={2097} height={523} sizes="(max-width: 640px) 70vw, 320px" />
          <span className={styles.cardCopy}>Um dia de coworking, comunidade e foco. Vagas limitadas.</span>
          <span className={styles.cardCta}>Conhecer o evento <span aria-hidden="true">↗</span></span>
        </Link>
      </main>

      <footer className={styles.footer}>Apogee</footer>
    </div>
  );
}
