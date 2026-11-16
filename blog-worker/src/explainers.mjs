import catalog from '../../make-it-fly-current/lib/blog/explainer-catalog.json' with {type:'json'};
import {referenceUrl,validateDossier,dossierHash,buildComparisonRequest,isEvidenceGapClaim} from './corroboration.mjs';
import {referenceForUrl,primaryReference,ARTICLE_EXTRACTION_VERSION} from './article-research.mjs';
import {TOPICS,topicKey} from './automatic-research.mjs';
import {fail,hash,periodKeys} from './policy.mjs';
import {topicAvailable} from '../../make-it-fly-current/lib/blog/editorial-plan.mjs';

export function validateExplainerCatalog(plans=catalog){
  if(!Array.isArray(plans)||plans.length>200||new Set(plans.map(p=>p.key)).size!==plans.length)fail('invalid_explainer_catalog');
  for(const p of plans){
    if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.key)||p.key.length<8||p.key.length>100
      ||!TOPICS.some(t=>topicKey(t)===topicKey(p))||typeof p.question!=='string'||p.question.length<20||p.question.length>220
      ||!Array.isArray(p.terms)||p.terms.length<1||p.terms.length>12||p.terms.some(t=>typeof t!=='string'||!t.trim()||t.length>80)
      ||!Array.isArray(p.urls)||p.urls.length<2||p.urls.length>6||new Set(p.urls).size!==p.urls.length)fail('invalid_explainer_catalog');
    const refs=p.urls.map(url=>referenceForUrl(referenceUrl(url)));
    if(refs.some(r=>!r)||!primaryReference(refs[0])||new Set(refs.map(r=>r.publisher)).size!==refs.length)fail('invalid_explainer_sources');
    if(p.additional_sources!==undefined){
      if(!Array.isArray(p.additional_sources)||p.additional_sources.length>3)fail('invalid_explainer_sources');
      for(const source of p.additional_sources){
        const ref=referenceForUrl(source.url);
        if(!ref||!['primary','independent','context','derivative'].includes(source.kind)||typeof source.independence_note!=='string'||source.independence_note.length<20||source.independence_note.length>1000
          ||!Array.isArray(source.terms)||source.terms.length<1||source.terms.length>12||source.terms.some(t=>typeof t!=='string'||!t||t.length>80))fail('invalid_explainer_sources');
        referenceUrl(source.origin_url);referenceUrl(source.url,ref);
      }
    }
    if(p.provenance!==undefined){
      if(!Array.isArray(p.provenance)||p.provenance.length!==p.urls.length||p.provenance[0]?.kind!=='primary'
        ||!p.provenance.some(v=>v?.kind==='independent'))fail('invalid_explainer_provenance');
      for(const v of p.provenance){
        if(!v||!['primary','independent','derivative','context'].includes(v.kind)||typeof v.independence_note!=='string'
          ||v.independence_note.length<20||v.independence_note.length>1000)fail('invalid_explainer_provenance');
        referenceUrl(v.origin_url);
        if(v.kind==='independent'&&referenceUrl(v.origin_url)===referenceUrl(p.provenance[0].origin_url))fail('invalid_explainer_provenance');
      }
    }
  }
  return plans;
}
export const explainerCatalog=Object.freeze(validateExplainerCatalog());
export const explainerId=plan=>hash('explainer:'+plan.key);
export const EXPLAINER_RECOVERY_REASONS=Object.freeze(['compatibility_below_90','critical_fact_unresolved','independence_unverified']);
export function explainerRecoveryEligible(c){
  return !!c&&!c.post_id&&c.has_dossier&&EXPLAINER_RECOVERY_REASONS.includes(c.reason)
    &&(c.attempts===1&&c.comparisons===1||c.attempts===2&&c.comparisons===2&&c.format_failures===1)&&!c.pending&&!c.text_attempts&&!c.assessment?.eligible
    &&(!c.document||c.document.claims.some(v=>v.critical&&!isEvidenceGapClaim(v.text)));
}
export const explainerEvidenceHash=d=>dossierHash(d.documents.map(v=>({id:v.id,url:v.url,title:v.title,
  published_at:v.published_at,text:v.text,rights_reference:v.rights_reference,kind:v.kind,
  origin_url:v.origin_url,same_event:v.same_event,same_subject:v.same_subject,independence_note:v.independence_note})));
