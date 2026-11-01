import Link from 'next/link';
import { AREAS, EDUCATION_LEVELS, OPPORTUNITY_CATEGORIES, OPPORTUNITY_KINDS, type StudentOpportunity } from '@/lib/opportunities/types';
import { STAGE_LABELS, type CalendarFilters as FilterValues } from '@/lib/opportunities/calendar-filters';
import { CALENDARS } from '@/lib/opportunities/discovery';
import { SEARCH_CITIES_BY_STATE } from '@/lib/opportunities/location';
import { CalendarLocationFields } from './calendar-location-fields';
import styles from './calendar.module.css';

export function CalendarFilters({filters,items,path,hidden={}}:{filters:FilterValues;items:readonly StudentOpportunity[];path:string;hidden?:Record<string,string>}) {
  const citiesByState:Record<string,string[]>=Object.fromEntries(Object.entries(SEARCH_CITIES_BY_STATE).map(([state,cities])=>[state,[...new Set([...cities,...items.filter(i=>i.stateCode===state).flatMap(i=>i.cityName?[i.cityName]:[])])].sort()]));
  return <form key={JSON.stringify([filters,hidden])} action={path} className={styles.filters}>
    {Object.entries(hidden).map(([name,value])=><input type="hidden" key={name} name={name} value={value}/>)}
    {!hidden.calendario&&<label>Calendário<select name="calendario" defaultValue={filters.calendar??''}><option value="">Todos</option>{CALENDARS.map(c=><option key={c.slug} value={c.slug}>{c.name}</option>)}</select></label>}
    <label>Palavra-chave<input type="search" name="busca" maxLength={100} defaultValue={filters.query??''}/></label>
    <label>Área<select name="area" defaultValue={filters.area??''}><option value="">Todas as áreas</option>{Object.entries(AREAS).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
    <label>Categoria<select name="categoria" defaultValue={filters.category??''}><option value="">Todas as categorias</option>{OPPORTUNITY_CATEGORIES.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}<option value="vestibular">Vestibular</option></select></label>
    <label>Modalidade<select name="modalidade" defaultValue={filters.kind??''}><option value="">Todas</option>{OPPORTUNITY_KINDS.map(c=><option key={c}>{c}</option>)}</select></label>
    <label>Formação<select name="formacao" defaultValue={filters.level??''}><option value="">Todas</option>{EDUCATION_LEVELS.map(c=><option key={c}>{c}</option>)}</select></label>
    <label>Formato<select name="formato" defaultValue={filters.format??''}><option value="">Todos</option><option value="online">Online</option><option value="presencial">Presencial</option><option value="hibrido">Híbrido</option></select></label>
    <CalendarLocationFields key={`${filters.stateCode??''}:${filters.cityName??''}`} initialState={filters.stateCode??''} initialCity={filters.cityName??''} citiesByState={citiesByState}/>
    <label>Abrangência<select name="abrangencia" defaultValue={filters.scope??''}><option value="">Todas</option><option value="nacional">Participação de todo o Brasil</option></select></label>
    <label>Condição financeira<select name="beneficio" defaultValue={filters.benefit??''}><option value="">Todas</option><option value="gratuito">Gratuito</option><option value="remunerado">Com benefício financeiro</option><option value="premiacao">Com premiação financeira</option><option value="nao-remunerado">Não remunerado</option></select></label>
    <label>Inscrições<select name="prazo" defaultValue={filters.deadlineWindow??''}><option value="">Todas as situações</option><option value="abertas">Abertas</option><option value="7dias">Prazo em até 7 dias</option><option value="30dias">Prazo em até 30 dias</option><option value="continuo">Fluxo contínuo</option><option value="nao-informado">Prazo a anunciar</option></select></label>
    <label>Etapa<select name="etapa" defaultValue={filters.stage??''}><option value="">Todas as etapas</option>{Object.entries(STAGE_LABELS).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
    <label>Visualização<select name="visualizacao" defaultValue={filters.view==='month'?'mes':'lista'}><option value="lista">Próximas etapas</option><option value="mes">Mês</option></select></label>
    <label>Mês<input name="mes" type="month" min="2000-01" max="2099-12" defaultValue={filters.month??''}/></label>
    <button type="submit">Aplicar filtros</button><Link href={path+(new URLSearchParams(hidden).size?'?'+new URLSearchParams(hidden):'')}>Limpar</Link>
  </form>;
}
