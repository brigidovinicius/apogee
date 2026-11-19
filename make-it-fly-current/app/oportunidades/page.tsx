import { localStaticOfferPreview } from "@/lib/offer-preview";
import { OfferPreviewPage } from "@/components/community/offer-preview";
import { RadarOfferIntro } from "@/components/community/radar-offer-intro";
import { CalendarSaveProvider } from "@/components/opportunities/save-opportunity";
import { calendarSaveState } from "@/lib/opportunities/personal-calendar";
import { calendarReturnPath } from "@/lib/opportunities/calendar-navigation";
import type { Metadata } from "next";
import { OpportunitiesBoard } from "@/components/opportunities/opportunities-board";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import styles from "@/components/opportunities/opportunities.module.css";
import { listPublicOpportunityPage } from "@/lib/opportunities/access";
import { memberRadarLoginHref, memberRadarPath } from "@/lib/opportunities/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Radar de oportunidades | Apogee",
  description:
    "Descubra empregos, eventos, hackathons, projetos, bolsas e intercâmbios com fontes oficiais.",
  alternates: { canonical: "/oportunidades" },
  openGraph: {
    title: "Radar de oportunidades | Apogee",
    description: "Empregos, eventos, hackathons, projetos, bolsas e intercâmbios com fontes oficiais.",
    url: "/oportunidades", siteName: "Apogee", locale: "pt_BR", type: "website",
  },
  twitter: {
    card: "summary", title: "Radar de oportunidades | Apogee",
    description: "Empregos, eventos, hackathons, projetos, bolsas e intercâmbios com fontes oficiais.",
  },
};

export default async function OpportunitiesPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (localStaticOfferPreview()) return <OfferPreviewPage screen="radar" />;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === "string") params.set(key, value);
  }
  const catalogue = await listPublicOpportunityPage(params).catch(() => null);
  const memberHref = memberRadarLoginHref(params);

  const returnTo=calendarReturnPath('/membros/oportunidades?'+params);
  const saveState=await calendarSaveState(catalogue?.opportunities.map(item=>item.id)??[],returnTo);

  return (
    <div className={styles.page}>
      <SiteHeader
        current="opportunities"
        adaptive
        tone="light"
        memberHref={memberHref}
        memberLabel="Entrar"
      />

      <main id="experiencia" className={styles.main} tabIndex={-1}>
        <section className={`${styles.hero} ${styles.catalogueHero}`} aria-labelledby="opportunities-title">
          <h1 id="opportunities-title">Radar de oportunidades</h1>
          <p className={styles.lead}>
            Encontre empregos, eventos, bolsas e programas com fontes oficiais.
          </p>
        </section>

        {catalogue ? <CalendarSaveProvider key={JSON.stringify([returnTo,saveState])} state={saveState} returnTo={returnTo}><OpportunitiesBoard opportunities={catalogue.opportunities} catalogue={catalogue} showCalendarLink editorialFeed publicCatalogue /></CalendarSaveProvider> : <p role="alert">Catálogo temporariamente indisponível. Tente novamente em instantes</p>}
        <RadarOfferIntro next={memberRadarPath(params)} />
      </main>

      <SiteFooter />
    </div>
  );
}
