import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { OpportunitiesBoard } from "@/components/opportunities/opportunities-board";
import styles from "@/components/opportunities/opportunities.module.css";
import { STUDENT_OPPORTUNITIES } from "@/content/opportunities";

export const metadata: Metadata = {
  title: "Oportunidades estudantis | Apogee",
  description:
    "Bolsas, programas e intercâmbios estudantis verificados pela Apogee, com fontes oficiais e critérios claros.",
  openGraph: {
    title: "Oportunidades estudantis | Apogee",
    description: "Chamadas estudantis verificadas e links oficiais para se inscrever.",
  },
};

export default function OpportunitiesPage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.brand} href="/" aria-label="Apogee — início">
          <Image
            className={styles.brandMark}
            src="/brand/apogee-star.svg"
            alt=""
            width={703}
            height={870}
            aria-hidden
          />
          Apogee
        </Link>
        <nav className={styles.nav} aria-label="Navegação principal">
          <Link href="/">Início</Link>
          <Link href="/oportunidades" aria-current="page">Oportunidades</Link>
        </nav>
      </header>

      <main id="experiencia" className={styles.main} tabIndex={-1}>
        <section className={styles.hero} aria-labelledby="opportunities-title">
          <p className={styles.eyebrow}>Apogee · oportunidades estudantis</p>
          <h1 id="opportunities-title">Conhecimento muda <em>trajetórias.</em></h1>
          <p className={styles.lead}>
            Um ponto de partida para encontrar bolsas, programas e intercâmbios
            com inscrições abertas para estudantes brasileiros.
          </p>
          <p className={styles.promise}>
            Cada chamada é conferida em sua fonte oficial antes de aparecer aqui.
            Leia o edital completo para confirmar se o seu perfil atende aos critérios.
          </p>
        </section>

        <OpportunitiesBoard opportunities={STUDENT_OPPORTUNITIES} />
      </main>

      <footer className={styles.footer}>
        <span>Apogee · oportunidades estudantis</span>
        <Link href="/">Voltar ao início</Link>
      </footer>
    </div>
  );
}
