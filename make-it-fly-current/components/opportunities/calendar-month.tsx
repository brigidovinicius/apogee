import Link from 'next/link';
import { calendarMonthDays, calendarNavigationQuery } from '@/lib/opportunities/calendar-filters';
import { type CalendarEntry } from '@/lib/opportunities/discovery';
import styles from './calendar.module.css';
export function CalendarMonth({entries,month,selectedDay,today,path,query}:{entries:readonly CalendarEntry[];month:string;selectedDay:string;today:string;path:string;query:string}) {
  const label=new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(month+'-01T12:00:00Z'));
  const days=calendarMonthDays(entries,month);
  return <section aria-label={'Calendário de '+label}>
    <h2 className={styles.monthTitle}>{label}</h2><p className={styles.filterHint}>Selecione um dia para ver suas etapas. Inscrições aparecem no encerramento; eventos em andamento também aparecem nos dias do intervalo.</p>
    <table className={styles.monthGrid}><caption className={styles.srOnly}>{label}</caption>
      <thead><tr>{['Segunda','Terça','Quarta','Quinta','Sexta','Sábado','Domingo'].map(day=><th scope="col" key={day}><abbr title={day}>{day.slice(0,3)}</abbr></th>)}</tr></thead>
      <tbody>{Array.from({length:days.length/7},(_,week)=><tr key={week}>{days.slice(week*7,week*7+7).map((day,index)=><td key={day.date??'empty-'+index}>
        {day.date&&(()=>{
          const params=calendarNavigationQuery(new URLSearchParams(query));params.set('mes',month);params.set('periodo','mes');params.set('visualizacao','mes');params.set('dia',day.date);
          return <Link className={styles.dayLink} href={path+'?'+params+'#agenda-do-dia'} scroll={false} aria-current={selectedDay===day.date?'date':undefined} aria-label={day.date.split('-').reverse().join('/')+', '+day.entries.length+(day.entries.length===1?' etapa':' etapas')+(day.date===today?', hoje':'')}>
            <time dateTime={day.date} className={day.date===today?styles.today:undefined}>{Number(day.date.slice(-2))}</time>
            <span className={styles.dayCount}>{day.entries.length>0?day.entries.length+(day.entries.length===1?' etapa':' etapas'):'·'}</span>
          </Link>;
        })()}
      </td>)}</tr>)}</tbody>
    </table>
  </section>;
}
