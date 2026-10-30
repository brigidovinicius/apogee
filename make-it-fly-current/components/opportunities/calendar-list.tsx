import Link from "next/link";
import { calendarEntries, displayOpportunityTitle, publicOpportunityPath, type CalendarEntry } from "@/lib/opportunities/discovery";
import type { StudentOpportunity } from "@/lib/opportunities/types";
import styles from "./calendar.module.css";

export function CalendarList({ items, allStages = false }: { items: readonly StudentOpportunity[]; allStages?: boolean }) {
  const entries = calendarEntries(items);
  const seen = new Set<string>();
  const groups = new Map<string, CalendarEntry[]>();
  for (const entry of entries) {
    if (!allStages && seen.has(entry.item.id)) continue;
    seen.add(entry.item.id);
    const target = entry.stage.kind === "registration" ? entry.stage.end ?? entry.stage.start : entry.stage.start;
    const month = new Intl.DateTimeFormat("pt-BR", {month:"long",year:"numeric",timeZone:target.length===10?"UTC":"America/Sao_Paulo"}).format(new Date(target));
    groups.set(month, [...(groups.get(month) ?? []),entry]);
  }
  if (!groups.size) return <p className={styles.empty}>Nenhuma próxima etapa confirmada neste recorte. Novas datas aparecerão quando forem verificadas na fonte oficial.</p>;
  return <div>{[...groups].map(([month,rows])=><section key={month} className={styles.month}><h2>{month}</h2><ol className={styles.list}>
    {rows.map(({item,edition,key,stage})=><li key={key} className={styles.row}><div><p className={styles.meta}>{item.organization}{edition ? ` · ${edition}` : ""}</p>
      <h3><Link href={publicOpportunityPath(item)}>{displayOpportunityTitle(item.admissionProcess?.title ?? item.title)}</Link></h3>
      <p>{stage.name} · <time dateTime={stage.start}>{formatCalendarDate(stage.start)}</time>{stage.end ? <> a <time dateTime={stage.end}>{formatCalendarDate(stage.end)}</time></> : null}</p>
      <small>Fonte conferida em {formatCalendarDate(stage.checkedAt)}</small>
    </div><span className={styles.label}>{stage.kind==="registration"?"Inscrição":"Acompanhamento"}</span></li>)}
  </ol></section>)}</div>;
}
export function formatCalendarDate(value:string) {
  return new Intl.DateTimeFormat("pt-BR",{day:"2-digit",month:"short",year:"numeric",timeZone:value.length===10?"UTC":"America/Sao_Paulo",...(value.length>10?{hour:"2-digit",minute:"2-digit"}:{})}).format(new Date(value));
}
