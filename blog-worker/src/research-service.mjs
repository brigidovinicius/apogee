import {createArticleReader,referenceForUrl,primaryReference,primaryDocument,independentReference,articleSource} from './article-research.mjs';
import {normalizeItem} from './editorial.mjs';
import {hash} from './policy.mjs';
import {referenceUrl} from './corroboration.mjs';

const articleUrl=url=>{try{const u=new URL(url);return u.pathname!=='/'&&!/\.(?:png|jpe?g|gif|svg|webp|mp4|pdf)$/i.test(u.pathname)&&!/^\/(?:privacy|terms|contact|about|feed|live)\/?$/i.test(u.pathname)&&!/^\/(?:category|tag|topic)(?:\/|$)/i.test(u.pathname);}catch{return false;}};
export function researchPrimaryLinks(document){
  const publisher=referenceForUrl(document.url)?.publisher;
  return (document.related_urls??[]).filter(url=>{const r=referenceForUrl(url);return articleUrl(url)&&(!r||referenceUrl(url)!==referenceUrl(r.url))&&(primaryReference(r)||/^https:\/\/(?:dx\.)?doi\.org\/10\.\d{4,9}\//i.test(url)||independentReference(r)&&r.publisher!==publisher);}).sort((a,b)=>Number(primaryReference(referenceForUrl(b))||/doi\.org\//.test(b))-Number(primaryReference(referenceForUrl(a))||/doi\.org\//.test(a))).slice(0,8);
}
export const defaultArticleReader=createArticleReader();
export async function enrichSelectedEvidence({store,candidate,dossier,captures,read=defaultArticleReader,clock=Date.now}){
  const budget={used:0,max:8,deadline:clock()+30000};let attempted=false,refreshed=0;
  for(const d of dossier.documents){
    if(d.text.length>=1600||captures.some(c=>referenceUrl(c.url)===referenceUrl(d.url)&&c.extraction_method==='public_article'))continue;
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
  const obtain=async(url,seed)=>{
    const cached=captures.find(d=>referenceUrl(d.url)===referenceUrl(url)&&d.extraction_method==='public_article');
    if(cached)return cached;
    const doc=await read(url,budget,{fallbackTitle:seed?.title??'',fallbackDate:seed?.published_at??null});
    await store.captureResearchDocument(candidate,doc);captures.unshift({...doc,capture_id:hash(doc)});return captures[0];
  };
  const own=await obtain(candidate.url,candidate);
  const ref=referenceForUrl(own.url);
  if(primaryDocument(own,ref))return {primary:await store.researchCandidate(candidate.url),requests:budget.used};
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
      await store.researchProgress(promoted.id,{stage:'primary_found',topic,seed_candidate:candidate.id,source_published_at:primary.published_at,seed_published_at:new Date(candidate.published_at).toISOString(),next_at:new Date(clock()+3600000).toISOString()});
      await store.researchProgress(candidate.id,{stage:'primary_linked',topic,primary_candidate:promoted.id,next_at:new Date(clock()+24*3600000).toISOString()});
      return {primary:{...promoted,artifact:{...promoted.artifact,research:{...promoted.artifact?.research,topic}}},requests:budget.used};
    }catch(error){lastReason=error.code??'research_source_unavailable';if(budget.used>=budget.max||clock()>budget.deadline)break;}
  }
  return {reason:lastReason,requests:budget.used};
}
