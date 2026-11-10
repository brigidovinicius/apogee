import Link from 'next/link';
import { OpportunitySearchSuggestions } from './search-suggestions';
import { AREAS, EDUCATION_LEVELS, OPPORTUNITY_CATEGORIES, OPPORTUNITY_KINDS, dateInBrazil, type StudentOpportunity } from '@/lib/opportunities/types';
import { STAGE_LABELS, calendarFilterQuery, type CalendarFilters as FilterValues } from '@/lib/opportunities/calendar-filters';
import { CALENDARS } from '@/lib/opportunities/discovery';
import { SEARCH_CITIES_BY_STATE } from '@/lib/opportunities/location';
import { CalendarLocationFields } from './calendar-location-fields';
import { CalendarPeriodFields } from './calendar-period-fields';
import styles from './calendar.module.css';

export function CalendarFilters({filters,items,path,hidden={}}:{filters:FilterValues;items:readonly StudentOpportunity[];path:string;hidden?:Record<string,string>}) {
  const citiesByState:Record<string,string[]>=Object.fromEntries(Object.entries(SEARCH_CITIES_BY_STATE).map(([state,cities])=>[state,[...new Set([...cities,...items.filter(i=>i.stateCode===state).flatMap(i=>i.cityName?[i.cityName]:[])])].sort()]));
  const fields=[
    {name:'area',label:'Área',value:filters.area,options:Object.entries(AREAS)},
    {name:'categoria',label:'Categoria',value:filters.category,options:[...OPPORTUNITY_CATEGORIES.map(c=>[c.id,c.label]),['vestibular','Vestibular']]},
    {name:'modalidade',label:'Modalidade',value:filters.kind,options:OPPORTUNITY_KINDS.map(c=>[c,c])},
    {name:'formacao',label:'Formação',value:filters.level,options:EDUCATION_LEVELS.map(c=>[c,c])},
    {name:'abrangencia',label:'Abrangência',value:filters.scope,options:[['nacional','Participação de todo o Brasil']]},
    {name:'beneficio',label:'Condição financeira',value:filters.benefit,options:[['gratuito','Gratuito'],['remunerado','Com benefício financeiro'],['premiacao','Com premiação financeira'],['nao-remunerado','Não remunerado']]},
    {name:'prazo',label:'Prazo de inscrição',value:filters.deadlineWindow,options:[['abertas','Inscrições abertas'],['7dias','Encerramento em até 7 dias'],['30dias','Encerramento em até 30 dias'],['continuo','Fluxo contínuo'],['nao-informado','Prazo a anunciar']]},
    {name:'etapa',label:'Etapa',value:filters.stage,options:Object.entries(STAGE_LABELS)},
  ];
  const active=fields.filter(f=>f.value);
  const current=new URLSearchParams(hidden);
  for(const f of fields)if(f.value)current.set(f.name,f.value);
  for(const [key,value] of Object.entries({busca:filters.query,formato:filters.format,uf:filters.stateCode,cidade:filters.cityName,calendario:filters.calendar,periodo:filters.period,mes:filters.month,visualizacao:filters.view==='month'?'mes':undefined}))if(value)current.set(key,value);
  const href=(params:URLSearchParams)=>path+'?'+new URLSearchParams({...Object.fromEntries(new URLSearchParams(calendarFilterQuery(params))),...hidden});
  const chips=[...active.map(f=>({name:f.name,label:f.label+': '+(f.options.find(o=>o[0]===f.value)?.[1]??f.value)})),
    ...(filters.query?[{name:'busca',label:'Busca: '+filters.query}]:[]),
    ...(filters.format?[{name:'formato',label:'Formato: '+filters.format}]:[]),
    ...(filters.stateCode?[{name:'uf',label:'Estado: '+filters.stateCode}]:[]),
    ...(filters.cityName?[{name:'cidade',label:'Cidade: '+filters.cityName}]:[])];
  return <section aria-label="Filtros do calendário" className={styles.filterPanel}>
    <form data-behavior-filter="applied" key={JSON.stringify([filters,hidden])} action={path} className={styles.filterForm}>
      {Object.entries(hidden).map(([name,value])=><input type="hidden" key={name} name={name} value={value}/>)}
      {filters.view==='month'&&<input type="hidden" name="visualizacao" value="mes"/>}
      <div className={styles.filterPrimary}>
        <label className={styles.searchField}>Buscar evento, tema ou instituição<input type="search" name="busca" maxLength={100} list="calendar-search-suggestions" defaultValue={filters.query??''} placeholder="Ex.: Red Hat Summit, tecnologia, USP"/></label>
        <OpportunitySearchSuggestions id="calendar-search-suggestions" />
        <CalendarPeriodFields period={filters.period??(filters.month||filters.view==='month'?'mes':'proximas')} month={filters.month??dateInBrazil().slice(0,7)}/>
        <CalendarLocationFields initialState={filters.stateCode??''} initialCity={filters.cityName??''} citiesByState={citiesByState}/>
        <label>Formato<select name="formato" defaultValue={filters.format??''}><option value="">Todos os formatos</option><option value="online">Online</option><option value="presencial">Presencial</option><option value="hibrido">Híbrido</option></select></label>
      </div>
      <details className={styles.advancedFilters}><summary>Mais filtros{active.length?' ('+active.length+')':''}</summary><div className={styles.filterAdvanced}>
        {!hidden.calendario&&<label>Calendário<select name="calendario" defaultValue={filters.calendar??''}><option value="">Todos</option>{CALENDARS.map(c=><option key={c.slug} value={c.slug}>{c.name}</option>)}</select></label>}
        {fields.map(f=><label key={f.name}>{f.label}<select name={f.name} defaultValue={f.value??''}><option value="">Todas as opções</option>{f.options.map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label>)}
      </div></details>
      <div className={styles.filterActions}><button type="submit">Aplicar filtros</button><Link data-behavior-filter="cleared" href={path+(new URLSearchParams(hidden).size?'?'+new URLSearchParams(hidden):'')}>Limpar filtros</Link></div>
    </form>
    {!!chips.length&&<ul className={styles.filterChips} aria-label="Filtros aplicados">{chips.map(chip=>{
      const params=new URLSearchParams(current);params.delete(chip.name);if(chip.name==='uf')params.delete('cidade');
      return <li key={chip.name}><Link href={href(params)} aria-label={'Remover filtro '+chip.label}>{chip.label}<span aria-hidden> ×</span></Link></li>;
    })}</ul>}
    {(filters.stateCode||filters.cityName)&&<p className={styles.filterHint}>O recorte por local pode excluir eventos online ou sem cidade informada. Limpe a localização para vê-los.</p>}
  </section>;
}
