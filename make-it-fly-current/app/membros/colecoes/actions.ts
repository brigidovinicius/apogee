'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireCollectionMember,createCollection,updateCollection,archiveCollection,setCollectionItem,shareCollection } from '@/lib/opportunities/collections';
import { CollectionError } from '@/lib/opportunities/collection-types';
export type CollectionActionState={error?:string;success?:string};
const values=(form:FormData)=>({name:form.get('name'),description:form.get('description')??'',cover:form.get('cover')??'aurora'});
const failure=(error:unknown):CollectionActionState=>({error:error instanceof CollectionError?error.message:'Não foi possível concluir. Tente novamente.'});
export async function saveCollectionAction(_previous:CollectionActionState,form:FormData):Promise<CollectionActionState> {
 const id=String(form.get('id')??'');const member=await requireCollectionMember(id?'/membros/colecoes/'+id:'/membros/colecoes');
 let created:string|undefined;
 try {if(id)await updateCollection(member.id,id,values(form));else created=await createCollection(member.id,values(form));}catch(error){return failure(error);}
 revalidatePath('/membros/colecoes');if(created)redirect('/membros/colecoes/'+created);
 revalidatePath('/membros/colecoes/'+id);return {success:'Coleção atualizada.'};
}
export async function archiveCollectionAction(_previous:CollectionActionState,form:FormData):Promise<CollectionActionState> {
 const member=await requireCollectionMember();const id=String(form.get('id')??'');const archive=form.get('archived')!=='false';
 try {await archiveCollection(member.id,id,archive);}catch(error){return failure(error);}
 revalidatePath('/membros/colecoes');revalidatePath('/membros/colecoes/'+id);redirect('/membros/colecoes');
}
export async function collectionItemAction(_previous:CollectionActionState,form:FormData):Promise<CollectionActionState> {
 const id=String(form.get('collectionId')??'');const member=await requireCollectionMember('/membros/colecoes/'+id);
 try {await setCollectionItem(member.id,id,String(form.get('opportunityId')??''),form.get('present')!=='false');}catch(error){return failure(error);}
 revalidatePath('/membros/colecoes/'+id);revalidatePath('/membros/colecoes');
 return {success:form.get('present')==='false'?'Evento removido da coleção.':'Evento adicionado à coleção.'};
}
export async function shareCollectionAction(_previous:CollectionActionState,form:FormData):Promise<CollectionActionState> {
 const id=String(form.get('id')??'');const member=await requireCollectionMember('/membros/colecoes/'+id);
 try {await shareCollection(member.id,id,form.get('enabled')==='true',form.get('rotate')==='true');}catch(error){return failure(error);}
 revalidatePath('/membros/colecoes/'+id);return {success:form.get('enabled')==='true'?'Link de compartilhamento ativo.':'Compartilhamento desativado. O link anterior não funciona mais.'};
}
