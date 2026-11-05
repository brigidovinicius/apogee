import { dateInBrazil, filterOpportunities, opportunityFiltersFromSearchParams, setOpportunityFilterSearchParams, type OpportunityFilters, type StudentOpportunity } from './types';
import { CALENDARS, type CalendarEntry, type Stage } from './discovery';

export const STAGE_LABELS = { registration:'Inscrições', exam:'Provas', result:'Resultados', enrollment:'Matrículas', event:'Realização' } as const;
export const CALENDAR_PERIODS = { proximas:'Próximas datas', hoje:'Hoje', '7dias':'Próximos 7 dias', '30dias':'Próximos 30 dias', mes:'Escolher mês' } as const;
export type CalendarPeriod = keyof typeof CALENDAR_PERIODS;
export type CalendarFilters = OpportunityFilters & { month?:string; view:'month'|'list'; stage?:Stage['kind']; calendar?:string; period?:CalendarPeriod; day?:string };
const validMonth = (value:string) => /^20\d{2}-(0[1-9]|1[0-2])$/.test(value);
export function validCalendarDate(value:string) {
  return /^20\d{2}-(0[1-9]|1[0-2])-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
}
export function readCalendarFilters(params:URLSearchParams):CalendarFilters {
  const rawPeriod=params.get('periodo')??'';
  const period=Object.hasOwn(CALENDAR_PERIODS,rawPeriod)?rawPeriod as CalendarPeriod:undefined;
  const relative=period&&period!=='mes';
  const month=!relative&&validMonth(params.get('mes')??'')?params.get('mes')!:undefined;
  const day=params.get('dia')??'';
  const stage=params.get('etapa')??'';
  return { ...opportunityFiltersFromSearchParams(params), view:!relative&&params.get('visualizacao')==='mes'?'month':'list',
    ...(month?{month}:{}), ...(period?{period}:{}),
    ...(validCalendarDate(day)&&(!month||day.startsWith(month))&&!relative?{day}:{}),
    ...(CALENDARS.some(c=>c.slug===params.get('calendario'))?{calendar:params.get('calendario')!}:{}),
    ...(Object.hasOwn(STAGE_LABELS,stage)?{stage:stage as Stage['kind']}:{}) };
}
/** Saved searches preserve relative periods, but never a selected day or unrelated URL. */
export function calendarFilterQuery(params:URLSearchParams) {
  const filters=readCalendarFilters(params);
  const query=setOpportunityFilterSearchParams(new URLSearchParams(),filters);
  if(filters.stage)query.set('etapa',filters.stage);
  if(filters.calendar)query.set('calendario',filters.calendar);
  if(filters.period)query.set('periodo',filters.period);
  if(filters.month)query.set('mes',filters.month);
  if(filters.view==='month')query.set('visualizacao','mes');
  return query.toString();
}
export function calendarNavigationQuery(params:URLSearchParams) {
  const query=new URLSearchParams(calendarFilterQuery(params));
  if(params.get('catalogo')==='1')query.set('catalogo','1');
  const {day}=readCalendarFilters(params);
  if(day)query.set('dia',day);
  return query;
}
export function filterCalendarItems(items:readonly StudentOpportunity[],filters:CalendarFilters,now=Date.now()) {
  const calendar=CALENDARS.find(c=>c.slug===filters.calendar);
  return filterOpportunities(items,filters,dateInBrazil(new Date(now)),true,true,now,true).filter(i=>!calendar||calendar.matches(i));
}
export function calendarEntryDate(entry:CalendarEntry) {
  return civilDate(entry.stage.kind==='registration'?entry.stage.end??entry.stage.start:entry.stage.start);
}
function civilDate(value:string) { return value.length===10?value:dateInBrazil(new Date(value)); }
export function calendarEntryOverlaps(entry:CalendarEntry,start:string,end:string) {
  const first=calendarEntryDate(entry);
  const last=entry.stage.kind==='registration'?first:civilDate(entry.stage.end??entry.stage.start);
  return first<=end&&last>=start;
}
export function shiftCalendarDate(date:string,days:number) {
  const value=new Date(date+'T12:00:00Z'); value.setUTCDate(value.getUTCDate()+days); return value.toISOString().slice(0,10);
}
export function shiftCalendarMonth(month:string,offset:number) {
  if(!validMonth(month))throw Error('Mês inválido');
  const value=new Date(month+'-01T12:00:00Z'); value.setUTCMonth(value.getUTCMonth()+offset);
  const next=value.toISOString().slice(0,7); return validMonth(next)?next:null;
}
export function calendarPeriodRange(filters:CalendarFilters,today=dateInBrazil()) {
  const period=filters.period??(filters.month||filters.view==='month'?'mes':'proximas');
  if(period==='mes') {
    const month=filters.month??today.slice(0,7);
    const last=new Date(Number(month.slice(0,4)),Number(month.slice(5)),0).getDate();
    return {start:month+'-01',end:month+'-'+String(last).padStart(2,'0')};
  }
  return {start:today,end:period==='hoje'?today:period==='7dias'?shiftCalendarDate(today,6):period==='30dias'?shiftCalendarDate(today,29):'2099-12-31'};
}
export function filterCalendarEntries(entries:readonly CalendarEntry[],filters:CalendarFilters,today=dateInBrazil()) {
  const range=calendarPeriodRange(filters,today);
  return entries.filter(e=>(!filters.stage||e.stage.kind===filters.stage)&&calendarEntryOverlaps(e,range.start,range.end));
}
export function calendarMonthDays(entries:readonly CalendarEntry[],month:string) {
  if(!validMonth(month))throw Error('Mês inválido');
  const start=new Date(month+'-01T12:00:00Z');
  const offset=(start.getUTCDay()+6)%7;
  const count=new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+1,0)).getUTCDate();
  const total=Math.ceil((offset+count)/7)*7;
  return Array.from({length:total},(_,i)=>{
    const day=i-offset+1;
    const date=day>0&&day<=count?month+'-'+String(day).padStart(2,'0'):null;
    return {date,entries:date?entries.filter(e=>calendarEntryOverlaps(e,date,date)):[]};
  });
}
