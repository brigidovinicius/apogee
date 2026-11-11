import {parse} from 'parse5';
import {referenceCatalog,referenceUrl} from './corroboration.mjs';
import {getFeed} from './http.mjs';
import {hash,fail} from './policy.mjs';

export const primaryReference=r=>!!r&&(/^(institucional|periodico_cientifico$)/.test(r.role));
export const independentReference=r=>!!r&&!primaryReference(r)&&/jornalismo|divulgacao|analise_especialista|publicacao_especializada/.test(r.role);
const host=u=>new URL(u).hostname.replace(/^www\./,'');
export function referenceForUrl(value){
  try{const u=referenceUrl(value),h=host(u),path=new URL(u).pathname;
    if(h==='nature.com'&&path.startsWith('/articles/')){
      const id=Object.entries({s41593:'REF12',s41591:'REF14',s41550:'REF24',s42256:'REF36',s41586:'PRIMARY_NATURE_RESEARCH'}).find(([prefix])=>path.startsWith('/articles/'+prefix))?.[1];
      return referenceCatalog.find(r=>r.id===id)??null;
    }
    return referenceCatalog.filter(r=>(r.hosts??[host(r.url)]).includes(h))
    .sort((a,b)=>Number(new URL(u).pathname.startsWith(new URL(b.url).pathname))-Number(new URL(u).pathname.startsWith(new URL(a.url).pathname))||new URL(b.url).pathname.length-new URL(a.url).pathname.length)[0]??null;}catch{return null;}
}
const hostsFor=r=>[...new Set((r.hosts??[host(r.url)]).flatMap(h=>[h,'www.'+h]))];
export function articleSource(r){return {id:'ARTICLE_'+r.id,reference_id:r.id,name:r.name,editoria:r.categories[0]==='negocios'?'startups':r.categories[0]==='ciencia'?'ciencia-espaco':'tecnologia',type:'article',url:r.url,
  article_hosts:hostsFor(r),enabled:true,content_approved:true,feed_content_approved:true,interval_minutes:1440,keywords:[],collection_approval_reference:'Pesquisa multifonte autorizada pelo titular em 2026-11-11; somente páginas públicas dos sites de referência',
  rights_reference:'Excerto de página pública para apuração e atribuição; sem reprodução integral, acesso restrito ou licença de imagens; respeitar robots.txt'};}

