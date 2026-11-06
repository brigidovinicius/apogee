import Link from 'next/link';
import {notFound} from 'next/navigation';
import {requireSignedInMember} from '@/lib/members/dal';
import {MemberBar} from '@/components/members/member-bar';
import {CollectionMutationForm} from '@/components/opportunities/collection-form';
import {collectionsEnabled,collectionDigestsEnabled} from '@/lib/opportunities/collections';
import {followedCollections} from '@/lib/opportunities/collection-following';
import {unfollowCollectionAction,collectionDigestAction} from '../follow-actions';
import styles from '@/components/opportunities/collections.module.css';
export const dynamic='force-dynamic';
export const metadata={title:'Coleções acompanhadas | Apogee',robots:{index:false,follow:false}};
export default async function FollowedPage() {
 if(!collectionsEnabled())notFound();
 const member=await requireSignedInMember('/membros/colecoes/acompanhadas');
 const follows=await followedCollections(member.id);
 return <main className={styles.page}><MemberBar member={member} current="radar"/><Link href="/membros/colecoes">← Minhas coleções</Link><h1>Coleções acompanhadas</h1>
 <p>Acompanhar uma coleção não adiciona seus eventos à sua agenda. Os resumos por e-mail são opcionais: até um por semana, apenas quando houver novidades.</p>
 {!follows.length&&<p>Abra o link de uma coleção e escolha “Acompanhar coleção” para encontrá-la aqui.</p>}
 <ul className={styles.list}>{follows.map(f=><li className={styles.cardContent} key={f.id}><h2>{f.token?<Link href={'/colecoes/'+f.token}>{f.name}</Link>:f.name}</h2><p>{f.description}</p>
 {!f.available&&<p>O compartilhamento mudou ou foi desativado. Peça um novo link ao responsável pela coleção.</p>}
 {f.available&&(collectionDigestsEnabled()||f.digestEnabled)&&<CollectionMutationForm action={collectionDigestAction} label={f.digestEnabled?'Desativar resumo semanal':'Ativar resumo semanal'}><input type="hidden" name="id" value={f.id}/><input type="hidden" name="enabled" value={String(!f.digestEnabled)}/>
 {!f.digestEnabled&&<label className={styles.consent}><input type="checkbox" name="consent" value="weekly-v1" required/>Quero receber por e-mail novidades e mudanças desta coleção, em um resumo semanal. Posso cancelar a qualquer momento.</label>}
 <p>Resumo semanal: {f.digestEnabled?'ativado':'desativado'}</p></CollectionMutationForm>}
 <CollectionMutationForm action={unfollowCollectionAction} label="Deixar de acompanhar"><input type="hidden" name="id" value={f.id}/></CollectionMutationForm></li>)}</ul></main>;
}
