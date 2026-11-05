'use client';
import {CollectionMutationForm} from './collection-form';
import {collectionItemAction} from '@/app/membros/colecoes/actions';
import Link from 'next/link';
import styles from './collections.module.css';
export function AddToCollection({id,collections}:{id:string;collections:{id:string;name:string}[]}) {
 return <details className={styles.addControl}><summary>Adicionar à coleção</summary>{collections.length?<CollectionMutationForm action={collectionItemAction} label="Adicionar">
 <input type="hidden" name="opportunityId" value={id}/><label>Coleção<select name="collectionId" required>{collections.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
 </CollectionMutationForm>:<p><Link href="/membros/colecoes">Criar minha primeira coleção</Link></p>}</details>;
}
