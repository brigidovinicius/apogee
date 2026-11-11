import {referenceCatalog,referenceUrl,validateDossier,dossierHash,buildComparisonRequest,taxonomy} from './corroboration.mjs';
import {primaryReference,independentReference} from './article-research.mjs';

export function sourceReference(id){const key=String(id).replace(/^ARTICLE_/,'');return referenceCatalog.find(r=>r.id===({SRC01:'REF22',SRC02:'REF22',SRC03:'REF22'}[key]??key));}
export const TOPICS=Object.freeze(Object.entries(taxonomy).flatMap(([category,v])=>Object.keys(v.subcategories).map(subcategory=>({category,subcategory}))).concat(Object.keys(taxonomy).map(category=>({category,subcategory:null}))));
export const topicKey=t=>t.category+'/'+(t.subcategory??'geral');
export function researchTopic(c){
  const assigned=c.artifact?.research?.topic;
  if(assigned&&TOPICS.some(t=>topicKey(t)===topicKey(assigned)))return assigned;
  const t=(c.title+' '+(c.evidence??[]).map(e=>e.text).join(' ')).normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();
  if(/em promocao|veja uma selecao|onde assistir|escalacao|horoscopo|cupons|filmes para/.test(t))return null;
  const ref=sourceReference(c.source_id);
  if(ref?.id==='REF15')return {category:'ciencia',subcategory:'neurociencia'};
  if(/neuro|brain|cerebr|alzheimer/.test(t))return {category:'ciencia',subcategory:'neurociencia'};
  if(/robot|robo\b|hardware|semiconductor|chip\b|processor/.test(t))return {category:'tecnologia',subcategory:'hardware-robotica'};
  if(/marketing|advertis|campanha|publicidade/.test(t))return {category:'negocios',subcategory:'marketing'};
  if(/startup|empreendedor|venture|acquisit|acquire|aquisicao/.test(t))return {category:'negocios',subcategory:'empreendedorismo-startups'};
  if(/nasa|mars\b|marte\b|spacecraft|lunar|orbit|rocket|foguete|astronom|espaciais/.test(t)||ref?.id==='REF27')return {category:'ciencia',subcategory:'aeroespacial'};
  if(/\bai\b|\bia\b|artificial intelligence|inteligencia artificial|chatgpt|gemini|openai|llm/.test(t)||c.editoria==='ia')return {category:'tecnologia',subcategory:'ia'};
  if(/software|application|aplicativo|ferramenta|browser|navegador|sistema operacional/.test(t))return {category:'tecnologia',subcategory:'software-ferramentas'};
  if(/enterprise|business|contrat|commercial|comercial|mercado|negocios|economia/.test(t))return {category:'negocios',subcategory:null};
  if(c.editoria==='ia')return {category:'tecnologia',subcategory:'ia'};
  if(c.editoria==='startups')return /empres|financ|econom|mercado|industr|invest|trabalho|carreira|negoci|consumidor|produto/.test(t)?{category:'negocios',subcategory:null}:null;
  if(c.editoria==='ciencia-espaco')return {category:'ciencia',subcategory:/nasa|mars|marte|spacecraft|lunar|orbit|rocket|foguete/.test(t)?'aeroespacial':null};
  return {category:'tecnologia',subcategory:/software|application|aplicativo|ferramenta|browser/.test(t)?'software-ferramentas':null};
}
export function balancedResearchCandidates(rows,usage=[],limit=30){
  const pools=TOPICS.map(topic=>({topic,rows:rows.filter(c=>{const t=researchTopic(c);return t&&t.category===topic.category&&(topic.subcategory===null||t.subcategory===topic.subcategory);})}));
  const selected=[],seen=new Set();
  for(let round=0;round<limit&&selected.length<limit;round++)for(const pool of pools){
    if(usage.some(u=>u.category===pool.topic.category&&u.subcategory===pool.topic.subcategory&&u.day>=1))continue;
    const candidate=pool.rows.find(c=>!seen.has(c.id));if(!candidate)continue;
    seen.add(candidate.id);selected.push({candidate,topic:pool.topic});if(selected.length===limit)break;
  }
  return selected;
}
export const evidenceDois=text=>new Set((text.match(/\b10\.\d{4,9}\/[a-z0-9._;()/:+-]+/gi)??[]).map(v=>v.replace(/[.,;)]+$/,'').toLowerCase()));
// Pair only an exact DOI or an explicit article-to-article reference. Similar
// titles, generic home-page links and popularity never establish the event.
export function sameResearchEvent(a,b){
  if(a.published_at&&b.published_at&&Math.abs(Date.parse(a.published_at)-Date.parse(b.published_at))>7*86400000)return false;
  const u=referenceUrl(a.url),v=referenceUrl(b.url);
  if((a.related_urls??[]).includes(v)||(b.related_urls??[]).includes(u))return true;
  const dois=evidenceDois(a.text+' '+(a.doi??'')+' '+(a.related_urls??[]).join(' '));return [...evidenceDois(b.text+' '+(b.doi??'')+' '+(b.related_urls??[]).join(' '))].some(d=>dois.has(d));
}
function prefix(text,bytes){
  // A declared, contiguous opening excerpt. The complete captured snapshot is
  // immutable and remains accessible to the editor. Never join distant quotes.
  if(Buffer.byteLength(text)<=bytes)return text.trimEnd();
  let end=0;
  // Slice the original prefix, rather than concatenating regex matches: dots in
  // decimals, DOIs and adjacent punctuation must never remove intervening text.
  for(const match of text.matchAll(/[.!?](?=\s|$)/g)){
    const next=match.index+1;if(Buffer.byteLength(text.slice(0,next))>bytes)break;end=next;
  }
  return text.slice(0,end).trimEnd();
}
export function automaticDossier(candidate,captures,policy,topic=researchTopic(candidate)){
  const ref=sourceReference(candidate.source_id);
  const own=captures.find(s=>referenceUrl(s.url)===referenceUrl(candidate.url)&&sourceReference(s.source_id)?.publisher===ref?.publisher);
  if(!topic||!own||!ref||!(primaryReference(ref)||/entrevista exclusiva|exclusive interview|interviewed by|entrevistou/i.test(own.text)))return null;
  const rows=[own,...captures.filter(s=>s.capture_id!==own.capture_id&&sameResearchEvent(own,s))];
  const pubs=new Set(),chosen=[];
  for(const s of rows){
    const r=sourceReference(s.source_id);if(!r||pubs.has(r.publisher))continue;
    if(s!==own&&!independentReference(r))continue;
    const original=String(s.text??'');if(original.length<200)continue;
    // Exact republications never become a second independent analysis.
    if(chosen.some(x=>x.text.normalize('NFKC').toLowerCase()===original.normalize('NFKC').toLowerCase()))continue;
    pubs.add(r.publisher);chosen.push({...s,ref:r});if(chosen.length===Math.min(10,policy.max_primary_evidence_documents))break;
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
  const dossier=validateDossier({schema_version:1,event_key:own.url.length<=180?own.url:'url-sha256:'+dossierHash(own.url),...topic,documents,claims:[]});
  try{buildComparisonRequest(dossier,policy);}catch{return null;}
  return dossier;
}
