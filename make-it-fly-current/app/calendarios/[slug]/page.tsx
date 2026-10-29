import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { CalendarList } from "@/components/opportunities/calendar-list";
import { AREAS, CALENDARS } from "@/lib/opportunities/discovery";
import { listRadarOpportunities } from "@/lib/opportunities/radar-client";
import { opportunityCardData } from "@/lib/opportunities/card-data";
import styles from "@/components/opportunities/calendar.module.css";
export const dynamic = "force-dynamic";
type Props = { params:Promise<{slug:string}>;searchParams:Promise<Record<string,string|string[]|undefined>> };
export async function generateMetadata({params}:Props) {
  const {slug}=await params;const entry=CALENDARS.find(c=>c.slug===slug);
  return entry ? {title:`${entry.name} | Calendários Apogee`,description:entry.description,alternates:{canonical:`/calendarios/${slug}`}} : {};
}
export default async function CalendarPage({params,searchParams}:Props) {
  const {slug}=await params,query=await searchParams;
  const calendar=CALENDARS.find(c=>c.slug===slug);if(!calendar)notFound();
  const area=typeof query.area==="string" && Object.hasOwn(AREAS,query.area)?query.area as keyof typeof AREAS:null;
  const items=await listRadarOpportunities(true).catch(()=>null);
  const visible=items?.filter(calendar.matches).filter(i=>!area || i.discovery?.areas.includes(area)).map(opportunityCardData);
  return <div className={styles.page}><SiteHeader current="opportunities"/><main className={styles.main}>
    <div className={styles.hero}><Link href="/calendarios">← Todos os calendários</Link><h1>{calendar.name}</h1><p>{calendar.description}</p><p>As etapas de prova e resultado ajudam quem já participa. Confira a etapa de inscrição para saber quando se candidatar.</p></div>
    <form className={styles.filters}><label>Área de interesse<select name="area" defaultValue={area??""}><option value="">Todas as áreas</option>{Object.entries(AREAS).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><button type="submit">Filtrar</button><Link href={`/calendarios/${slug}`}>Limpar</Link></form>
    {visible ? <CalendarList items={visible} allStages/> : <p role="alert">Calendário temporariamente indisponível.</p>}
  </main><SiteFooter/></div>;
}
