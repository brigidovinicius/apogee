import {referenceCatalog,dossierHash} from '../src/corroboration.mjs';
export function dossierFixture(count=10,confirmed=count){
  const text='Documento sintético de teste. A equipe anunciou um experimento inicial. A análise independente discute limitações de método. Os resultados não representam validação clínica nem lançamento comercial.';
  const doc=(id,reference_id,url,kind)=>({id,reference_id,url,title:'Documento sintético para testes',published_at:'2026-11-09T12:00:00Z',text,content_hash:dossierHash(text),rights_reference:'fixture editorial autorizado',kind,publisher_key:referenceCatalog.find(r=>r.id===reference_id).publisher,origin_url:url,independence_note:kind==='independent'?'Análise própria de limitações metodológicas, conferida pelo editor.':'',same_event:true});
  const nasa=referenceCatalog.find(r=>r.publisher==='nasa'),space=referenceCatalog.find(r=>r.publisher==='space-com');
  const documents=[doc('E1',nasa.id,'https://www.nasa.gov/test-fixture/','primary'),doc('E2',space.id,'https://www.space.com/test-fixture/','independent')];
  const claims=Array.from({length:count},(_,i)=>({id:'C'+(i+1),text:'Afirmação sintética de número '+(i+1)+' para testar o cálculo.',critical:i===0,cells:documents.map(d=>({document_id:d.id,status:i<confirmed?'supports':'not_mentioned',quote:i<confirmed?'A equipe anunciou um experimento inicial.':'',note:''}))}));
  return {schema_version:1,event_key:'synthetic-event-fixture',category:'ciencia',subcategory:'aeroespacial',documents,claims};
}
