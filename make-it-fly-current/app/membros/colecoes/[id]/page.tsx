import Link from 'next/link';
import {notFound} from 'next/navigation';
import {MemberBar} from '@/components/members/member-bar';
import {CollectionForm,CollectionMutationForm} from '@/components/opportunities/collection-form';
import {CollectionShare} from '@/components/opportunities/collection-share';
import {CalendarView} from '@/components/opportunities/calendar-view';
import {CalendarSaveProvider} from '@/components/opportunities/save-opportunity';
import {calendarSaveState} from '@/lib/opportunities/personal-calendar';
import {requireCollectionMember,ownedCollection,collectionItems,collectionSharingEnabled} from '@/lib/opportunities/collections';
import {listRadarOpportunities} from '@/lib/opportunities/radar-client';
import {opportunityCardData} from '@/lib/opportunities/card-data';
import {readCalendarFilters} from '@/lib/opportunities/calendar-filters';
import {applicationOrigin} from '@/lib/members/mail';
import {archiveCollectionAction,collectionItemAction} from '../actions';
import styles from '@/components/opportunities/collections.module.css';
export const dynamic='force-dynamic';
export const metadata={title:'Minha coleção | Apogee',robots:{index:false,follow:false}};
export default async function CollectionPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}) {
 const {id}=await params;const path='/membros/colecoes/'+id;const member=await requireCollectionMember(path);
 const collection=await ownedCollection(member.id,id);if(!collection)notFound();
 const refs=await collectionItems(id),ids=new Set(refs.map(r=>r.id));
 const live=await listRadarOpportunities(true).catch(()=>null);
 const items=live?.filter(i=>ids.has(i.id)).map(opportunityCardData)??[];
 const query=await searchParams;const q=new URLSearchParams(Object.entries(query).flatMap(([k,v])=>typeof v==='string'?[[k,v]]:[]));
 const filters=readCalendarFilters(q);const search=String(query.busca??'').trim().slice(0,100);
 const candidates=live?.filter(i=>!ids.has(i.id)&&(!search||(i.title+' '+i.organization).toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')))).slice(0,24)??[];
 const saveState=await calendarSaveState(items.map(i=>i.id),path);
 return <main className={styles.page}><MemberBar member={member} current="radar"/><Link href="/membros/colecoes">← Minhas coleções</Link><div className={styles.cover+' '+styles[collection.cover]}/><span className={styles.badge}>{collection.visibility==='private'?'Privada':'Compartilhada por link'}</span><h1>{collection.name}</h1><p>{collection.description}</p>
 <details className={styles.details}><summary>Editar nome, descrição e capa</summary><CollectionForm collection={collection}/></details>
 {live?<CalendarSaveProvider key={JSON.stringify([path,saveState])} state={saveState} returnTo={path}><CalendarView items={items} filters={filters} path={path} query={q.toString()}/></CalendarSaveProvider>:<p role="alert">Catálogo temporariamente indisponível. Seus eventos continuam na coleção.</p>}
 <h2>Eventos escolhidos ({refs.length})</h2><ul className={styles.list}>{refs.map(ref=><li className={styles.item} key={ref.id}><div>{items.find(i=>i.id===ref.id)?.title??ref.title}{live&&!items.some(i=>i.id===ref.id)&&<p>Indisponível no catálogo atual.</p>}</div><CollectionMutationForm action={collectionItemAction} label="Remover da coleção"><input type="hidden" name="collectionId" value={id}/><input type="hidden" name="opportunityId" value={ref.id}/><input type="hidden" name="present" value="false"/></CollectionMutationForm></li>)}</ul>
 <h2>Adicionar eventos</h2><form action={path} className={styles.toolbar}><label>Buscar no catálogo<input type="search" name="busca" maxLength={100} defaultValue={search}/></label><button type="submit">Buscar eventos</button></form>
 <ul className={styles.list}>{candidates.map(item=><li className={styles.item} key={item.id}><div><strong>{item.title}</strong><p>{item.organization}</p></div><CollectionMutationForm action={collectionItemAction} label="Adicionar à coleção"><input type="hidden" name="collectionId" value={id}/><input type="hidden" name="opportunityId" value={item.id}/></CollectionMutationForm></li>)}</ul>{live&&!candidates.length&&<p>Nenhum evento disponível para adicionar nesta busca.</p>}{candidates.length===24&&<p>Mostrando até 24 resultados. Refine a busca para encontrar outro evento.</p>}
 {collectionSharingEnabled()&&<CollectionShare id={id} url={collection.shareToken?applicationOrigin()+'/colecoes/'+collection.shareToken:null}/>}
 <details className={styles.details}><summary>Arquivar coleção</summary><p>Os itens serão preservados para restauração. O compartilhamento será desativado; sua agenda pessoal continua disponível.</p><CollectionMutationForm action={archiveCollectionAction} label="Arquivar coleção"><input type="hidden" name="id" value={id}/><input type="hidden" name="archived" value="true"/></CollectionMutationForm></details>
 </main>;
}