// RFC 9309: most-specific agent group, longest matching rule; Allow wins ties.
export function robotsAllowed(text,url){
  if(Buffer.byteLength(text)>65536||text.includes('\0'))return false;
  const groups=[];let agents=[],rules=[],hasRules=false;
  const flush=()=>{if(agents.length)groups.push({agents,rules});agents=[];rules=[];hasRules=false;};
  for(const line of text.split(/\r?\n/)){
    const m=line.replace(/#.*/,'').match(/^\s*([\w-]+)\s*:\s*(.*?)\s*$/);if(!m)continue;
    const key=m[1].toLowerCase(),value=m[2];
    if(key==='user-agent'){if(hasRules)flush();agents.push(value.toLowerCase());}
    else if(['allow','disallow'].includes(key)&&agents.length){hasRules=true;if(value)rules.push({allow:key==='allow',path:value});}
  }flush();
  const scored=groups.map(g=>({...g,score:Math.max(-1,...g.agents.map(a=>a==='*'?0:'apogeeblog'.startsWith(a)?a.length:-1))}));
  const best=Math.max(-1,...scored.map(g=>g.score));if(best<0)return true;
  const normalize=s=>s.replace(/%([0-9a-f]{2})/gi,(m,h)=>/[\w.~\-]/.test(String.fromCharCode(parseInt(h,16)))?String.fromCharCode(parseInt(h,16)):m.toUpperCase());
  const u=new URL(url),path=normalize(u.pathname+u.search);let winner;
  for(const g of scored.filter(g=>g.score===best))for(const r of g.rules){
    const source=normalize(r.path),end=source.endsWith('$');
    const pattern=source.replace(/\$$/,'').split('*').map(p=>p.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('.*');
    if(!new RegExp('^'+pattern+(end?'$':'')).test(path))continue;
    const length=source.replace(/[*$]/g,'').length;
    if(!winner||length>winner.length||(length===winner.length&&r.allow))winner={...r,length};
  }
  return winner?.allow??true;
}
const attrs=n=>Object.fromEntries((n.attrs??[]).map(a=>[a.name,a.value]));
const ignored=new Set(['script','style','nav','header','footer','aside','form','button','noscript','svg','template']);
function textOf(node){
  const a=attrs(node);if(ignored.has(node.tagName)||a.hidden!==undefined||a['aria-hidden']==='true'||/display\s*:\s*none|visibility\s*:\s*hidden/i.test(a.style??''))return '';
  if(node.nodeName==='#text')return node.value;
  return (node.childNodes??[]).map(textOf).join(' ');
}
const clean=s=>String(s??'').replace(/\s+/g,' ').trim();
export function extractArticle(html,url,{fallbackTitle='',fallbackDate=null}={}){
  if(Buffer.byteLength(html)>3145728)fail('research_page_size');
  const tree=parse(html),nodes=[];const visit=n=>{nodes.push(n);for(const c of n.childNodes??[])visit(c);};visit(tree);
  const meta={};for(const n of nodes.filter(n=>n.tagName==='meta')){const a=attrs(n);meta[(a.property??a.name??'').toLowerCase()]=a.content??'';}
  if(/nosnippet|max-snippet\s*:\s*0/i.test(meta.robots??''))fail('research_excerpt_disallowed');
  // Never read a hidden article body or reconstruct content behind a paywall.
  if(/"isAccessibleForFree"\s*:\s*(?:false|"false")/.test(html))fail('research_access_restricted');
  const bodies=nodes.filter(n=>{const a=attrs(n);return a.itemprop==='articleBody'||/(?:^|\s)(?:article-body|article_body|story-body|story_body|post-content|entry-content|article-content|news-article--content)(?:\s|$)/i.test((a.id??'')+' '+(a.class??''));});
  const articles=nodes.filter(n=>n.tagName==='article');
  const roots=bodies.length?bodies:articles.length?articles:nodes.filter(n=>n.tagName==='main');
  const root=roots.sort((a,b)=>textOf(b).length-textOf(a).length)[0];if(!root)fail('research_article_missing');
  const text=clean(textOf(root)).slice(0,12000);if(text.length<200)fail('research_text_insufficient');
  const title=clean(meta['og:title']??textOf(nodes.find(n=>n.tagName==='h1')??{}))||fallbackTitle;
  if(title.length<3)fail('research_title_missing');
  let structuredDate;
  for(const n of nodes.filter(n=>n.tagName==='script'&&/ld\+json/i.test(attrs(n).type??''))){
    try{const scan=v=>{if(!v||typeof v!=='object')return;const types=[v['@type']].flat();if(types.some(t=>['NewsArticle','Article','BlogPosting','ScholarlyArticle'].includes(t))&&typeof v.datePublished==='string')structuredDate??=v.datePublished;for(const child of Object.values(v))if(Array.isArray(child))child.forEach(scan);else if(child&&typeof child==='object')scan(child);};scan(JSON.parse((n.childNodes??[]).map(c=>c.value??'').join('')));}catch{/* Invalid page metadata is not evidence. */}
  }
  const time=nodes.find(n=>n.tagName==='time'&&attrs(n).datetime);
  const rawDate=meta['article:published_time']??meta['citation_online_date']??structuredDate??meta['citation_publication_date']??meta['date']??meta['dc.date']??meta['dcterms.created']??(time?attrs(time).datetime:null)??fallbackDate;
  const date=rawDate?new Date(rawDate):null;
  const bodyNodes=[];const walk=n=>{if(ignored.has(n.tagName))return;bodyNodes.push(n);for(const c of n.childNodes??[])walk(c);};walk(root);
  const related_urls=[...new Set(bodyNodes.filter(n=>n.tagName==='a').map(n=>{try{return referenceUrl(new URL(attrs(n).href,url).href);}catch{return null;}}).filter(Boolean))].slice(0,150);
  return {url:referenceUrl(url),title:title.slice(0,220),published_at:date&&Number.isFinite(+date)?date.toISOString():null,text,content_hash:hash(text),related_urls,doi:meta.citation_doi??null,extraction_method:'public_article',snapshot_hash:hash(html)};
}

export function createArticleReader({download=getFeed,clock=Date.now}={}){
  const robots=new Map();
  return async function read(value,budget,{fallbackTitle='',fallbackDate=null}={}){
    if(/^https:\/\/(?:dx\.)?doi\.org\/10\.\d{4,9}\//i.test(value)){
      const doi=referenceUrl(value.replace('https://dx.doi.org/','https://doi.org/')),origin='https://doi.org';
      const request=async(url,options)=>{if(budget.used>=budget.max||clock()>budget.deadline)fail('research_cycle_limit');budget.used++;return download(url,['doi.org'],{timeoutMs:Math.min(7000,Math.max(1,budget.deadline-clock())),...options});};
      const rules=await request(origin+'/robots.txt',{maxBytes:65536,statuses:[200,404,410],accept:'text/plain'});
      if(!robotsAllowed(rules.status===200?rules.body:'',doi))fail('research_robots_disallowed');
      const result=await request(doi,{maxBytes:65536,statuses:[301,302,303,307,308],accept:'text/html'});
      const target=referenceUrl(new URL(result.location,doi).href);
      if(!primaryReference(referenceForUrl(target)))fail('research_reference_unregistered');
      const doc=await read(target,budget,{fallbackTitle,fallbackDate});return {...doc,doi:doc.doi??new URL(doi).pathname.slice(1)};
    }
    const reference=referenceForUrl(value);if(!reference)fail('research_reference_unregistered');
    let url=referenceUrl(value,reference);
    const request=async(target,options={})=>{
      if(budget.used>=budget.max||clock()>budget.deadline)fail('research_cycle_limit');budget.used++;
      return download(target,hostsFor(reference),{maxBytes:3145728,timeoutMs:Math.min(7000,Math.max(1,budget.deadline-clock())),accept:'text/html,application/xhtml+xml,text/plain',...options});
    };
    for(let redirects=0;redirects<=2;redirects++){
      const origin=new URL(url).origin;let rules=robots.get(origin);
      if(!rules||rules.expires<clock()){
        const r=await request(origin+'/robots.txt',{maxBytes:65536,statuses:[200,404,410]});
        rules={text:r.status===404||r.status===410?'':r.body,expires:clock()+6*3600000};
        if(robots.size>=100)robots.delete(robots.keys().next().value);robots.set(origin,rules);
      }
      if(!robotsAllowed(rules.text,url))fail('research_robots_disallowed');
      const result=await request(url,{statuses:[200,301,302,303,307,308]});
      if(result.status!==200){
        if(!result.location||redirects===2)fail('research_redirect');
        // A redirect is revalidated and DNS-pinned, never followed across publishers.
        url=referenceUrl(new URL(result.location,url).href,reference);continue;
      }
      if(result.contentType&&!/text\/html|application\/xhtml\+xml/i.test(result.contentType))fail('research_format_unsupported');
      if(/nosnippet|max-snippet\s*:\s*0/i.test(result.robots??''))fail('research_excerpt_disallowed');
      const article=extractArticle(result.body,url,{fallbackTitle,fallbackDate});
      return {...article,source_id:articleSource(reference).id,rights_reference:articleSource(reference).rights_reference};
    }
    fail('research_redirect');
  };
}
