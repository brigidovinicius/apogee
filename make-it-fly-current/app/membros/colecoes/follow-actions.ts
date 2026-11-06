'use server';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {requireSignedInMember} from '@/lib/members/dal';
import {requireCollectionMember} from '@/lib/opportunities/collections';
import {followCollection,unfollowCollection,setCollectionDigest} from '@/lib/opportunities/collection-following';
import {CollectionError} from '@/lib/opportunities/collection-types';
import type {CollectionActionState} from './actions';
const path='/membros/colecoes/acompanhadas';
const failure=(error:unknown)=>({error:error instanceof CollectionError?error.message:'Não foi possível concluir. Tente novamente.'});
export async function followCollectionAction(_state:CollectionActionState,form:FormData):Promise<CollectionActionState> {
 const token=String(form.get('token')??'');const member=await requireCollectionMember('/membros/colecoes/seguir/'+token);
 try{await followCollection(member.id,token);}catch(error){return failure(error);}
 revalidatePath(path);redirect(path);
}
export async function unfollowCollectionAction(_state:CollectionActionState,form:FormData):Promise<CollectionActionState> {
 const member=await requireSignedInMember(path);
 try{await unfollowCollection(member.id,String(form.get('id')??''));}catch(error){return failure(error);}
 revalidatePath(path);return {success:'Você deixou de acompanhar a coleção.'};
}
export async function collectionDigestAction(_state:CollectionActionState,form:FormData):Promise<CollectionActionState> {
 const enabled=form.get('enabled')==='true';
 const member=enabled?await requireCollectionMember(path):await requireSignedInMember(path);
 if(enabled&&form.get('consent')!=='weekly-v1')return {error:'Marque a autorização para receber o resumo semanal.'};
 try{await setCollectionDigest(member.id,String(form.get('id')??''),enabled);}catch(error){return failure(error);}
 revalidatePath(path);return {success:enabled?'Resumo semanal ativado.':'Resumo semanal desativado.'};
}
