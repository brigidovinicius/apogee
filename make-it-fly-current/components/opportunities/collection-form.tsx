'use client';
import { useActionState,type ReactNode } from 'react';
import { COLLECTION_COVERS,type CalendarCollection } from '@/lib/opportunities/collection-types';
import { saveCollectionAction,type CollectionActionState } from '@/app/membros/colecoes/actions';
import styles from './collections.module.css';
export function CollectionForm({collection}:{collection?:CalendarCollection}) {
 const [state,action,pending]=useActionState(saveCollectionAction,{});
 return <form action={action} className={styles.form}>
   {collection&&<input type="hidden" name="id" value={collection.id}/>}
   <label>Nome da coleção<input name="name" required maxLength={80} defaultValue={collection?.name} placeholder="Tecnologia em Florianópolis"/></label>
   <label>Descrição <span>(opcional)</span><textarea name="description" maxLength={500} rows={3} defaultValue={collection?.description}/></label>
   <fieldset><legend>Capa</legend><div className={styles.coverChoices}>{Object.entries(COLLECTION_COVERS).map(([id,name])=><label className={styles.coverChoice} key={id}><input type="radio" name="cover" value={id} defaultChecked={id===(collection?.cover??'aurora')}/><span className={styles[id]}>{name}</span></label>)}</div></fieldset>
   <p className={styles.hint}>Os eventos são escolhidos por você. A coleção começa privada.</p>
   <button type="submit" disabled={pending}>{pending?'Salvando…':collection?'Salvar alterações':'Criar coleção privada'}</button>
   {state.error&&<p role="alert">{state.error}</p>}{state.success&&<p role="status">{state.success}</p>}
 </form>;
}
export function CollectionMutationForm({action,children,label}:{action:(state:CollectionActionState,form:FormData)=>Promise<CollectionActionState>;children:ReactNode;label:string}) {
 const [state,formAction,pending]=useActionState(action,{});
 return <form action={formAction} className={styles.mutation}>{children}<button type="submit" disabled={pending}>{pending?'Aguarde…':label}</button>{state.error&&<p role="alert">{state.error}</p>}{state.success&&<p role="status">{state.success}</p>}</form>;
}
