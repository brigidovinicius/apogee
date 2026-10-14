import type { Metadata } from "next";
import { OpportunitiesBoard } from "@/components/opportunities/opportunities-board";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import styles from "@/components/opportunities/opportunities.module.css";
import { listPublicOpportunities } from "@/lib/opportunities/access";

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
  const opportunities = await listPublicOpportunities().catch(() => null);

  return (
    <div className={styles.page}>
      <SiteHeader
        current="opportunities"
        memberHref="/membros/entrar?next=%2Fmembros%2Foportunidades"
        memberLabel="Entrar"
      />

      <main id="experiencia" className={styles.main} tabIndex={-1}>
        <section className={styles.hero} aria-labelledby="opportunities-title">
          <p className={styles.eyebrow}>Apogee · oportunidades estudantis</p>
          <h1 id="opportunities-title">Conhecimento muda <em>trajetórias.</em></h1>
          <p className={styles.lead}>
            Explore as oportunidades, os requisitos e os prazos no catálogo ao vivo.
          </p>
          <p className={styles.promise}>
            Consulte a fonte oficial para conferir os detalhes e realizar sua inscrição.
          </p>
        </section>

        {opportunities ? <OpportunitiesBoard opportunities={opportunities} /> : <p role="alert">Catálogo temporariamente indisponível. Tente novamente em instantes.</p>}
      </main>

      <SiteFooter />
    </div>
  );
}
