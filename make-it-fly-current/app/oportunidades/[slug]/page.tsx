import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { cache } from "react";
import { listRadarOpportunities } from "@/lib/opportunities/radar-client";
import { opportunityCardData } from "@/lib/opportunities/card-data";
import { publicOpportunityPath, displayOpportunityTitle } from "@/lib/opportunities/discovery";
import { radarCatalogueQuery } from "@/lib/opportunities/navigation";
import { opportunityDetailPath } from "@/lib/opportunities/detail-path";
import { OpportunityCard } from "@/components/opportunities/opportunities-board";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import styles from "@/components/opportunities/calendar.module.css";
import { RadarAmplitude } from "@/components/analytics/radar-amplitude";
export const dynamic = "force-dynamic";
const find = cache(async(slug:string)=>{
  const id=slug.slice(slug.lastIndexOf("--")+2);
  if(!/^radar-[a-zA-Z0-9_-]{1,200}$/.test(id))notFound();
  const item=(await listRadarOpportunities(true)).find(i=>i.id===id);
  if(!item)notFound();return opportunityCardData(item);
});
type Props={params:Promise<{slug:string}>; searchParams: Promise<Record<string, string | string[] | undefined>>};
export async function generateMetadata({params}:Props) {
  const item=await find((await params).slug);
  return {title:`${displayOpportunityTitle(item.title)} | Apogee`,description:`Confira a oportunidade de ${item.organization} no Radar Apogee.`,alternates:{canonical:publicOpportunityPath(item)}};
}
export default async function PreviewPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const item = await find(slug);
  const canonical = publicOpportunityPath(item);
  const filters = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === "string") filters.set(key, value);
  }
  const query = radarCatalogueQuery(filters);
  if (canonical !== `/oportunidades/${slug}`) permanentRedirect(canonical + query);
  const detailPath = opportunityDetailPath(item.id, filters);

  return <div className={styles.page}>
    <SiteHeader current="opportunities" adaptive tone="light" memberHref={`/membros/entrar?next=${encodeURIComponent(detailPath)}`} />
    <main id="experiencia" className={styles.main} tabIndex={-1}>
      <div className={`${styles.hero} ${styles.previewHero}`}>
        <Link href={`/oportunidades${query}#mural-title`}>← Voltar ao Radar</Link>
        <h1>{displayOpportunityTitle(item.title)}</h1>
        <p>Entre na Apogee para consultar requisitos e o link oficial.</p>
      </div>
      <RadarAmplitude key={item.id} view="radar_detail_viewed" />
      <OpportunityCard opportunity={item} detailHref={detailPath} detailLabel="Consultar na minha conta" showTitle={false} />
    </main>
    <SiteFooter />
  </div>;
}
