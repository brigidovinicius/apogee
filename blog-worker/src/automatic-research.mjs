import {referenceCatalog,referenceUrl,validateDossier,dossierHash,buildComparisonRequest} from './corroboration.mjs';

const independent=new Set(['REF01','REF02','REF03','REF05','REF06','REF15','REF27','REF37','REF38','REF39','REF42','REF43','REF44','EXT_VIA_SATELLITE']);
export function sourceReference(id){return referenceCatalog.find(r=>r.id===({SRC01:'REF22',SRC02:'REF22',SRC03:'REF22'}[id]??id));}
export function researchTopic(c){
  const t=(c.title+' '+c.evidence.map(e=>e.text).join(' ')).normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();
  if(/neuro|brain|cerebr|alzheimer/.test(t))return {category:'ciencia',subcategory:'neurociencia'};
  if(/robot|robo\b|hardware|semiconductor|chip\b|processor/.test(t))return {category:'tecnologia',subcategory:'hardware-robotica'};
  if(/marketing|advertis|campanha|publicidade/.test(t))return {category:'negocios',subcategory:'marketing'};
  if(/startup|empreendedor|venture|acquisit|acquire|aquisicao/.test(t))return {category:'negocios',subcategory:'empreendedorismo-startups'};
  if(/enterprise|business|contrat|commercial|comercial|mercado|negocios|economia/.test(t))return {category:'negocios',subcategory:null};
  if(c.editoria==='ia')return {category:'tecnologia',subcategory:'ia'};
  if(c.editoria==='startups')return {category:'negocios',subcategory:null};
  if(c.editoria==='ciencia-espaco')return {category:'ciencia',subcategory:/nasa|mars|marte|spacecraft|lunar|orbit|rocket|foguete/.test(t)?'aeroespacial':null};
  return {category:'tecnologia',subcategory:/software|application|aplicativo|ferramenta|browser/.test(t)?'software-ferramentas':null};
}
export const evidenceDois=text=>new Set((text.match(/\b10\.\d{4,9}\/[a-z0-9._;()/:+-]+/gi)??[]).map(v=>v.replace(/[.,;)]+$/,'').toLowerCase()));
// Pair only an exact DOI or an explicit article-to-article reference. Similar
// titles, generic home-page links and popularity never establish the event.
export function sameResearchEvent(a,b){
  if(Math.abs(Date.parse(a.published_at)-Date.parse(b.published_at))>3*86400000)return false;
  const u=referenceUrl(a.url),v=referenceUrl(b.url);
  if((a.related_urls??[]).includes(v)||(b.related_urls??[]).includes(u))return true;
  const dois=evidenceDois(a.text);return [...evidenceDois(b.text)].some(d=>dois.has(d));
}
function prefix(text,bytes){
  // A declared, contiguous opening excerpt. The complete captured snapshot is
  // immutable and remains accessible to the editor. Never join distant quotes.
  if(Buffer.byteLength(text)<=bytes)return text;
  const sentences=text.match(/[^.!?]+[.!?](?:\s+|$)/g)??[];let result='';
  for(const s of sentences){if(Buffer.byteLength(result+s)>bytes)break;result+=s;}
  return result.trim();
}
export function automaticDossier(candidate,captures,policy){
  const own=captures.find(s=>s.url===candidate.url&&s.source_id===candidate.source_id);
  const ref=sourceReference(candidate.source_id);
  if(!own||!ref||!(ref.role.startsWith('institucional')||/entrevista exclusiva|exclusive interview|interviewed by|entrevistou/i.test(own.text)))return null;
  const rows=[own,...captures.filter(s=>s.capture_id!==own.capture_id&&sameResearchEvent(own,s))];
  const pubs=new Set(),chosen=[];
  for(const s of rows){
    const r=sourceReference(s.source_id);if(!r||pubs.has(r.publisher))continue;
    if(s!==own&&!independent.has(r.id))continue;
    const original=String(s.text??'');if(original.length<200)continue;
    // Exact republications never become a second independent analysis.
    if(chosen.some(x=>x.text.normalize('NFKC').toLowerCase()===original.normalize('NFKC').toLowerCase()))continue;
    pubs.add(r.publisher);chosen.push({...s,ref:r});
  }
  if(chosen.length<2||chosen.length>10)return null;
  const budget=Math.floor(3000/chosen.length);
  const documents=chosen.map((s,i)=>{
    const text=prefix(s.text,budget);if(text.length<80)return null;
    return {id:'E'+(i+1),reference_id:s.ref.id,capture_id:s.capture_id,title:s.title,url:referenceUrl(s.url,s.ref),published_at:s.published_at,
      text,content_hash:dossierHash(text),rights_reference:s.rights_reference,kind:i===0?'primary':'independent',origin_url:referenceUrl(s.url),same_event:true,
      independence_note:i===0?'Fonte primária institucional ou apuração de primeira mão explicitamente identificada; snapshot integral preservado.':'Associação automática por DOI ou referência explícita. Publicação jornalística distinta; o comparador deve rejeitar mera reprodução de release. Não representa replicação científica nem conferência humana.'};
  });
  if(documents.some(d=>!d))return null;
  const dossier=validateDossier({schema_version:1,event_key:own.url,...researchTopic(candidate),documents,claims:[]});
  try{buildComparisonRequest(dossier,policy);}catch{return null;}
  return dossier;
}
