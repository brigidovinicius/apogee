import {hash} from './policy.mjs';
import {referenceUrl} from './corroboration.mjs';
import {referenceForUrl,primaryReference,primaryDocument,independentReference,ARTICLE_EXTRACTION_VERSION} from './article-research.mjs';
import {researchTopic} from './automatic-research.mjs';
import {validateExplainerCatalog} from './explainers.mjs';
import {topicAvailable,focusPool} from '../../make-it-fly-current/lib/blog/editorial-plan.mjs';

// This is source discovery, never factual validation. It uses no model or
// search API. Every proposed subject still needs the native comparison, source
// independence, protected critical facts, original text, cover and publication
// gates. A rejected news event cannot be relabelled as an explainer.
const STOP=new Set(('what which where when how why does have has with from that this your their about through into over under using used use uses new news update updated introducing launches launch official guide guides learn understanding explained explains microsoft google openai meta nvidia intel azure technology technologies artificial intelligence business article available novembro november november2026 english portugues sobre como para pelo pela pelos pelas uma umas que dos das por mais com sao voce seu sua seus suas entenda confira saiba agora novo nova novos novas').split(' '));
for(const word of ('the and are for our out not but you its can all any will may say than them they those these there only very most more new now first world everyone every everyday work help team app platform build building latest today year next part across get give make take launch announce announcement release partnership agreement strategic update expand introduces introducing improve better best free billion million service product feature tool').split(' '))STOP.add(word);
for(const word of ['could','should','would','must','might','also','just','still','some','much','many','each','another','other'])STOP.add(word);
const DISTINCT_CONCEPTS=new Set('kubernetes container serverless hypervisor virtualization cryptography cybersecurity concurrency database tokenization embedding tokenizador criptografia ciberseguranca escalabilidade observabilidade computacao virtualizacao aprendizado'.split(' '));
const normalize=value=>String(value??'').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase();
const words=value=>[...new Set((normalize(value).match(/[a-z][a-z0-9-]{2,}/g)??[])
  .map(w=>w.length>5&&w.endsWith('s')&&!w.endsWith('ss')&&!w.endsWith('us')?w.slice(0,-1):w).filter(w=>!STOP.has(w)&&!/^\d|^announc|^introduc|^launch|^updat|^expand|^improv/.test(w)))];
const canonical=url=>{try{return referenceUrl(url);}catch{return null;}};
const fresh=(d,at)=>d.extraction_method==='public_article'&&d.extraction_version===ARTICLE_EXTRACTION_VERSION
  &&typeof d.text==='string'&&d.text.length>=400&&typeof d.title==='string'&&d.title.length>=8
  &&Number.isFinite(Date.parse(d.checked_at??d.captured_at))&&Date.parse(d.checked_at??d.captured_at)<=+at
  &&+at-Date.parse(d.checked_at??d.captured_at)<7*86400000
  &&(!d.published_at||Number.isFinite(Date.parse(d.published_at))&&Date.parse(d.published_at)<=+at+900000);
const topicFor=d=>researchTopic({title:d.title,source_id:d.source_id,editoria:referenceForUrl(d.url)?.categories.includes('negocios')?'startups':referenceForUrl(d.url)?.categories.includes('ciencia')?'ciencia-espaco':'tecnologia',evidence:[d]});
const fingerprint=text=>String(text??'').normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim();

export function storedExplainerPlans(existing){
 const plans=[];
 for(const c of existing){
  const p=c.artifact?.research?.plan;
  try{if(!p||p.key!==c.explainer_key||!p.key.startsWith('auto-'))continue;validateExplainerCatalog([p]);plans.push(p);}catch{/* Invalid metadata never becomes permission or executable input. */}
 }
 return plans.slice(0,200);
}

