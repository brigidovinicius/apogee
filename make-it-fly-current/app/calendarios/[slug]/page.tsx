import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { CalendarView } from "@/components/opportunities/calendar-view";
import { CalendarFilters } from "@/components/opportunities/calendar-filters";
import { readCalendarFilters,filterCalendarItems,calendarFilterQuery } from "@/lib/opportunities/calendar-filters";
import { CALENDARS } from "@/lib/opportunities/discovery";
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
  const paramsQuery=new URLSearchParams(Object.entries(query).flatMap(([k,v])=>typeof v==="string"?[[k,v]]:[]));
  paramsQuery.set("calendario",slug);
  const filters=readCalendarFilters(paramsQuery);
  const items=await listRadarOpportunities(true).catch(()=>null);
  const visible=items?filterCalendarItems(items,filters).map(opportunityCardData):null;
  return <div className={styles.page}><SiteHeader current="opportunities"/><main className={styles.main}>
    <div className={styles.hero}><Link href="/calendarios">← Todos os calendários</Link><h1>{calendar.name}</h1><p>{calendar.description}</p><p>As etapas de prova e resultado ajudam quem já participa. Confira a etapa de inscrição para saber quando se candidatar.</p></div>
    {items&&<CalendarFilters filters={filters} items={items} path={`/calendarios/${slug}`} hidden={{calendario:slug}}/>}
    <Link className={styles.action} href={`/membros/meu-calendario?catalogo=1&${calendarFilterQuery(paramsQuery)}`}>Salvar esta combinação na minha conta</Link>
    {visible ? <CalendarView items={visible} filters={filters}/> : <p role="alert">Calendário temporariamente indisponível.</p>}
  </main><SiteFooter/></div>;
}
