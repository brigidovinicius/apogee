'use server';
import {unsubscribeCollectionDigests} from '@/lib/opportunities/collection-following';
import type {CollectionActionState} from '@/app/membros/colecoes/actions';
export async function unsubscribeAction(_state:CollectionActionState,form:FormData):Promise<CollectionActionState> {
 try{await unsubscribeCollectionDigests(String(form.get('token')??''));return {success:'Resumos cancelados. Você pode continuar acompanhando suas coleções no site.'};}
 catch{return {error:'Não foi possível cancelar agora. Tente novamente ou acesse suas preferências na conta.'};}
}
