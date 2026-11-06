import Link from "next/link";
import { calendarEntries, displayOpportunityTitle, publicOpportunityPath, type CalendarEntry } from "@/lib/opportunities/discovery";
import { calendarEntryDate } from "@/lib/opportunities/calendar-filters";
import type { StudentOpportunity } from "@/lib/opportunities/types";
import { SaveOpportunityButton } from "./save-opportunity";
import styles from "./calendar.module.css";

export function CalendarList({ items, allStages = false, entries = calendarEntries(items), startDate, selectedDay }: { items: readonly StudentOpportunity[]; allStages?: boolean; entries?: readonly CalendarEntry[]; startDate?:string; selectedDay?:string }) {
  const seen = new Set<string>();
  const groups = new Map<string, CalendarEntry[]>();
  for (const entry of entries) {
    if (!allStages && seen.has(entry.item.id)) continue;
    seen.add(entry.item.id);
    const anchor=calendarEntryDate(entry);
    const day=selectedDay??(startDate&&anchor<startDate?startDate:anchor);
    groups.set(day, [...(groups.get(day) ?? []),entry]);
  }
  if (!groups.size) return <p className={styles.empty}>Nenhuma etapa confirmada neste dia. Escolha outro dia ou ajuste os filtros.</p>;
  return <div>{[...groups].sort(([a],[b])=>a.localeCompare(b)).map(([day,rows])=><section key={day} className={styles.month}><h2><time dateTime={day}>{formatCalendarDate(day)}</time></h2><ol className={styles.list}>
    {rows.map(({item,edition,key,stage})=><li key={key} className={styles.row}><div className={styles.rowContent}><p className={styles.meta}>{item.organization}{edition ? ' · '+edition : ""}</p>
      <h3><Link href={publicOpportunityPath(item)}>{displayOpportunityTitle(item.admissionProcess?.title ?? item.title)}</Link></h3>
      <p>{stage.name} · <time dateTime={stage.start}>{formatCalendarDate(stage.start)}</time>{stage.end ? <> a <time dateTime={stage.end}>{formatCalendarDate(stage.end)}</time></> : null}</p>
      <small>Fonte conferida em {formatCalendarDate(stage.checkedAt)}</small>
    </div><div className={styles.rowActions}><span className={styles.label}>{stage.kind==="registration"?"Inscrição":calendarEntryDate({item,key,edition,stage})<day?"Em andamento":"Acompanhamento"}</span><SaveOpportunityButton id={item.id} title={item.title}/></div></li>)}
  </ol></section>)}</div>;
}
export function formatCalendarDate(value:string) {
  return new Intl.DateTimeFormat("pt-BR",{day:"2-digit",month:"short",year:"numeric",timeZone:value.length===10?"UTC":"America/Sao_Paulo",...(value.length>10?{hour:"2-digit",minute:"2-digit"}:{})}).format(new Date(value));
}
