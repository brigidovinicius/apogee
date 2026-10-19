import {updateProfile as realUpdate, type FormState} from '../../app/membros/actions';
import {record,pause} from './transport.mjs';
export async function updateProfile(state:FormState, form:FormData):Promise<FormState> {
  record('profile-attempt'); await pause();
  try { return await realUpdate(state,form); }
  catch(error) {
    if(error instanceof Error && error.message==='REVIEW_WRITE_BLOCKED') return {message:'Simulação concluída: perfil válido. Nenhum dado foi salvo.',values:Object.fromEntries([...form].map(([k,v])=>[k,String(v)]))};
    throw error;
  }
}
