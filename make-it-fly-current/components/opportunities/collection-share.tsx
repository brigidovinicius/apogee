'use client';
import {useState} from 'react';
import {CollectionMutationForm} from './collection-form';
import {shareCollectionAction} from '@/app/membros/colecoes/actions';
import styles from './collections.module.css';
export function CollectionShare({id,url}:{id:string;url:string|null}) {
 const [copied,setCopied]=useState(false);
 return <section className={styles.panel}><h2>Compartilhar coleção</h2><p>Qualquer pessoa com o link poderá ver nome, capa, descrição e os dados públicos dos eventos. O link pode ser encaminhado.</p>
   {url?<><label className={styles.linkField}>Link da coleção<input readOnly value={url} onFocus={e=>e.target.select()}/></label>
     <button type="button" onClick={async()=>{try{await navigator.clipboard.writeText(url);setCopied(true);}catch{setCopied(false);}}}>{copied?'Link copiado':'Copiar link'}</button>
     <CollectionMutationForm action={shareCollectionAction} label="Desativar compartilhamento"><input type="hidden" name="id" value={id}/><input type="hidden" name="enabled" value="false"/></CollectionMutationForm>
     <details><summary>Trocar o link</summary><p>O link anterior e o acesso dos seguidores por ele serão revogados.</p><CollectionMutationForm action={shareCollectionAction} label="Gerar outro link"><input type="hidden" name="id" value={id}/><input type="hidden" name="enabled" value="true"/><input type="hidden" name="rotate" value="true"/></CollectionMutationForm></details>
   </>:<><p>Revise o nome, a descrição e os eventos acima antes de compartilhar. Os requisitos e links protegidos continuam sujeitos às regras do Radar.</p><CollectionMutationForm action={shareCollectionAction} label="Ativar link de compartilhamento"><input type="hidden" name="id" value={id}/><input type="hidden" name="enabled" value="true"/></CollectionMutationForm></>}
 </section>;
}
