import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { cache } from "react";
import { listRadarOpportunities } from "@/lib/opportunities/radar-client";
import { opportunityCardData } from "@/lib/opportunities/card-data";
import { publicOpportunityPath, displayOpportunityTitle } from "@/lib/opportunities/discovery";
import { opportunityDetailPath } from "@/lib/opportunities/detail-path";
import { OpportunityCard } from "@/components/opportunities/opportunities-board";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import styles from "@/components/opportunities/calendar.module.css";
export const dynamic = "force-dynamic";
const find = cache(async(slug:string)=>{
  const id=slug.slice(slug.lastIndexOf("--")+2);
  if(!/^radar-[a-zA-Z0-9_-]{1,200}$/.test(id))notFound();
  const item=(await listRadarOpportunities(true)).find(i=>i.id===id);
  if(!item)notFound();return opportunityCardData(item);
});
type Props={params:Promise<{slug:string}>};
export async function generateMetadata({params}:Props) {
  const item=await find((await params).slug);
  return {title:`${displayOpportunityTitle(item.title)} | Apogee`,description:`Confira a oportunidade de ${item.organization} no Radar Apogee.`,alternates:{canonical:publicOpportunityPath(item)}};
}
export default async function PreviewPage({params}:Props) {
  const {slug}=await params,item=await find(slug),canonical=publicOpportunityPath(item);
  if(canonical!==`/oportunidades/${slug}`)permanentRedirect(canonical);
  return <div className={styles.page}><SiteHeader current="opportunities"/><main className={styles.main}>
    <div className={styles.hero}><Link href="/oportunidades">← Radar</Link><h1>{displayOpportunityTitle(item.title)}</h1><p>Faça login para abrir sua oportunidade gratuita ou usar seu acesso vitalício.</p><Link className={styles.action} href={opportunityDetailPath(item.id)}>Abrir detalhes</Link></div>
    <OpportunityCard opportunity={item} detailHref={opportunityDetailPath(item.id)}/>
  </main><SiteFooter/></div>;
}
