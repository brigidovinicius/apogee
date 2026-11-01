import { dateInBrazil, filterOpportunities, opportunityFiltersFromSearchParams, setOpportunityFilterSearchParams, type OpportunityFilters, type StudentOpportunity } from './types';
import { CALENDARS, type CalendarEntry, type Stage } from './discovery';

export const STAGE_LABELS = { registration:'Inscrições', exam:'Provas', result:'Resultados', enrollment:'Matrículas', event:'Realização' } as const;
export type CalendarFilters = OpportunityFilters & { month?:string; view:'month'|'list'; stage?:Stage['kind']; calendar?:string };
export function readCalendarFilters(params:URLSearchParams):CalendarFilters {
  const month=params.get('mes') ?? '';
  const stage=params.get('etapa') ?? '';
  return { ...opportunityFiltersFromSearchParams(params), view:params.get('visualizacao')==='mes'?'month':'list',
    ...(/^20\d{2}-(0[1-9]|1[0-2])$/.test(month)?{month}:{}),
    ...(CALENDARS.some(c=>c.slug===params.get('calendario'))?{calendar:params.get('calendario')!}:{}),
    ...(Object.hasOwn(STAGE_LABELS,stage)?{stage:stage as Stage['kind']}:{}) };
}
/** Keep the chosen period/view, rejecting unrelated URLs and pagination. */
export function calendarFilterQuery(params:URLSearchParams) {
  const filters=readCalendarFilters(params);
  const query=setOpportunityFilterSearchParams(new URLSearchParams(),filters);
  if(filters.stage)query.set('etapa',filters.stage);
  if(filters.calendar)query.set('calendario',filters.calendar);
  if(filters.month)query.set('mes',filters.month);
  if(filters.view==='month')query.set('visualizacao','mes');
  return query.toString();
}
export function filterCalendarItems(items:readonly StudentOpportunity[],filters:CalendarFilters,now=Date.now()) {
  // Calendar stages remain useful when registration has closed.
  const calendar=CALENDARS.find(c=>c.slug===filters.calendar);
  return filterOpportunities(items,filters,dateInBrazil(new Date(now)),true,true,now,true).filter(i=>!calendar||calendar.matches(i));
}
export function calendarEntryDate(entry:CalendarEntry) {
  const target=entry.stage.kind==='registration'?entry.stage.end??entry.stage.start:entry.stage.start;
  return target.length===10?target:dateInBrazil(new Date(target));
}
export function calendarMonthDays(entries:readonly CalendarEntry[],month:string) {
  if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month))throw Error('Mês inválido');
  const start=new Date(`${month}-01T12:00:00Z`);
  const offset=(start.getUTCDay()+6)%7;
  const count=new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+1,0)).getUTCDate();
  const total=Math.ceil((offset+count)/7)*7;
  return Array.from({length:total},(_,i)=>{
    const day=i-offset+1;
    const date=day>0&&day<=count?`${month}-${String(day).padStart(2,'0')}`:null;
    return {date,entries:date?entries.filter(e=>calendarEntryDate(e)===date):[]};
  });
}
