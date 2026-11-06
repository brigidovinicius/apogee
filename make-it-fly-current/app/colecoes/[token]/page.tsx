import Link from 'next/link';
import {notFound} from 'next/navigation';
import {sharedCollection,collectionPublicItems,collectionFollowingEnabled} from '@/lib/opportunities/collections';
import {CalendarView} from '@/components/opportunities/calendar-view';
import {readCalendarFilters} from '@/lib/opportunities/calendar-filters';
import styles from '@/components/opportunities/collections.module.css';
export const dynamic='force-dynamic';
export const metadata={title:'Coleção de eventos | Apogee',robots:{index:false,follow:false},referrer:'no-referrer'};
export default async function SharedCollectionPage({params,searchParams}:{params:Promise<{token:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}) {
 const {token}=await params;const collection=await sharedCollection(token);if(!collection)notFound();
 const items=await collectionPublicItems(collection.id).catch(()=>null);
 const query=await searchParams;const q=new URLSearchParams(Object.entries(query).flatMap(([k,v])=>typeof v==='string'?[[k,v]]:[]));
 return <main className={styles.page}><Link href="/calendarios">Apogee · Calendários</Link><div className={styles.cover+' '+styles[collection.cover]}/><span className={styles.badge}>Coleção compartilhada por link</span><h1>{collection.name}</h1><p>{collection.description}</p><p>Uma seleção de eventos. Confira os detalhes de cada oportunidade para conhecer as regras de participação.</p>
 {collectionFollowingEnabled()&&<p><Link href={'/membros/colecoes/seguir/'+token}>Acompanhar coleção</Link></p>}
 {items?<CalendarView items={items} filters={readCalendarFilters(q)} path={'/colecoes/'+token} query={q.toString()}/>:<p role="alert">Catálogo temporariamente indisponível. Tente novamente em instantes.</p>}
 </main>;
}
