import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { OpportunitiesPreview } from "@/components/opportunities/opportunities-preview";
import styles from "@/components/opportunities/opportunities.module.css";
import { listPublicOpportunityPreviews } from "@/lib/opportunities/access";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Oportunidades estudantis | Apogee",
  description:
    "Bolsas, programas e intercâmbios estudantis verificados pela Apogee, com fontes oficiais e critérios claros.",
  openGraph: {
    title: "Oportunidades estudantis | Apogee",
    description: "Chamadas estudantis verificadas e links oficiais para se inscrever.",
  },
};

export default async function OpportunitiesPage() {
  const opportunities = await listPublicOpportunityPreviews();

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.brand} href="/" aria-label="Apogee — início">
          <Image
            className={styles.brandLogo}
            src="/brand/apogee-logo-white.svg"
            alt="Apogee"
            width={1595}
            height={986}
            sizes="(max-width: 760px) 120px, 160px"
            priority
          />
        </Link>
        <nav className={styles.nav} aria-label="Navegação principal">
          <Link href="/">Início</Link>
          <Link href="/oportunidades" aria-current="page">Oportunidades</Link>
          <Link href="/membros/entrar?next=%2Fmembros%2Foportunidades">Entrar</Link>
        </nav>
      </header>

      <main id="experiencia" className={styles.main} tabIndex={-1}>
        <section className={styles.hero} aria-labelledby="opportunities-title">
          <p className={styles.eyebrow}>Apogee · oportunidades estudantis</p>
          <h1 id="opportunities-title">Conhecimento muda <em>trajetórias.</em></h1>
          <p className={styles.lead}>
            Conheça as oportunidades em destaque e acesse o Radar completo pela
            área de membros.
          </p>
          <p className={styles.promise}>
            A prévia pública mostra apenas uma amostra. Critérios, apoios, prazos
            e links oficiais ficam protegidos para membros autenticados.
          </p>
        </section>

        <OpportunitiesPreview opportunities={opportunities} />
      </main>

      <footer className={styles.footer}>
        <span>Apogee · oportunidades estudantis</span>
        <Link href="/">Voltar ao início</Link>
      </footer>
    </div>
  );
}
