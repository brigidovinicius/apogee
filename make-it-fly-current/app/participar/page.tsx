import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import styles from "./participar.module.css";

const GOOGLE_FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLSf5SWl3uDdVLqoMC1YUfx10RhOHt2U6r8APopefkLF-0CLBQA/viewform";

export const metadata: Metadata = {
  title: "Participe | Make It Fly by Apogee",
  description: "Conte um pouco sobre você e sua ideia para participar do Make It Fly. Uma experiência da Apogee.",
  alternates: { canonical: null },
  robots: { index: false, follow: true },
};

export default function ParticipatePage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/" aria-label="Apogee, voltar ao Make It Fly" className={styles.brand}>
          <Image src="/brand/apogee-logo-white.svg" alt="Apogee" width={1595} height={986} sizes="104px" priority />
        </Link>
        <Link href="/" className={styles.backLink}><span aria-hidden="true">←</span> Voltar ao evento</Link>
      </header>
      <main id="experiencia" className={styles.main} tabIndex={-1}>
        <section className={styles.intro} aria-labelledby="application-title">
          <p className={styles.eyebrow}>Aplicação Make It Fly</p>
          <h1 id="application-title">Uma ideia.<br />O próximo <em>passo.</em></h1>
          <p className={styles.introCopy}>Queremos conhecer você, entender o que está construindo e saber como a Make It Fly pode ajudar sua ideia a avançar.</p>
          <div className={styles.processNote}>
            <span aria-hidden="true">✦</span>
            <p>Preencha todas as etapas. As respostas seguem para a curadoria da Apogee e cada candidatura será avaliada manualmente.</p>
          </div>
          <p className={styles.privacy}>Seus dados serão usados apenas para avaliar sua participação, organizar esta edição e entrar em contato sobre a Make It Fly.</p>
          <div className={styles.introSignature}>
            <Image src="/brand/make-it-fly-wordmark.png" alt="Make It Fly — Building the future" width={2097} height={523} sizes="(max-width: 800px) 240px, 30vw" priority />
            <span>Give your ideas wings.</span>
          </div>
        </section>

        <section className={styles.formPanel} aria-labelledby="form-heading">
          <div className={styles.formHeading}>
            <div>
              <p>Formulário de aplicação</p>
              <h2 id="form-heading">Conte o que você quer colocar no mundo.</h2>
            </div>
            <a href={`${GOOGLE_FORM_URL}?usp=header`} target="_blank" rel="noreferrer">Abrir em nova aba <span aria-hidden="true">↗</span></a>
          </div>
          <iframe
            className={styles.formFrame}
            src={`${GOOGLE_FORM_URL}?embedded=true`}
            title="Formulário de aplicação Make It Fly"
            loading="eager"
          >
            Carregando formulário…
          </iframe>
        </section>
      </main>
      <footer className={styles.pageFooter}><span>Make It Fly, uma experiência Apogee.</span><span>Curadoria individual.</span></footer>
    </div>
  );
}