export function explainerWindowOpen(policy,at=new Date()){
  return policy.automatic_explainers_enabled===true&&Number(new Intl.DateTimeFormat('en-US',{timeZone:'America/Sao_Paulo',hour:'2-digit',hourCycle:'h23'}).format(at))>=policy.explainer_after_local_hour;
}
export function nextExplainer(plans,usage,existing,at=new Date(),policy=null){
  const byKey=new Map(existing.map(c=>[c.explainer_key,c]));
  const eligible=plans.filter(p=>{
    if(!topicAvailable(policy,usage,p,at))return false;
    const c=byKey.get(p.key);if(!c)return true;
    const r=c.artifact?.research;
    const recovery=explainerRecoveryEligible(c);
    return !c.post_id&&((!c.first_attempt_day&&!c.has_dossier)||recovery)&&!['operator_hold','retention','source_changed_after_reservation'].includes(c.reason)
      &&(!r?.next_at||Date.parse(r.next_at)<=+at)&&!(recovery?r?.recovery_day===periodKeys(at).day&&r.recovery_tries>=3:r?.day===periodKeys(at).day&&r.tries>=3);
  });
  return eligible.find(p=>explainerRecoveryEligible(byKey.get(p.key)))??eligible.find(p=>!byKey.get(p.key)?.has_dossier)??eligible[0]??null;
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
export function expandExplainerSources(plan,captures){
 const urls=[...plan.urls],provenance=plan.urls.map((url,i)=>plan.provenance?.[i]??{kind:i===0?'primary':'independent',origin_url:url,independence_note:i===0?'Guia primário público da instituição responsável.':'Guia elaborado por outra autoria; verificar independência, contexto e limites.'});
 const candidates=[...(plan.additional_sources??[]),...captures.filter(c=>plan.urls.includes(c.url)||plan.urls.includes(c.requested_url)).flatMap(c=>(c.related_urls??[]).map(url=>({url})))];
 const publishers=new Set(urls.map(url=>referenceForUrl(url)?.publisher)),source_terms={};
 for(const extra of candidates){
  if(urls.length>=Math.min(6,plan.urls.length+2))break;
  const ref=referenceForUrl(extra.url);if(!ref||urls.includes(referenceUrl(extra.url))||publishers.has(ref.publisher)||!extra.kind&&!primaryReference(ref))continue;
  const url=referenceUrl(extra.url,ref);urls.push(url);publishers.add(ref.publisher);
  provenance.push({kind:extra.kind??'primary',origin_url:extra.origin_url??url,independence_note:extra.independence_note??'Fonte primária explicitamente ligada ao assunto; autoria, contexto e limitações serão novamente comparados.'});
  source_terms[url]=extra.terms??plan.terms;
 }
 return {...plan,urls,provenance,source_terms};
}
export function editorialAttemptLimit(policy,dossier,attempts=[]){
 const recovery=dossier?.recovery;
 if(policy.provider!=='google_subscription'||policy.schema_version!==3||policy.max_provider_attempts_per_article_including_repairs!==3||recovery?.maximum_editorial_attempts!==4)return policy.max_provider_attempts_per_article_including_repairs;
 const valid=attempts.find(a=>a.id===recovery.comparison_attempt_id&&a.kind==='comparison'&&a.state==='confirmed'&&!a.reason);
 const format=attempts.find(a=>a.id===recovery.prior_format_attempt_id&&a.kind==='comparison'&&a.state==='confirmed'&&['invalid_structure','invalid_comparison','invalid_claim','invalid_claim_cell','invalid_dossier','duplicate_claim','quote_not_in_document','invalid_quote_reference'].includes(a.reason));
 return valid&&format&&valid.id!==format.id?4:policy.max_provider_attempts_per_article_including_repairs;
}
export function automaticExplainerDossier(plan,captures,policy,at=new Date(),{previousCriticalClaims=[],previousUnresolvedClaims=[],previousDocuments=[]}={}){
  const chosen=plan.urls.map(url=>captures.find(s=>(referenceUrl(s.url)===referenceUrl(url)||s.requested_url===url)
    &&s.extraction_method==='public_article'&&s.extraction_version===ARTICLE_EXTRACTION_VERSION
    &&Number.isFinite(Date.parse(s.checked_at??s.captured_at))&&Date.parse(s.checked_at??s.captured_at)<=+at
    &&+at-Date.parse(s.checked_at??s.captured_at)<86400000));
  if(chosen.some(s=>!s))return null;
  if(new Set(chosen.map(s=>referenceForUrl(s.url)?.publisher)).size!==chosen.length)return null;
  if(new Set(chosen.map(s=>s.text.normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim())).size!==chosen.length)return null;
  // Use the largest contiguous context that fits the existing request ceiling.
  // A fixed short excerpt can omit definitions and qualifications in long guides.
  for(let total=plan.additional_sources?.length&&!previousDocuments.length?4500:8500;total>=1500;total-=500){
    const documents=chosen.map((s,i)=>{
      const prior=previousDocuments.find(d=>d.capture_id===s.capture_id&&d.url===s.url);
      if(prior)return {...prior,id:'E'+(i+1)};
      const excerpt=explainerExcerpt(s.text,plan.source_terms?.[s.url]??plan.terms,Math.floor(total/chosen.length));if(!excerpt)return null;
      const ref=referenceForUrl(s.url);
      const provenance=plan.provenance?.[i];
      return {id:'E'+(i+1),reference_id:ref.id,capture_id:s.capture_id??hash(s),title:s.title,url:referenceUrl(s.url,ref),published_at:s.published_at,
        ...excerpt,content_hash:dossierHash(excerpt.text),rights_reference:s.rights_reference,kind:provenance?.kind??(i===0?'primary':'independent'),evidence_scope:s.evidence_scope??'public_article',
        origin_url:referenceUrl(provenance?.origin_url??s.url),same_event:false,same_subject:true,consulted_at:new Date(s.checked_at??s.captured_at).toISOString(),
        independence_note:provenance?.independence_note??(i===0?'Guia primário público da instituição responsável; data original e trecho contíguo preservados.':'Guia elaborado por outra instituição/autoria sobre o conceito. A comparação deve verificar independência, contexto, limites e fatos comuns. Não é cobertura de um mesmo anúncio nem replicação experimental.')};
    });
    if(documents.some(d=>!d))continue;
    const d=validateDossier({schema_version:1,event_key:'explainer:'+plan.key,category:plan.category,subcategory:plan.subcategory,
      editorial:{kind:'explainer',key:plan.key,question:plan.question,as_of:at.toISOString()},documents,claims:[],
      ...(previousCriticalClaims.length?{previous_critical_claims:previousCriticalClaims}:{}),...(previousUnresolvedClaims.length?{previous_unresolved_claims:previousUnresolvedClaims}:{})});
    try{buildComparisonRequest(d,policy);}catch{continue;}
    return d;
  }
  return null;
}
