import Link from 'next/link';
import { SiteHeader } from '@/components/site/site-header';
import { SiteFooter } from '@/components/site/site-footer';
import { SeriesAlert } from '@/components/opportunities/series-alert';
import { listRadarSeries } from '@/lib/opportunities/radar-series-client';
import styles from '@/components/opportunities/calendar.module.css';
export const dynamic='force-dynamic';
export const metadata={title:'Acompanhar competições | Apogee',description:'Acompanhe próximas edições de olimpíadas e competições verificadas.',alternates:{canonical:'/competicoes'}};
export default async function SeriesPage({searchParams}:{searchParams:Promise<{busca?:string}>}) {
  const query=await searchParams;
  const search=typeof query.busca==='string'?query.busca.trim().slice(0,100):'';
  const normalize=(v:string)=>v.normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('pt-BR');
  const all=await listRadarSeries().catch(()=>null);
  const visible=all?.filter(s=>normalize(s.name+' '+s.organizer).includes(normalize(search)));
  return <div className={styles.page}><SiteHeader current="opportunities"/><main className={styles.main}>
    <div className={styles.hero}><Link href="/calendarios">Calendários de oportunidades</Link><h1>Acompanhe o próximo salto.</h1><p>As competições continuam aqui entre edições. Receba um aviso quando novas inscrições forem confirmadas.</p><Link href="/oportunidades?prazo=abertas">Ver oportunidades abertas</Link></div>
    <form className={styles.filters}><label>Competição ou organizador<input type="search" name="busca" maxLength={100} defaultValue={search}/></label><button type="submit">Buscar</button><Link href="/competicoes">Limpar</Link></form>
    {!visible?<p role="alert">Acompanhamento temporariamente indisponível. Tente novamente em instantes.</p>:<><p>{visible.length} competições verificadas para acompanhar.</p><div className={styles.grid}>{visible.map(series=><article className={styles.tile} key={series.id}><h2>{series.name}</h2><p>{series.organizer}</p><p>{series.checkStatus==='checked'?'Fonte consultada':series.checkStatus==='not_checked'?'Primeira consulta agendada':'Consulta temporariamente indisponível; novas tentativas agendadas'}</p>{series.lastCheckedAt&&<small>Última consulta: {new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'}).format(new Date(series.lastCheckedAt))}</small>}<SeriesAlert id={series.id} name={series.name} available={series.alertsAvailable}/></article>)}</div></>}
  </main><SiteFooter/></div>;
}
