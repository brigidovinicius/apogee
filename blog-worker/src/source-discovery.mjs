import {referenceForUrl,primaryReference,independentReference} from './article-research.mjs';
import {canonicalResearchUrl} from './research-links.mjs';
import {isIP} from 'node:net';

// These are discovery leads, not trust scores or permissions. Unknown hosts
// never reach the network reader and assets never become an approved license.
export function sourceDiscovery(document){
  const registered=[],unregistered=[],seen=new Set(),publishers=new Set();
  for(const value of (document.related_urls??[]).slice(0,150))try{
    const url=canonicalResearchUrl(value),u=new URL(url);
    if(isIP(u.hostname)||!u.hostname.includes('.')||/\.(?:local|internal|invalid|test|example)$/.test(u.hostname)
      ||/\.(?:png|jpe?g|webp|svg|gif|mp4|pdf)$/i.test(u.pathname)
      ||/(?:^|\/)(?:privacy|terms|login|signup|tag|category|author|feed|search)(?:\/|$)/i.test(u.pathname)
      ||u.pathname==='/'||url===document.url||seen.has(url))continue;
    seen.add(url);const r=referenceForUrl(url);
    if(r&&(primaryReference(r)||independentReference(r))&&!publishers.has(r.publisher)&&registered.length<6){
      publishers.add(r.publisher);registered.push({url,name:r.name,publisher:r.publisher,kind:primaryReference(r)?'primary':'independent'});
    }else if(!r&&unregistered.length<5&&!['doi.org','dx.doi.org'].includes(u.hostname))unregistered.push({url,host:u.hostname});
  }catch{/* Malformed, credential-bearing and non-HTTPS links are not leads. */}
  const images=primaryReference(referenceForUrl(document.url))?(document.image_candidates??[]).slice(0,3):[];
  return {registered,unregistered,images,rights_status:'review_required'};
}

export function sourceCuration(candidate,links,at=new Date()){
  const text=String(candidate.title??'').normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();
  const excluded=/\b(?:rumou?r|leak|vazamento|sponsored|publieditorial)\b|conteudo patrocinado|em promocao|veja uma selecao|^ofertas\b/.test(text);
  const own=referenceForUrl(candidate.url),publishers=new Set(),primary=new Set();
  for(const url of links){const r=referenceForUrl(url);if(r){publishers.add(r.publisher);if(primaryReference(r))primary.add(r.publisher);}}
  const age=+at-Date.parse(candidate.published_at),fresh=Number.isFinite(age)&&age>=-900000&&age<=2*86400000;
  return {eligible:!excluded,priority:(primaryReference(own)?4:0)+Math.min(primary.size,3)*4+Math.min(publishers.size,3)*2+(fresh?1:0),publishers:publishers.size};
}
