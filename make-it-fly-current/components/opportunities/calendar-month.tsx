import Link from 'next/link';
import { calendarMonthDays, calendarEntryDate, STAGE_LABELS } from '@/lib/opportunities/calendar-filters';
import { publicOpportunityPath, type CalendarEntry } from '@/lib/opportunities/discovery';
import styles from './calendar.module.css';
export function CalendarMonth({entries,month}:{entries:readonly CalendarEntry[];month:string}) {
  const label=new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(month+'-01T12:00:00Z'));
  const days=calendarMonthDays(entries,month);
  return <section aria-label={`Calendário de ${label}`}>
    <h2>{label}</h2><p>Inscrições aparecem na data de encerramento; as demais etapas, na data de início. A lista mostra os intervalos completos.</p>
    <div className={styles.calendarScroll}><table className={styles.monthGrid}><caption className={styles.srOnly}>{label}</caption>
      <thead><tr>{['Segunda','Terça','Quarta','Quinta','Sexta','Sábado','Domingo'].map(day=><th scope="col" key={day}>{day}</th>)}</tr></thead>
      <tbody>{Array.from({length:days.length/7},(_,week)=><tr key={week}>{days.slice(week*7,week*7+7).map((day,index)=><td key={day.date??`empty-${index}`}>
        {day.date&&<><time dateTime={day.date}>{Number(day.date.slice(-2))}</time><ul>{day.entries.map(entry=><li key={entry.key}><small>{STAGE_LABELS[entry.stage.kind]}</small><Link href={publicOpportunityPath(entry.item)}>{entry.item.title}</Link><span className={styles.srOnly}>{calendarEntryDate(entry)}</span></li>)}</ul></>}
      </td>)}</tr>)}</tbody>
    </table></div>
  </section>;
}
