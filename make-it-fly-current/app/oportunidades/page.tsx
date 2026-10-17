import type { Metadata } from "next";
import Link from "next/link";
import { OpportunitiesBoard } from "@/components/opportunities/opportunities-board";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import styles from "@/components/opportunities/opportunities.module.css";
import { listPublicOpportunityPage } from "@/lib/opportunities/access";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Oportunidades estudantis | Apogee",
  description:
    "Descubra eventos, hackathons, competições, projetos, bolsas e intercâmbios com prazos e fontes oficiais.",
  alternates: { canonical: "/oportunidades" },
  openGraph: {
    title: "Oportunidades estudantis | Apogee",
    description: "Eventos, hackathons, projetos, bolsas e intercâmbios com prazos e fontes oficiais.",
    url: "/oportunidades", siteName: "Apogee", locale: "pt_BR", type: "website",
  },
  twitter: {
    card: "summary", title: "Oportunidades estudantis | Apogee",
    description: "Eventos, hackathons, projetos, bolsas e intercâmbios com prazos e fontes oficiais.",
  },
};

export default async function OpportunitiesPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === "string") params.set(key, value);
  }
  const catalogue = await listPublicOpportunityPage(params).catch(() => null);

  return (
    <div className={styles.page}>
      <SiteHeader
        current="opportunities"
        memberHref="/membros/entrar?next=%2Fmembros%2Foportunidades"
        memberLabel="Entrar"
      />

      <main id="experiencia" className={styles.main} tabIndex={-1}>
        <section className={styles.hero} aria-labelledby="opportunities-title">
          <h1 id="opportunities-title">Radar de oportunidades</h1>
          <p className={styles.lead}>
            Descubra eventos, hackathons, projetos e experiências para o seu próximo passo.
          </p>
          <p className={styles.promise}>
            Consulte a fonte oficial para conferir os detalhes e realizar sua inscrição.
          </p>
        </section>

        <p className={styles.memberCta}><Link href="/membros/entrar?next=%2Fmembros%2Foportunidades">Entre na comunidade Apogee para explorar o Radar na área de membros →</Link></p>
        {catalogue ? <OpportunitiesBoard opportunities={catalogue.opportunities} catalogue={catalogue} editorialFeed /> : <p role="alert">Catálogo temporariamente indisponível. Tente novamente em instantes.</p>}
      </main>

      <SiteFooter />
    </div>
  );
}
