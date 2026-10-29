import Link from "next/link";
import { GoogleCalendar } from "@/components/opportunities/google-calendar";
import { googleCalendarStatus } from "@/lib/opportunities/google-calendar-store";
import { requireCalendarMember,savedOpportunities } from "@/lib/opportunities/personal-calendar";
import { listRadarOpportunities } from "@/lib/opportunities/radar-client";
import { CalendarList } from "@/components/opportunities/calendar-list";
import { CalendarSubscription } from "@/components/opportunities/calendar-subscription";
import { MemberBar } from "@/components/members/member-bar";
import { toggleSaved } from "./actions";
import styles from "@/components/opportunities/calendar.module.css";
export const dynamic="force-dynamic";
export const metadata={title:"Meu calendário | Apogee",robots:{index:false,follow:false}};
export default async function MyCalendarPage({searchParams}:{searchParams:Promise<{google?:string}>}) {
  const member=await requireCalendarMember();
  const googleStatus=await googleCalendarStatus(member.id);
  const query=await searchParams;
  const saved=await savedOpportunities(member.id);
  const live=await listRadarOpportunities(true);
  const active=saved.filter(s=>!s.removedAt);
  const items=live.filter(i=>active.some(s=>s.id===i.id));
  return <div className={styles.page}><main className={styles.main}><MemberBar member={member} current="radar"/>
    <div className={styles.hero}><h1>Meu calendário</h1><p>As próximas etapas das oportunidades que você salvou.</p><Link href="/calendarios">Explorar calendários</Link></div>
    <CalendarList items={items} allStages/>
    <h2>Oportunidades salvas</h2>{active.length ? <ul>{active.map(s=><li key={s.id}>{s.snapshot.title}{!live.some(i=>i.id===s.id)?" · Sem próximas etapas disponíveis":""}<form action={toggleSaved.bind(null,s.id,true)}><button className={styles.action}>Remover</button></form></li>)}</ul>:<p>Abra uma oportunidade para salvá-la aqui.</p>}
    <GoogleCalendar status={googleStatus} result={query.google}/>
    <CalendarSubscription/>
  </main></div>;
}
