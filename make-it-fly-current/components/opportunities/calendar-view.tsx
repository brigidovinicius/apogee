import Link from 'next/link';
import { calendarEntries,publicOpportunityPath } from '@/lib/opportunities/discovery';
import { calendarEntryDate,type CalendarFilters } from '@/lib/opportunities/calendar-filters';
import { dateInBrazil,type StudentOpportunity } from '@/lib/opportunities/types';
import { CalendarList } from './calendar-list';
import { CalendarMonth } from './calendar-month';
import styles from './calendar.module.css';
export function CalendarView({items,filters}:{items:readonly StudentOpportunity[];filters:CalendarFilters}) {
  const entries=calendarEntries(items);
  const month=filters.month??dateInBrazil().slice(0,7);
  const period=filters.month??(filters.view==='month'?month:undefined);
  const visible=entries.filter(e=>(!filters.stage||e.stage.kind===filters.stage)&&(!period||calendarEntryDate(e).startsWith(period)));
  const undated=items.filter(i=>!entries.some(e=>e.item.id===i.id)&&!i.admissionProcess);
  return <>
    <p role="status">{visible.length} etapas encontradas neste recorte.</p>
    {filters.view==='month'?<CalendarMonth entries={visible} month={month}/>:visible.length>0?<CalendarList items={items} entries={visible} allStages/>:null}
    {!visible.length&&<p className={styles.empty}>Nenhuma etapa para estes filtros. Ajuste o período ou use Limpar.</p>}
    {undated.length>0&&<section><h2>Próxima data a anunciar</h2><ul>{undated.map(i=><li key={i.id}><Link href={publicOpportunityPath(i)}>{i.title}</Link></li>)}</ul><p>As oportunidades aparecem no mês quando uma próxima data for confirmada.</p></section>}
  </>;
}
