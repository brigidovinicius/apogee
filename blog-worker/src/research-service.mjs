import {createArticleReader,referenceForUrl,primaryReference,primaryDocument,independentReference,articleSource,ARTICLE_EXTRACTION_VERSION} from './article-research.mjs';
import {normalizeItem} from './editorial.mjs';
import {hash} from './policy.mjs';
import {referenceUrl} from './corroboration.mjs';
import {canonicalResearchUrl} from './research-links.mjs';
import {researchTopic,sameResearchEvent} from './automatic-research.mjs';
import {sourceDiscovery,sourceCuration} from './source-discovery.mjs';

const articleUrl=url=>{try{const u=new URL(url);return u.pathname!=='/'&&!/\.(?:png|jpe?g|gif|svg|webp|mp4|pdf)$/i.test(u.pathname)&&!/^\/(?:privacy|terms|contact|about|feed|live)\/?$/i.test(u.pathname)&&!/^\/(?:category|tag|topic)(?:\/|$)/i.test(u.pathname);}catch{return false;}};
export function researchPrimaryLinks(document){
  const publisher=referenceForUrl(document.url)?.publisher;
  const links=[...(document.related_urls??[])];
  for(const value of document.text?.match(/\b10\.\d{4,9}\/[a-z0-9._;()/:+-]+/gi)??[]){
    const doi=value.replace(/[.,;)]+$/,'');if(!links.some(url=>{try{return /(?:^|\.)doi\.org$/.test(new URL(url).hostname)&&new URL(url).pathname.slice(1).toLowerCase()===doi.toLowerCase();}catch{return false;}}))links.push('https://doi.org/'+doi);
  }
  return [...new Set(links.map(url=>{try{return canonicalResearchUrl(url);}catch{return null;}}).filter(Boolean))].filter(url=>{const r=referenceForUrl(url);return articleUrl(url)&&(!r||referenceUrl(url)!==referenceUrl(r.url))&&(primaryReference(r)||/^https:\/\/(?:dx\.)?doi\.org\/10\.\d{4,9}\//i.test(url)||independentReference(r)&&r.publisher!==publisher);}).sort((a,b)=>Number(primaryReference(referenceForUrl(b))||/doi\.org\//.test(b))-Number(primaryReference(referenceForUrl(a))||/doi\.org\//.test(a))).slice(0,8);
}
export function researchPriority(candidate,at=new Date()){
 const doc=candidate.evidence?.[0],links=doc?researchPrimaryLinks(doc):[];
 const curated=sourceCuration(candidate,links,at);
 return curated.eligible?curated.priority+links.filter(url=>/doi\.org\//.test(url)).length:-1;
}
export const defaultArticleReader=createArticleReader();
export async function enrichSelectedEvidence({store,candidate,dossier,captures,read=defaultArticleReader,clock=Date.now}){
  const budget={used:0,max:8,deadline:clock()+30000};let attempted=false,refreshed=0;
  for(const d of dossier.documents){
    const full=captures.filter(c=>referenceUrl(c.url)===referenceUrl(d.url)&&c.extraction_method==='public_article');
    if(full.some(c=>c.extraction_version===ARTICLE_EXTRACTION_VERSION)||d.text.length>=1600&&!full.length)continue;
    if(budget.used>=budget.max||clock()>budget.deadline)break;
    attempted=true;
    try{
      const full=await read(d.url,budget,{fallbackTitle:d.title,fallbackDate:d.published_at});
      await store.captureResearchDocument(candidate,full);
      captures.unshift({...full,capture_id:hash(full)});refreshed++;
    }catch{/* The approved public RSS remains available; never bypass a page restriction. */}
  }
  return {attempted,refreshed,requests:budget.used};
}
export async function enrichResearch({store,candidate,topic,captures,read=defaultArticleReader,clock=Date.now}){
  const budget={used:0,max:8,deadline:clock()+30000};
  const unavailable=new Map();
  const obtain=async(url,seed)=>{
    const cached=captures.find(d=>referenceUrl(d.url)===referenceUrl(url)&&d.extraction_method==='public_article'&&d.extraction_version===ARTICLE_EXTRACTION_VERSION);
    if(cached)return cached;
    if(unavailable.has(url))throw unavailable.get(url);
    let doc;try{doc=await read(url,budget,{fallbackTitle:seed?.title??'',fallbackDate:seed?.published_at??null});}
    catch(error){unavailable.set(url,error);throw error;}
    await store.captureResearchDocument(candidate,doc);captures.unshift({...doc,capture_id:hash(doc)});return captures[0];
  };
  const independentContext=async primary=>{
    const publisher=referenceForUrl(primary.url)?.publisher,seen=new Set([publisher]);
    // First expand exact existing matches; then inspect explicit references in
    // the primary article. A link selects a page to read, never a verified fact.
    const urls=[...captures.filter(d=>sameResearchEvent(primary,d)).map(d=>d.url),...researchPrimaryLinks(primary)];
    let checked=0;
    for(const url of [...new Set(urls)]){
      const ref=referenceForUrl(url);if(!independentReference(ref)||seen.has(ref.publisher))continue;
      if(budget.used>=budget.max||clock()>budget.deadline||checked>=3)break;
      seen.add(ref.publisher);checked++;
      try{await obtain(url);}catch{/* Restrictions, robots and the shared HTTP budget remain enforced. */}
    }
  };
  let own;
  try{own=await obtain(candidate.url,candidate);}catch(error){
    // A publisher-authorized RSS excerpt remains a separate public resource
    // when its HTML page is unavailable. Follow its registered references;
    // never extract a gated body or substitute another article's snapshot.
    own=referenceForUrl(candidate.url)&&captures.find(d=>d.source_id===candidate.source_id
      &&referenceUrl(d.url)===referenceUrl(candidate.url)&&!d.extraction_method
      &&typeof d.text==='string'&&d.text.length>=200&&d.text.length<=12000
      &&d.rights_reference&&d.content_hash===hash(d.text));
    if(!own)throw error;
  }
  const ref=referenceForUrl(own.url);
  const discovery=sourceDiscovery(own);
  await store.researchProgress?.(candidate.id,{stage:'source_links_discovered',topic,source_discovery:discovery,next_at:new Date(clock()+3600000).toISOString()});
  if(primaryDocument(own,ref)){
    await independentContext(own);
    return {primary:await store.researchCandidate(candidate.url),topic,requests:budget.used};
  }
  let lastReason='research_primary_missing';
  for(const url of researchPrimaryLinks(own)){
    try{
      const primary=await obtain(url);
      if(!primaryDocument(primary)){lastReason='research_primary_missing';continue;}
      const source=articleSource(referenceForUrl(primary.url));
      // The candidate is current because of the dated news seed. Its captured
      // source retains its actual publication date (including unknown), separately.
      const next=normalizeItem({title:primary.title,link:primary.url,isoDate:primary.published_at??candidate.published_at,contentSnippet:primary.text},source,new Date(clock()));
      if(!next){lastReason='research_primary_stale';continue;}
      next.event_key=hash('primary-url:'+primary.url);next.evidence=[{id:'E1',...primary}];next.evidence_hash=hash(next.evidence);
      await store.ingest(next);
      const promoted=await store.researchCandidate(primary.url);
      if(!promoted)continue;
      await independentContext(primary);
      const inferred=researchTopic({...promoted,artifact:null});
      const resolved=inferred&&(inferred.category!==topic.category||inferred.subcategory&&topic.subcategory&&inferred.subcategory!==topic.subcategory)?inferred:topic;
      await store.researchProgress(promoted.id,{stage:'primary_found',topic:resolved,source_discovery:sourceDiscovery(primary),seed_candidate:candidate.id,source_published_at:primary.published_at,seed_published_at:new Date(candidate.published_at).toISOString(),next_at:new Date(clock()+3600000).toISOString()});
      await store.researchProgress(candidate.id,{stage:'primary_linked',topic:resolved,primary_candidate:promoted.id,next_at:new Date(clock()+24*3600000).toISOString()});
      return {primary:{...promoted,artifact:{...promoted.artifact,research:{...promoted.artifact?.research,stage:'primary_found',topic:resolved}}},topic:resolved,requests:budget.used};
    }catch(error){lastReason=error.code??'research_source_unavailable';if(budget.used>=budget.max||clock()>budget.deadline)break;}
  }
  return {reason:lastReason,requests:budget.used};
}
