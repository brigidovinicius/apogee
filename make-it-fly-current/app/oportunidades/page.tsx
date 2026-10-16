import type { Metadata } from "next";
import { OpportunitiesBoard } from "@/components/opportunities/opportunities-board";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import styles from "@/components/opportunities/opportunities.module.css";
import { listPublicOpportunities } from "@/lib/opportunities/access";
import { opportunityFiltersFromSearchParams } from "@/lib/opportunities/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Oportunidades estudantis | Apogee",
  description:
    "Explore bolsas, programas e intercâmbios no catálogo ao vivo da Apogee, com requisitos, prazos e fontes oficiais.",
  alternates: { canonical: "/oportunidades" },
  openGraph: {
    title: "Oportunidades estudantis | Apogee",
    description: "Bolsas, programas e intercâmbios com requisitos, prazos e fontes oficiais no catálogo ao vivo da Apogee.",
    url: "/oportunidades", siteName: "Apogee", locale: "pt_BR", type: "website",
  },
  twitter: {
    card: "summary", title: "Oportunidades estudantis | Apogee",
    description: "Bolsas, programas e intercâmbios com requisitos, prazos e fontes oficiais no catálogo ao vivo da Apogee.",
  },
};

export default async function OpportunitiesPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === "string") params.set(key, value);
  }
  const opportunities = await listPublicOpportunities(opportunityFiltersFromSearchParams(params)).catch(() => null);

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

        {opportunities ? <OpportunitiesBoard key={params.toString()} opportunities={opportunities} editorialFeed /> : <p role="alert">Catálogo temporariamente indisponível. Tente novamente em instantes.</p>}
      </main>

      <SiteFooter />
    </div>
  );
}
