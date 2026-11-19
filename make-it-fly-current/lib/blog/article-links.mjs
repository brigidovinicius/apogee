import {referenceCatalog,referenceUrl} from './corroboration.mjs';

// Direct, registered HTTPS destinations only. Source ingestion independently
// checks redirects and DNS before a document can support an article.
export function trustedArticleReference(value){
 try{
  const u=new URL(value),host=u.hostname.replace(/^www\./,'');
  if(/\/(?:redirect|redirects|out|url)(?:\/|$)/i.test(decodeURIComponent(u.pathname)))return null;
  for(const key of u.searchParams.keys())if(/^(?:url|redirect(?:_uri|_url)?|return(?:_url|to)?|next|target|dest(?:ination)?|continue)$/i.test(key))return null;
  const ref=referenceCatalog.find(r=>(r.hosts??[new URL(r.url).hostname.replace(/^www\./,'')]).includes(host));
  return ref?referenceUrl(value,ref):null;
 }catch{return null;}
}
function trimPunctuation(value){
 let tail='';
 while(/[.,;:!?\]]$/.test(value)||value.endsWith(')')&&(value.match(/\)/g)?.length??0)>(value.match(/\(/g)?.length??0)){
  tail=value.slice(-1)+tail;value=value.slice(0,-1);
 }
 return {value,tail};
}
export function articleReferenceParts(text,references=[]){
 const parts=[];let from=0;
 for(const match of text.matchAll(/https?:\/\/[^\s<>"']+|\[(\d{1,2})\]/gi)){
  if(match.index>from)parts.push({text:text.slice(from,match.index),href:null});
  const {value,tail}=match[1]?{value:match[0],tail:''}:trimPunctuation(match[0]);
  const candidate=match[1]?references[Number(match[1])-1]?.url:value;
  parts.push({text:value,href:candidate?trustedArticleReference(candidate):null});
  if(tail)parts.push({text:tail,href:null});
  from=match.index+match[0].length;
 }
 if(from<text.length)parts.push({text:text.slice(from),href:null});
 return parts.length?parts:[{text,href:null}];
}
