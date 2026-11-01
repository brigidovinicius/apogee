import Link from "next/link";
import { GoogleCalendar } from "@/components/opportunities/google-calendar";
import { googleCalendarStatus } from "@/lib/opportunities/google-calendar-store";
import { requireCalendarMember,savedOpportunities } from "@/lib/opportunities/personal-calendar";
import { listRadarOpportunities } from "@/lib/opportunities/radar-client";
import { CalendarView } from "@/components/opportunities/calendar-view";
import { CalendarFilters } from "@/components/opportunities/calendar-filters";
import { readCalendarFilters,filterCalendarItems,calendarFilterQuery } from "@/lib/opportunities/calendar-filters";
import { listSavedCalendarFilters } from "@/lib/opportunities/saved-calendar-filters";
import { saveCalendarFilter,deleteCalendarFilter } from "./filter-actions";
import { MemberBar } from "@/components/members/member-bar";
import { toggleSaved } from "./actions";
import styles from "@/components/opportunities/calendar.module.css";
export const dynamic="force-dynamic";
export const metadata={title:"Meu calendário | Apogee",robots:{index:false,follow:false}};
export default async function MyCalendarPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const member=await requireCalendarMember();
  const googleStatus=await googleCalendarStatus(member.id);
  const query=await searchParams;
  const paramsQuery=new URLSearchParams(Object.entries(query).flatMap(([k,v])=>typeof v==="string"?[[k,v]]:[]));
  const filters=readCalendarFilters(paramsQuery);
  const presets=await listSavedCalendarFilters(member.id);
  const catalogue=query.catalogo==="1";
  const saved=await savedOpportunities(member.id);
  const live=await listRadarOpportunities(true);
  const active=saved.filter(s=>!s.removedAt);
  const source=catalogue?live:live.filter(i=>active.some(s=>s.id===i.id));
  const items=filterCalendarItems(source,filters);
  return <div className={styles.page}><main className={styles.main}><MemberBar member={member} current="radar"/>
    <div className={styles.hero}><h1>Meu calendário</h1><p>As próximas etapas das oportunidades que você salvou.</p><Link href="/calendarios">Explorar calendários</Link></div>
    <nav aria-label="Origem do calendário"><Link className={styles.action} href="/membros/meu-calendario">Minhas oportunidades salvas</Link><Link className={styles.action} href="/membros/meu-calendario?catalogo=1">Explorar catálogo com filtros</Link></nav>
    <h2>Minhas combinações de filtros</h2>
    {presets.length?<ul className={styles.savedFilters}>{presets.map(p=><li key={p.id}><Link href={'/membros/meu-calendario?catalogo=1&'+p.query}>{p.name}</Link><form action={deleteCalendarFilter}><input type="hidden" name="id" value={p.id}/><button type="submit" aria-label={'Remover filtro '+p.name}>Remover</button></form></li>)}</ul>:<p>Salve uma combinação para encontrá-la aqui quando voltar.</p>}
    {query.filtro&&<p role="status">{query.filtro==='salvo'?'Combinação salva.':'Não foi possível salvar. Use um nome de até 80 caracteres e mantenha até 20 combinações.'}</p>}
    <CalendarFilters filters={filters} items={source} path="/membros/meu-calendario" hidden={catalogue?{catalogo:'1'}:{}}/>
    <form action={saveCalendarFilter} className={styles.filters}><input type="hidden" name="filters" value={calendarFilterQuery(paramsQuery)}/><label>Nome da combinação<input name="name" maxLength={80} required placeholder="Ex.: Astronomia online"/></label><button type="submit">Salvar combinação</button></form>
    <CalendarView items={items} filters={filters}/>
    {catalogue&&<p>Abra uma ficha para salvar a oportunidade. Os filtros não incluem eventos automaticamente no Google Agenda.</p>}
    <h2>Oportunidades salvas</h2>{active.length ? <ul>{active.map(s=><li key={s.id}>{s.snapshot.title}{!live.some(i=>i.id===s.id)?" · Sem próximas etapas disponíveis":""}<form action={toggleSaved.bind(null,s.id,true)}><button className={styles.action}>Remover</button></form></li>)}</ul>:<p>Abra uma oportunidade para salvá-la aqui.</p>}
    <GoogleCalendar status={googleStatus} result={typeof query.google==="string"?query.google:undefined}/>
  </main></div>;
}
