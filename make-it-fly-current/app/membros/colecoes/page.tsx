import Link from 'next/link';
import {MemberBar} from '@/components/members/member-bar';
import {CollectionForm,CollectionMutationForm} from '@/components/opportunities/collection-form';
import {requireCollectionMember,listOwnedCollections,collectionFollowingEnabled} from '@/lib/opportunities/collections';
import {archiveCollectionAction} from './actions';
import styles from '@/components/opportunities/collections.module.css';
export const dynamic='force-dynamic';
export const metadata={title:'Minhas coleções | Apogee',robots:{index:false,follow:false}};
export default async function CollectionsPage() {
 const member=await requireCollectionMember();
 const collections=await listOwnedCollections(member.id),archived=await listOwnedCollections(member.id,true);
 return <main className={styles.page}><MemberBar member={member} current="radar"/><Link href="/membros/meu-calendario">← Minha agenda</Link><h1>Minhas coleções</h1><p>Organize eventos em seleções pessoais. Adicionar à coleção não altera sua agenda nem o Google Agenda.</p>
 {collectionFollowingEnabled()&&<p><Link href="/membros/colecoes/acompanhadas">Coleções acompanhadas e resumos</Link></p>}
 <div className={styles.grid}>{collections.map(c=><article key={c.id} className={styles.card}><div className={styles.cover+' '+styles[c.cover]}/><div className={styles.cardContent}><h2><Link href={'/membros/colecoes/'+c.id}>{c.name}</Link></h2><p>{c.description}</p><span className={styles.badge}>{c.visibility==='private'?'Privada':'Compartilhada por link'}</span><p>{c.itemCount} {c.itemCount===1?'oportunidade':'oportunidades'}</p></div></article>)}</div>
 {!collections.length&&<p>Você ainda não criou uma coleção.</p>}<h2>Criar coleção</h2><CollectionForm/>
 {!!archived.length&&<details className={styles.details}><summary>Coleções arquivadas ({archived.length})</summary><ul className={styles.list}>{archived.map(c=><li key={c.id} className={styles.item}><span>{c.name}</span><CollectionMutationForm action={archiveCollectionAction} label="Restaurar como privada"><input type="hidden" name="id" value={c.id}/><input type="hidden" name="archived" value="false"/></CollectionMutationForm></li>)}</ul></details>}
 </main>;
}
