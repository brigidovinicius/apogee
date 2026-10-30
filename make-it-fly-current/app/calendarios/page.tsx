import { personalCalendarEnabled } from "@/lib/opportunities/personal-calendar";
import Link from "next/link";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { CALENDARS, calendarEntries } from "@/lib/opportunities/discovery";
import { listRadarOpportunities } from "@/lib/opportunities/radar-client";
import styles from "@/components/opportunities/calendar.module.css";
export const dynamic = "force-dynamic";
export const metadata = { title:"Calendários de oportunidades | Apogee", description:"Olimpíadas, vestibulares e eventos organizados pelas próximas datas confirmadas.", alternates:{canonical:"/calendarios"} };
export default async function CalendarsPage() {
  const items = await listRadarOpportunities(true).catch(()=>null);
  const structured = { "@context":"https://schema.org", "@type":"ItemList", itemListElement:CALENDARS.map((c,index)=>({"@type":"ListItem",position:index+1,name:c.name,url:`https://www.apogee.community/calendarios/${c.slug}`})) };
  return <div className={styles.page}><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(structured).replace(/</g,"\\u003c")}}/><SiteHeader current="opportunities"/><main className={styles.main}>
    <div className={styles.hero}><Link href="/oportunidades">← Radar de oportunidades</Link><h1>Seu próximo passo tem uma data.</h1><p>Explore calendários e acompanhe inscrições, provas e resultados com informações verificadas.</p></div>
    {items ? <div className={styles.grid}>{CALENDARS.map(c=>{const count=new Set(calendarEntries(items.filter(c.matches)).map(e=>e.item.id)).size;return <Link className={styles.tile} key={c.slug} href={`/calendarios/${c.slug}`}><span>Calendário Apogee</span><h2>{c.name}</h2><p>{c.description}</p><small>{count} {count===1?"oportunidade":"oportunidades"} com próximas datas</small></Link>})}</div> : <p role="alert">Calendários temporariamente indisponíveis. Tente novamente em instantes.</p>}
    {personalCalendarEnabled() && <Link className={styles.action} href="/membros/meu-calendario">Meu calendário</Link>}
  </main><SiteFooter/></div>;
}
