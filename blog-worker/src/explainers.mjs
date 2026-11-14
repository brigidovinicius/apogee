import catalog from '../../make-it-fly-current/lib/blog/explainer-catalog.json' with {type:'json'};
import {referenceUrl,validateDossier,dossierHash,buildComparisonRequest,isEvidenceGapClaim} from './corroboration.mjs';
import {referenceForUrl,primaryReference,ARTICLE_EXTRACTION_VERSION} from './article-research.mjs';
import {TOPICS,topicKey} from './automatic-research.mjs';
import {fail,hash,periodKeys} from './policy.mjs';

export function validateExplainerCatalog(plans=catalog){
  if(!Array.isArray(plans)||plans.length>200||new Set(plans.map(p=>p.key)).size!==plans.length)fail('invalid_explainer_catalog');
  for(const p of plans){
    if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.key)||p.key.length<8||p.key.length>100
      ||!TOPICS.some(t=>topicKey(t)===topicKey(p))||typeof p.question!=='string'||p.question.length<20||p.question.length>220
      ||!Array.isArray(p.terms)||p.terms.length<1||p.terms.length>12||p.terms.some(t=>typeof t!=='string'||!t.trim()||t.length>80)
      ||!Array.isArray(p.urls)||p.urls.length<2||p.urls.length>4||new Set(p.urls).size!==p.urls.length)fail('invalid_explainer_catalog');
    const refs=p.urls.map(url=>referenceForUrl(referenceUrl(url)));
    if(refs.some(r=>!r)||!primaryReference(refs[0])||new Set(refs.map(r=>r.publisher)).size!==refs.length)fail('invalid_explainer_sources');
  }
  return plans;
}
export const explainerCatalog=Object.freeze(validateExplainerCatalog());
export const explainerId=plan=>hash('explainer:'+plan.key);
export const EXPLAINER_RECOVERY_REASONS=Object.freeze(['compatibility_below_90','critical_fact_unresolved']);
export function explainerRecoveryEligible(c){
  return !!c&&!c.post_id&&c.has_dossier&&EXPLAINER_RECOVERY_REASONS.includes(c.reason)
    &&c.attempts===1&&c.comparisons===1&&!c.pending&&!c.text_attempts&&!c.assessment?.eligible
    &&(!c.document||c.document.claims.some(v=>v.critical&&!isEvidenceGapClaim(v.text)));
}
export const explainerEvidenceHash=d=>dossierHash(d.documents.map(v=>({id:v.id,url:v.url,title:v.title,
  published_at:v.published_at,text:v.text,rights_reference:v.rights_reference,kind:v.kind,
  origin_url:v.origin_url,same_event:v.same_event,same_subject:v.same_subject,independence_note:v.independence_note})));
