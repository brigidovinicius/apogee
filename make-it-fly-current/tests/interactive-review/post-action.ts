import {saveBlogPost as realSave, type EditorState} from '../../app/admin/posts/actions';
import {record,pause} from './transport.mjs';
export async function saveBlogPost(id:number|null,state:EditorState,form:FormData):Promise<EditorState> {
  record('editor-attempt',{intent:String(form.get('intent')),category:String(form.get('category'))}); await pause();
  try { return await realSave(id,state,form); }
  catch(error) {
    if(error instanceof Error && error.message==='REVIEW_WRITE_BLOCKED') return {message:'Simulação concluída: dados válidos. Gravação, publicação e agendamento bloqueados.',values:Object.fromEntries([...form].map(([k,v])=>[k,String(v)]))};
    throw error;
  }
}