export function renewableExplainerPlans(captures,{blockedUrls=[],existing=[],usage=[],policy=null,at=new Date(),limit=30}={}){
 const blocked=new Set(blockedUrls.map(canonical).filter(Boolean)),seen=new Set(),rows=[],referenceCounts=new Map();
 // Prefer the newest full snapshot, retaining original source publication dates.
 for(const d of [...captures].sort((a,b)=>Date.parse(b.checked_at??b.captured_at)-Date.parse(a.checked_at??a.captured_at))){
  const url=canonical(d.url),ref=url&&referenceForUrl(url);
  if(!url||seen.has(url)||blocked.has(url)||blocked.has(canonical(d.requested_url))||!ref||!fresh(d,at)||!d.rights_reference)continue;
  const topic=topicFor(d);if(!topic||!topicAvailable(policy,usage,topic,at)||(referenceCounts.get(ref.id)??0)>=80)continue;
  referenceCounts.set(ref.id,(referenceCounts.get(ref.id)??0)+1);
  seen.add(url);rows.push({...d,url,ref,tokens:words(d.title),normalizedText:normalize(d.text),fingerprint:fingerprint(d.text),topic});if(rows.length===800)break;
 }
 const frequencies=new Map();for(const d of rows)for(const t of d.tokens)frequencies.set(t,(frequencies.get(t)??0)+1);
 const byKey=new Map(existing.map(c=>[c.explainer_key,c])),plans=[],paired=new Set();
 for(const seed of rows){
  if(plans.length>=Math.min(30,limit))break;
  if(!primaryDocument(seed,seed.ref)||blocked.has(seed.url)||paired.has(seed.url))continue;
  const topic=seed.topic;if(!topic||!topicAvailable(policy,usage,topic,at))continue;
  const key='auto-'+hash(seed.url).slice(0,40);
  if(byKey.has(key))continue; // No new identity after a hold, failure, restart or publication.
  const peers=rows.filter(d=>d.ref.publisher!==seed.ref.publisher&&(primaryReference(d.ref)||independentReference(d.ref))
    &&d.fingerprint!==seed.fingerprint&&focusPool(d.topic)===focusPool(topic))
    .map(d=>({d,common:seed.tokens.filter(t=>d.tokens.includes(t)&&seed.normalizedText.includes(t)&&d.normalizedText.includes(t))}))
    .filter(p=>p.common.length>=2||p.common.length===1&&DISTINCT_CONCEPTS.has(p.common[0])&&frequencies.get(p.common[0])<=10)
    .map(p=>({...p,score:p.common.reduce((n,t)=>n+Math.min(t.length,12)/(frequencies.get(t)??1),0)}))
    .sort((a,b)=>b.score-a.score);
  if(!peers.length)continue;
  const peer=peers[0],terms=peer.common.slice(0,6);
  if(primaryDocument(peer.d,peer.d.ref)&&peer.d.url.localeCompare(seed.url)<0)continue;
  const subject=terms.join(' · ').slice(0,120);
  const plan={key,...topic,question:`O que as fontes explicam sobre “${subject}” e quais limites estão documentados?`,terms,
    urls:[seed.url,peer.d.url],provenance:[
      {kind:'primary',origin_url:seed.url,independence_note:'Página primária pública capturada; a comparação deve verificar o assunto e preservar datas, contexto e limitações.'},
      {kind:'independent',origin_url:peer.d.url,independence_note:'Outra autoria sobre o assunto, selecionada apenas para pesquisa. Confirmar independência real; cópia de release não é corroboradora.'}],
    additional_sources:peers.slice(1).filter((v,i,a)=>a.findIndex(x=>x.d.ref.publisher===v.d.ref.publisher)===i&&v.d.ref.publisher!==peer.d.ref.publisher).slice(0,3)
      .map(v=>({url:v.d.url,kind:'independent',origin_url:v.d.url,terms:v.common.slice(0,6),independence_note:'Outra referência pública do mesmo assunto para reapuração. A comparação verifica dependência, fatos críticos e divergências.'}))};
  try{validateExplainerCatalog([plan]);plans.push(plan);paired.add(seed.url);paired.add(peer.d.url);}catch{/* Discovery cannot relax the approved catalog contract. */}
 }
 return plans;
}