export function explainerWindowOpen(policy,at=new Date()){
  return policy.automatic_explainers_enabled===true&&Number(new Intl.DateTimeFormat('en-US',{timeZone:'America/Sao_Paulo',hour:'2-digit',hourCycle:'h23'}).format(at))>=policy.explainer_after_local_hour;
}
export function nextExplainer(plans,usage,existing,at=new Date()){
  const byKey=new Map(existing.map(c=>[c.explainer_key,c]));
  const eligible=plans.filter(p=>{
    if(usage.some(u=>topicKey(u)===topicKey(p)&&(u.day>=1||u.week>=7)))return false;
    const c=byKey.get(p.key);if(!c)return true;
    const r=c.artifact?.research;
    const recovery=explainerRecoveryEligible(c);
    return !c.post_id&&((!c.first_attempt_day&&!c.has_dossier)||recovery)&&!['operator_hold','retention','source_changed_after_reservation'].includes(c.reason)
      &&(!r?.next_at||Date.parse(r.next_at)<=+at)&&!(r?.day===periodKeys(at).day&&r.tries>=(recovery?1:3));
  });
  return eligible.find(p=>!byKey.get(p.key)?.has_dossier)??eligible[0]??null;
}
// A contiguous context window, selected by the editorial subject, never by
// whether sentences agree. Exact originals, offset and source dates are kept.
export function explainerExcerpt(text,terms,bytes){
  const lower=text.toLowerCase(),starts=[0];
  for(const term of terms){let from=0;for(let n=0;n<20;n++){
    const index=lower.indexOf(term.toLowerCase(),from);if(index<0)break;from=index+term.length;
    const boundary=Math.max(0,text.lastIndexOf('. ',Math.max(0,index-160))+2);starts.push(boundary===1?0:boundary);
  }}
  let best;
  for(const start of new Set(starts)){
    let end=Math.min(text.length,start+bytes);
    while(Buffer.byteLength(text.slice(start,end))>bytes)end--;
    if(end<text.length){const boundary=text.lastIndexOf('. ',end);if(boundary>start+80)end=boundary+1;}
    const value=text.slice(start,end).trimEnd();if(value.length<200)continue;
    const found=terms.filter(t=>value.toLowerCase().includes(t.toLowerCase())).length;
    if(!best||found>best.found)best={text:value,excerpt_offset:[...text.slice(0,start)].length,found};
  }
  // Redirects and incomplete shells may return readable text about a different
  // subject. Do not spend a comparison on an unrelated 200 response.
  if(!best||best.found<Math.min(2,terms.length))return null;
  return {text:best.text,excerpt_offset:best.excerpt_offset};
}
export function automaticExplainerDossier(plan,captures,policy,at=new Date(),{previousCriticalClaims=[]}={}){
  const chosen=plan.urls.map(url=>captures.find(s=>(referenceUrl(s.url)===referenceUrl(url)||s.requested_url===url)
    &&s.extraction_method==='public_article'&&s.extraction_version===ARTICLE_EXTRACTION_VERSION
    &&Number.isFinite(Date.parse(s.checked_at??s.captured_at))&&Date.parse(s.checked_at??s.captured_at)<=+at
    &&+at-Date.parse(s.checked_at??s.captured_at)<86400000));
  if(chosen.some(s=>!s))return null;
  if(new Set(chosen.map(s=>referenceForUrl(s.url)?.publisher)).size!==chosen.length)return null;
  if(new Set(chosen.map(s=>s.text.normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim())).size!==chosen.length)return null;
  // Use the largest contiguous context that fits the existing request ceiling.
  // A fixed short excerpt can omit definitions and qualifications in long guides.
  for(let total=8500;total>=1500;total-=500){
    const documents=chosen.map((s,i)=>{
      const excerpt=explainerExcerpt(s.text,plan.terms,Math.floor(total/chosen.length));if(!excerpt)return null;
      const ref=referenceForUrl(s.url);
      return {id:'E'+(i+1),reference_id:ref.id,capture_id:s.capture_id??hash(s),title:s.title,url:referenceUrl(s.url,ref),published_at:s.published_at,
        ...excerpt,content_hash:dossierHash(excerpt.text),rights_reference:s.rights_reference,kind:i===0?'primary':'independent',evidence_scope:s.evidence_scope??'public_article',
        origin_url:referenceUrl(s.url),same_event:false,same_subject:true,consulted_at:new Date(s.checked_at??s.captured_at).toISOString(),
        independence_note:i===0?'Guia primário público da instituição responsável; data original e trecho contíguo preservados.':'Guia elaborado por outra instituição/autoria sobre o conceito. A comparação deve verificar independência, contexto, limites e fatos comuns. Não é cobertura de um mesmo anúncio nem replicação experimental.'};
    });
    if(documents.some(d=>!d))continue;
    const d=validateDossier({schema_version:1,event_key:'explainer:'+plan.key,category:plan.category,subcategory:plan.subcategory,
      editorial:{kind:'explainer',key:plan.key,question:plan.question,as_of:at.toISOString()},documents,claims:[],
      ...(previousCriticalClaims.length?{previous_critical_claims:previousCriticalClaims}:{})});
    try{buildComparisonRequest(d,policy);}catch{continue;}
    return d;
  }
  return null;
}
