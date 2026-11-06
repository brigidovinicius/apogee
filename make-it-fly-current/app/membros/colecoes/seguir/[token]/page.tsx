import Link from 'next/link';
import {notFound} from 'next/navigation';
import {collectionFollowingEnabled,requireCollectionMember,sharedCollection} from '@/lib/opportunities/collections';
import {followedCollections} from '@/lib/opportunities/collection-following';
import {CollectionMutationForm} from '@/components/opportunities/collection-form';
import {followCollectionAction} from '../../follow-actions';
import styles from '@/components/opportunities/collections.module.css';
export const dynamic='force-dynamic';
export const metadata={title:'Acompanhar coleção | Apogee',robots:{index:false,follow:false},referrer:'no-referrer'};
export default async function FollowPage({params}:{params:Promise<{token:string}>}) {
 if(!collectionFollowingEnabled())notFound();
 const {token}=await params;const collection=await sharedCollection(token);if(!collection)notFound();
 const member=await requireCollectionMember('/membros/colecoes/seguir/'+token);
 const following=(await followedCollections(member.id)).some(f=>f.id===collection.id&&f.available);
 return <main className={styles.page}><Link href={'/colecoes/'+token}>← Voltar à coleção</Link><h1>{collection.name}</h1><p>Encontre esta seleção em suas coleções acompanhadas. Acompanhar não ativa e-mails nem adiciona eventos à sua agenda.</p>
 {following?<p>Você já acompanha esta coleção. <Link href="/membros/colecoes/acompanhadas">Gerenciar acompanhamento</Link></p>:<CollectionMutationForm action={followCollectionAction} label="Confirmar acompanhamento"><input type="hidden" name="token" value={token}/></CollectionMutationForm>}</main>;
}
