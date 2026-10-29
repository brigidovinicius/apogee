import { AREAS, isOpportunityCategory, type OpportunityCategory, type StudentOpportunity } from './types';

export { AREAS } from "./types";
export const SUBTYPES = { olimpiada:'Olimpíada científica', vestibular:'Vestibular', hackathon:'Hackathon', curso_online:'Curso online', escola_de_verao:'Escola de verão ou inverno', estagio:'Estágio' };
export type Stage = { id: string; name: string; kind: 'registration' | 'exam' | 'result' | 'enrollment' | 'event'; start: string; end?: string; sourceUrl?: string; checkedAt: string };
export type Discovery = { primaryType?: OpportunityCategory; subtype?: keyof typeof SUBTYPES; areas: (keyof typeof AREAS)[]; editions: { id: string; name: string; stages: Stage[] }[] };
const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const validDate = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value.slice(0,10)+'T12:00:00Z').toISOString().slice(0,10) === value.slice(0,10);
/** Validate the service boundary; malformed enrichment must not manufacture facts. */
export function readDiscovery(value: unknown): Discovery {
  const empty: Discovery = { areas: [], editions: [] };
  if (!record(value)) return empty;
  const areas = Array.isArray(value.areas) ? [...new Set(value.areas.filter(a => typeof a === 'string' && Object.hasOwn(AREAS,a)))] as Discovery['areas'] : [];
  const editions: Discovery['editions'] = [];
  for (const edition of Array.isArray(value.editions) ? value.editions.slice(0,10) : []) {
    if (!record(edition) || typeof edition.id !== 'string' || typeof edition.name !== 'string' || !Array.isArray(edition.stages)) continue;
    const stages: Stage[] = [];
    for (const stage of edition.stages.slice(0,30)) {
      if (!record(stage) || typeof stage.id !== 'string' || typeof stage.name !== 'string' || !['registration','exam','result','enrollment','event'].includes(String(stage.kind)) || !validDate(stage.start) || !validDate(stage.checkedAt) || !stage.checkedAt.includes('T') || Date.parse(stage.checkedAt)>Date.now()+60_000 || stage.end && (!validDate(stage.end) || (String(stage.end).length===10)!==(stage.start.length===10) || Date.parse(String(stage.end)) < Date.parse(stage.start))) continue;
      if (typeof stage.sourceUrl !== 'string' || !/^https:\/\//.test(stage.sourceUrl)) continue;
      stages.push({ id: stage.id, name: stage.name, kind: stage.kind as Stage['kind'], start: stage.start, ...(stage.end ? { end: stage.end as string } : {}), sourceUrl: stage.sourceUrl, checkedAt: stage.checkedAt });
    }
    editions.push({ id: edition.id, name: edition.name, stages });
  }
  return { ...(isOpportunityCategory(value.primaryType) ? { primaryType:value.primaryType } : {}), ...(typeof value.subtype==='string' && Object.hasOwn(SUBTYPES,value.subtype) ? { subtype:value.subtype as keyof typeof SUBTYPES } : {}), areas, editions };
}
export function displayOpportunityTitle(title: string) {
  return title.replace(/\s*\(EV\.G\)\s*$/iu,'').replace(/[,;·–—]\s*in[ií]cio\s+\d{4}-\d{2}-\d{2}\s*$/iu,'').trim() || title;
}
export function publicOpportunityPath(item: Pick<StudentOpportunity,'id'|'title'>) {
  const slug = displayOpportunityTitle(item.title).normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,90).replace(/-$/,'') || 'oportunidade';
  return `/oportunidades/${slug}--${item.id}`;
}
export function stageEnd(stage: Pick<Stage,'start'|'end'>) {
  const end = stage.end ?? stage.start;
  return Date.parse(end.length === 10 ? `${end}T23:59:59-03:00` : end);
}
export type CalendarEntry = { item: StudentOpportunity; edition: string; key: string; stage: Stage };
export type CalendarFeedEntry = Pick<CalendarEntry, "key" | "stage"> & { item: Pick<StudentOpportunity, "id" | "title"> };
export function calendarEntries(items: readonly StudentOpportunity[], now=Date.now()): CalendarEntry[] {
  const entries: CalendarEntry[] = [];
  const processes = new Set<string>();
  for (const item of items) {
    if (item.admissionProcess && processes.has(item.admissionProcess.id)) continue;
    if (item.admissionProcess) processes.add(item.admissionProcess.id);
    const stages = (item.discovery?.editions ?? []).flatMap(e => e.stages.map(stage => ({item,edition:e.name,key:`${item.id}:${e.id}:${stage.id}`,stage})));
    if (stages.length) entries.push(...stages.filter(e => stageEnd(e.stage)>=now));
    else {
      // Existing dates keep their distinct meanings; continuous courses have no invented event.
      const dates = [{id:'registration', name:'Encerramento das inscrições',kind:'registration' as const,start:item.deadlineAt ?? item.deadline}, {id:'event',name:'Início do evento',kind:'event' as const,start:item.eventStartsAt}];
      for (const date of dates) if (date.start && validDate(date.start) && stageEnd({start:date.start})>=now) entries.push({item,edition:'',key:`${item.id}:${date.id}`,stage:{...date,start:date.start,checkedAt:item.verificationTimestamp ?? item.verifiedAt}});
    }
  }
  const target = (e: CalendarEntry) => e.stage.kind === "registration" ? e.stage.end ?? e.stage.start : e.stage.start;
  return entries.sort((a,b)=>Date.parse(target(a))-Date.parse(target(b)) || a.key.localeCompare(b.key));
}
export const CALENDARS = [
  {slug:'olimpiadas-cientificas',name:'Olimpíadas científicas',description:'Inscrições, provas e resultados, com datas confirmadas.',matches:(i:StudentOpportunity)=>i.discovery?.subtype==='olimpiada'},
  {slug:'vestibulares',name:'Vestibulares',description:'Acompanhe inscrições e as próximas etapas dos processos seletivos.',matches:(i:StudentOpportunity)=>i.discovery?.subtype==='vestibular' || Boolean(i.admissionProcess || i.entranceExam)},
  {slug:'eventos',name:'Eventos e encontros',description:'Encontros e experiências com data para acontecer.',matches:(i:StudentOpportunity)=>i.categories?.includes('eventos')===true},
  {slug:'hackathons',name:'Hackathons',description:'Desafios para criar, aprender e participar em equipe.',matches:(i:StudentOpportunity)=>i.discovery?.subtype==='hackathon'},
] as const;