export function nextReferenceDiscovery(captures,{blockedUrls=[],attemptedUrls=[],approvedReferenceIds=null,isApproved=null,usage=[],policy=null,at=new Date()}={}){
 const seen=new Set([...captures.map(c=>canonical(c.url)),...blockedUrls.map(canonical),...attemptedUrls.map(canonical)].filter(Boolean));
 const visits=new Map();for(const url of attemptedUrls){const publisher=referenceForUrl(url)?.publisher;if(publisher)visits.set(publisher,(visits.get(publisher)??0)+1);}
 const selected=new Map();
 const consider=(ref,value)=>{const previous=selected.get(ref.publisher);if(!previous||value.priority>previous.priority)selected.set(ref.publisher,{...value,publisher:ref.publisher});};
 // Follow only visible links already captured from approved public reference
 // pages. No guessed URL, generic web search, new host, authentication or asset.
 for(const parent of captures.slice(0,800)){
  const owner=referenceForUrl(parent.url),checked=Date.parse(parent.checked_at??parent.captured_at);
  if(!owner||!primaryReference(owner)||parent.extraction_method!=='public_article'||!Number.isFinite(checked)||checked>+at)continue;
  const approved=url=>{const ref=referenceForUrl(url);return ref&&(!approvedReferenceIds||approvedReferenceIds.includes('ARTICLE_'+ref.id))&&(!isApproved||isApproved(url));};
  // Old extractor snapshots can identify a page to refresh, but can never
  // supply factual evidence. Written/held source URLs remain blocked as new
  // article identities; refreshing a parent only discovers current links.
  if((parent.extraction_version!==ARTICLE_EXTRACTION_VERSION||+at-checked>=7*86400000)
    &&!attemptedUrls.includes(canonical(parent.url))&&approved(parent.url)){
   const topic=topicFor(parent);
   if(topic&&topicAvailable(policy,usage,topic,at))consider(owner,{url:canonical(parent.url),topic,parent_url:parent.url,refresh_parent:true,priority:/educacao/.test(owner.role)?80:40});
  }
  if(parent.extraction_version!==ARTICLE_EXTRACTION_VERSION)continue;
  for(const value of (parent.related_urls??[]).slice(0,150)){
   const url=canonical(value),ref=url&&referenceForUrl(url);
   if(!url||seen.has(url)||!ref||approvedReferenceIds&&!approvedReferenceIds.includes('ARTICLE_'+ref.id)
     ||isApproved&&!isApproved(url)||!(primaryReference(ref)||independentReference(ref)))continue;
   const u=new URL(url);if(u.pathname==='/'||/\.(?:png|jpe?g|webp|svg|gif|mp4|pdf)$/i.test(u.pathname)
     ||/(?:^|\/)(?:privacy|terms|login|signup|tag|category|author|feed|search)(?:\/|$)/i.test(u.pathname))continue;
   let title;try{title=decodeURIComponent(u.pathname.split('/').filter(Boolean).slice(-2).join(' ')).replace(/[-_]/g,' ');}catch{continue;}
   const topic=topicFor({url,title,source_id:'ARTICLE_'+ref.id,text:title});
   if(!topic||!topicAvailable(policy,usage,topic,at))continue;
   const priority=(/educacao/.test(ref.role)?20:0)+(/(?:what-is|what-are|learn|guide|planning|business-plan|marketing|how-to)/i.test(url)?10:0);
   consider(ref,{url,topic,parent_url:parent.url,priority});
  }
 }
 const next=[...selected.values()].sort((a,b)=>(visits.get(a.publisher)??0)-(visits.get(b.publisher)??0)||b.priority-a.priority)[0];
 return next?{url:next.url,topic:next.topic,parent_url:next.parent_url,...(next.refresh_parent?{refresh_parent:true}:{})}:null;
}
