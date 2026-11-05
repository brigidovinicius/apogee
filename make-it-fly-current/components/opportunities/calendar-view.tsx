import Link from 'next/link';
import { calendarEntries,publicOpportunityPath } from '@/lib/opportunities/discovery';
import { calendarEntryOverlaps, calendarNavigationQuery, calendarPeriodRange, filterCalendarEntries, shiftCalendarMonth, type CalendarFilters } from '@/lib/opportunities/calendar-filters';
import { dateInBrazil,type StudentOpportunity } from '@/lib/opportunities/types';
import { CalendarList } from './calendar-list';
import { CalendarMonth } from './calendar-month';
import { SaveOpportunityButton } from './save-opportunity';
import styles from './calendar.module.css';
export function CalendarView({items,filters,path='/membros/meu-calendario',query=''}:{items:readonly StudentOpportunity[];filters:CalendarFilters;path?:string;query?:string}) {
  const today=dateInBrazil();
  const entries=calendarEntries(items);
  const month=filters.month??today.slice(0,7);
  const visible=filterCalendarEntries(entries,filters,today);
  const range=calendarPeriodRange(filters,today);
  const undated=items.filter(i=>!entries.some(e=>e.item.id===i.id)&&!i.admissionProcess);
  const selectedDay=filters.day?.startsWith(month)?filters.day:today.startsWith(month)?today:month+'-01';
  const href=(patch:Record<string,string|null>)=>{
    const params=calendarNavigationQuery(new URLSearchParams(query));
    for(const [name,value] of Object.entries(patch))if(value===null)params.delete(name);else params.set(name,value);
    return path+'?'+params;
  };
  const previous=shiftCalendarMonth(month,-1),next=shiftCalendarMonth(month,1);
  return <>
    <nav className={styles.calendarToolbar} aria-label="Navegação do calendário">
      <div className={styles.viewSwitch}><Link href={href({visualizacao:'lista',dia:null})} aria-current={filters.view==='list'?'page':undefined}>Lista</Link><Link href={href({visualizacao:'mes',periodo:'mes',mes:month,dia:null})} aria-current={filters.view==='month'?'page':undefined}>Mês</Link></div>
      <Link className={styles.action} href={href({periodo:filters.view==='month'?'mes':'hoje',mes:filters.view==='month'?today.slice(0,7):null,dia:filters.view==='month'?today:null})}>Hoje</Link>
      {(filters.view==='month'||filters.month||filters.period==='mes')&&<div className={styles.monthNavigation}>
        {previous?<Link href={href({mes:previous,periodo:'mes',dia:null})} aria-label="Mês anterior">← Anterior</Link>:<span>← Anterior</span>}
        <span>{month.split('-').reverse().join('/')}</span>
        {next?<Link href={href({mes:next,periodo:'mes',dia:null})} aria-label="Próximo mês">Próximo →</Link>:<span>Próximo →</span>}
      </div>}
    </nav>
    <p role="status">{visible.length} {visible.length===1?'etapa encontrada':'etapas encontradas'} neste recorte.</p>
    {filters.view==='month'?<>
      <CalendarMonth entries={visible} month={month} selectedDay={selectedDay} today={today} path={path} query={query}/>
      <section id="agenda-do-dia" aria-label={'Agenda de '+selectedDay}><CalendarList items={items} entries={visible.filter(e=>calendarEntryOverlaps(e,selectedDay,selectedDay))} allStages selectedDay={selectedDay}/></section>
    </>:visible.length>0?<CalendarList items={items} entries={visible} allStages startDate={range.start}/>:<p className={styles.empty}>Nenhuma etapa para estes filtros. Ajuste o período ou use Limpar. A agenda reúne as próximas etapas disponíveis; meses anteriores podem não ter histórico completo.</p>}
    {undated.length>0&&<section><h2>Próxima data a anunciar</h2><ul className={styles.list}>{undated.map(i=><li className={styles.row} key={i.id}><Link href={publicOpportunityPath(i)}>{i.title}</Link><SaveOpportunityButton id={i.id} title={i.title}/></li>)}</ul><p>As oportunidades aparecem no mês quando uma próxima data for confirmada.</p></section>}
  </>;
}
