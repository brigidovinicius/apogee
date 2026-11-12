import {referenceCatalog,referenceUrl,validateDossier,dossierHash,buildComparisonRequest,taxonomy} from './corroboration.mjs';
import {primaryDocument,primaryReference,referenceForUrl,independentReference} from './article-research.mjs';

const referenceById=new Map(referenceCatalog.map(r=>[r.id,r]));
export function sourceReference(id){const key=String(id).replace(/^ARTICLE_/,'');return referenceById.get({SRC01:'REF22',SRC02:'REF22',SRC03:'REF22'}[key]??key);}
export const TOPICS=Object.freeze(Object.entries(taxonomy).flatMap(([category,v])=>Object.keys(v.subcategories).map(subcategory=>({category,subcategory}))).concat(Object.keys(taxonomy).map(category=>({category,subcategory:null}))));
export const topicKey=t=>t.category+'/'+(t.subcategory??'geral');
export function researchTopic(c){
  const assigned=c.artifact?.research?.topic;
  if(assigned&&TOPICS.some(t=>topicKey(t)===topicKey(assigned)))return assigned;
  const title=c.title.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();
  const t=(title+' '+(c.evidence??[]).map(e=>e.text).join(' ').slice(0,1600)).normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();
  if(/em promocao|veja uma selecao|onde assistir|escalacao|horoscopo|cupons|filmes para|^ofertas\b|melhor.*para comprar|lotofacil|\bquina\b|mega.sena|\blottery\b|\bbest\b.*\bdeals\b/.test(title))return null;
  // The headline establishes the editorial focus. A mention of a detector chip
  // in a telescope story must not consume the daily robotics/hardware slot.
  if(/marketing|advertis|campanha|publicidade|\bads\b|anunciantes/.test(title))return {category:'negocios',subcategory:'marketing'};
  if(/startup|empreendedor|\bventure\b|acquisit|acquire|aquisicao|spinout|rodada de/.test(title))return {category:'negocios',subcategory:'empreendedorismo-startups'};
  if(/robot|robo\b|hardware|semiconductor|chip\b|processor|processador|\bgpu\b/.test(title))return {category:'tecnologia',subcategory:'hardware-robotica'};
  if(/nasa|mars\b|marte\b|spacecraft|lunar|orbit|rocket|foguete|astronom|espacia|space telescope/.test(title))return {category:'ciencia',subcategory:'aeroespacial'};
  if(/\bai\b|\bia\b|artificial intelligence|inteligencia artificial|chatgpt|gemini|openai|llm/.test(title))return {category:'tecnologia',subcategory:'ia'};
  if(/neuro|brain|cerebr|alzheimer/.test(title))return {category:'ciencia',subcategory:'neurociencia'};
  if(/software|application|aplicativo|ferramenta|browser|navegador|sistema operacional|windows|android|collaborativ|colaborativ/.test(title))return {category:'tecnologia',subcategory:'software-ferramentas'};
  const ref=sourceReference(c.source_id);
  // Headline-specific topics take precedence; these approved specialist feeds
  // supply the focus when a headline does not name its editorial category.
  if(['REF45','REF46','REF47'].includes(ref?.id))return {category:'negocios',subcategory:ref.subcategories[0]};
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
export function nextResearchCandidate(plan,history=[]){
  const count=topic=>Number(history.find(h=>topicKey(h.topic)===topicKey(topic))?.researched??0);
  return plan.reduce((selected,item)=>!selected||count(item.topic)<count(selected.topic)?item:selected,null);
}
export const evidenceDois=text=>new Set((text.match(/\b10\.\d{4,9}\/[a-z0-9._;()/:+-]+/gi)??[]).map(v=>v.replace(/[.,;)]+$/,'').toLowerCase()));
const escaped=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
// Some public RSS previews omit outbound hyperlinks. Admit only an exact,
// distinctive product identifier in a dated corporate launch and another
// launch headline naming that product and its owner. This selects evidence for
// comparison; it does not confirm claims, independence or scientific results.
export function sameProductLaunch(a,b){
  if(!a.published_at||!b.published_at||![Date.parse(a.published_at),Date.parse(b.published_at)].every(Number.isFinite)||Math.abs(Date.parse(a.published_at)-Date.parse(b.published_at))>2*86400000)return false;
  for(const [primary,news] of [[a,b],[b,a]]){
    const ref=sourceReference(primary.source_id);
    if(!primaryReferenceCorporate(ref)||!independentReference(sourceReference(news.source_id)))continue;
    const title=String(primary.title??'');
    const launch=/\b(?:try|introduc\w*|launch\w*|announc\w*|experimental|now available|lan[cç]\w*|anunci\w*|dispon[ií]vel)\b/i;
    if(!launch.test(title)||!launch.test(news.title+' '+news.text.slice(0,1200)))continue;
    if(/\b(?:review|hands.on|rumou?r|leak\w*|reportedly|lawsuit|breach|vulnerab\w*|an[aá]lise|opini[aã]o|falha|processo)\b/i.test(news.title))continue;
    const product=title.match(/^Try\s+([A-Z][a-zA-Z0-9]{6,30})\b/)?.[1]
      ??title.match(/^([A-Z][A-Za-z0-9]*(?:\s+\d+(?:\.\d+)?)(?:\s+[A-Z][a-zA-Z]+)?)\s+is now available\b/)?.[1]
      ??title.match(/\b([A-Z][a-z]+[A-Z][A-Za-z]+\s+\d+(?:\.\d+)?)\b/)?.[1];
    if(!product||/^(?:Google|Microsoft|OpenAI|Meta|Gemini|ChatGPT|Android|Windows|Product|Products)$/i.test(product))continue;
    const exact=new RegExp('\\b'+escaped(product)+'\\b','i'),brand=new RegExp('\\b'+escaped(ref.publisher)+'\\b','i');
    const matched=exact.exec(news.title);if(!matched||!exact.test(primary.text)||!brand.test(news.title+' '+news.text))continue;
    if(/^\s+(?:Pro|Ultra|Max|Mini|Plus|\d)\b/i.test(news.title.slice(matched.index+matched[0].length)))continue;
    return true;
  }
  return false;
}
const primaryReferenceCorporate=r=>!!r&&/^institucional/.test(r.role)&&['google','microsoft','meta','openai'].includes(r.publisher);
// A shared citation to one specific registered primary document is an event
// identifier, not evidence of independent reporting. Generic landing pages do
// not qualify. The comparator still checks every critical fact and dependence.
const primaryLinkCache=new WeakMap();
export function primaryEventLinks(document){
  const previous=primaryLinkCache.get(document);if(previous&&previous.urls===document.related_urls)return previous.links;
  const links=[];
  for(const value of document.related_urls??[])try{
    const r=referenceForUrl(value),url=referenceUrl(value,r);if(!primaryReference(r))continue;
    const path=new URL(url).pathname,parts=path.split('/').filter(Boolean);
    if(parts.length<2||url===referenceUrl(r.url)||/(?:^|\/)(?:category|tag|topic|author|privacy|terms|feed)(?:\/|$)/i.test(path))continue;
    if(['google','meta'].includes(r.publisher)&&parts.length<3)continue;
    links.push(url);
  }catch{/* Unregistered URLs never become a common primary identifier. */}
  primaryLinkCache.set(document,{urls:document.related_urls,links});return links;
}
const eventFeatureCache=new WeakMap();
function eventFeatures(document){
  const previous=eventFeatureCache.get(document);if(previous&&previous.urls===document.related_urls&&previous.text===document.text&&previous.doi===document.doi)return previous;
  const features={urls:document.related_urls,text:document.text,doi:document.doi,dois:evidenceDois(document.text+' '+(document.doi??'')+' '+(document.related_urls??[]).join(' '))};
  eventFeatureCache.set(document,features);return features;
}
// Exact identifiers select a research pair. Generic title similarity, home-page
// links and popularity never establish a pair or a verified comparison.
export function sameResearchEvent(a,b){
  if(a.published_at&&b.published_at&&Math.abs(Date.parse(a.published_at)-Date.parse(b.published_at))>7*86400000)return false;
  const u=referenceUrl(a.url),v=referenceUrl(b.url);
  if((a.related_urls??[]).includes(v)||(b.related_urls??[]).includes(u))return true;
  const primaryLinks=new Set(primaryEventLinks(a));if(primaryEventLinks(b).some(url=>primaryLinks.has(url)))return true;
  const dois=eventFeatures(a).dois;return [...eventFeatures(b).dois].some(d=>dois.has(d))||sameProductLaunch(a,b);
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
  if(!topic||!own||!ref||!primaryDocument(own,ref))return null;
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
  for(let total=6000;total>=1000;total-=500){
  const budget=Math.floor(total/chosen.length);
  const documents=chosen.map((s,i)=>{
    const text=prefix(s.text,budget);if(text.length<80)return null;
    return {id:'E'+(i+1),reference_id:s.ref.id,capture_id:s.capture_id,title:s.title,url:referenceUrl(s.url,s.ref),published_at:s.published_at,
      text,content_hash:dossierHash(text),rights_reference:s.rights_reference,kind:i===0?'primary':'independent',evidence_scope:s.evidence_scope??'source_excerpt',origin_url:referenceUrl(s.url),same_event:true,
      independence_note:i===0?'Fonte primária institucional ou apuração de primeira mão explicitamente identificada; snapshot integral preservado.':'Seleção por DOI, documento primário comum, referência explícita ou identificador exato de lançamento corporativo na janela de 48 horas. Confirmar mesmo evento, data e estágio. Publicação distinta; o comparador deve rejeitar mera reprodução de release. Não representa replicação científica nem conferência humana.'};
  });
  if(documents.some(d=>!d))continue;
  const dossier=validateDossier({schema_version:1,event_key:own.url.length<=180?own.url:'url-sha256:'+dossierHash(own.url),...topic,documents,claims:[]});
  try{buildComparisonRequest(dossier,policy);}catch{continue;}
  return dossier;
  }
  return null;
}
