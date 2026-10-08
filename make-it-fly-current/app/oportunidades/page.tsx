import type { Metadata } from "next";
import { OpportunitiesPreview } from "@/components/opportunities/opportunities-preview";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
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

      <SiteFooter />
    </div>
  );
}
