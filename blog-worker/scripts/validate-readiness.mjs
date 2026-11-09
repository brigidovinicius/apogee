// Read-only readiness probe. Never calls generation, writes to a database or enables a source.
import {readFile,writeFile} from 'node:fs/promises';
import Parser from 'rss-parser';
import {getFeed,boundedJson} from '../src/http.mjs';
import {normalizeItem} from '../src/editorial.mjs';
import {hash} from '../src/policy.mjs';

const checkedAt=new Date(),report={checked_at:checkedAt.toISOString(),generation_calls:0};
if(process.argv.includes('--models')){
  const key=process.env.OPENAI_API_KEY;
  if(!key || !/^org-[A-Za-z0-9]+$/.test(process.env.BLOG_OPENAI_ORGANIZATION_ID??'')
    || !/^proj_[A-Za-z0-9]+$/.test(process.env.BLOG_OPENAI_PROJECT_ID??''))throw Error('credential_scope_missing');
  try{
    const response=await fetch('https://api.openai.com/v1/models',{method:'GET',redirect:'error',signal:AbortSignal.timeout(20000),
      headers:{Authorization:'Bearer '+key,'OpenAI-Organization':process.env.BLOG_OPENAI_ORGANIZATION_ID,'OpenAI-Project':process.env.BLOG_OPENAI_PROJECT_ID}});
    report.models={http_status:response.status};
    if(response.ok){const data=await boundedJson(response,1048576);report.models.candidates=['gpt-6-luna','gpt-6.1-terra'].map(id=>({id,listed:data.data?.some(m=>m.id===id)===true}));}
  }catch{report.models={status:'network_error'};}
}else{
  const sources=JSON.parse(await readFile(new URL('../config/sources.json',import.meta.url),'utf8'));report.sources=[];
  for(const s of sources){
    const started=Date.now(),row={id:s.id,url:s.url,enabled:s.enabled,network_origin:'local_mac'};
    try{
      const feed=await getFeed(s.url,s.article_hosts);
      if(/<!DOCTYPE|<!ENTITY/i.test(feed.body))throw Error('unsafe_xml');
      const parsed=await new Parser().parseString(feed.body),all=parsed.items??[];
      const recent=[...all].sort((a,b)=>Date.parse(b.isoDate??b.pubDate)-Date.parse(a.isoDate??a.pubDate)).slice(0,20);
      const normalized=recent.map(item=>normalizeItem(item,{...s,feed_content_approved:true,rights_reference:'technical_probe_only_not_a_license'},checkedAt)).filter(Boolean);
      Object.assign(row,{status:'parsed',bytes:Buffer.byteLength(feed.body),sha256:hash(feed.body),total_items:all.length,
        inspected_items:recent.length,accepted_metadata:normalized.length,evidence_size_eligible_only:normalized.filter(x=>x.status==='ready').length,
        newest_date:recent[0]?.isoDate??recent[0]?.pubDate??null,
        article_hosts:[...new Set(recent.flatMap(x=>{try{return [new URL(x.link).hostname];}catch{return []}}))],
        etag:feed.etag,last_modified:feed.lastModified});
    }catch(error){row.status='blocked';row.reason=['feed_size','feed_http','feed_network','unsafe_xml','private_address','url_not_allowed'].includes(error.message)?error.message:'parse_or_dns_error';}
    row.duration_ms=Date.now()-started;report.sources.push(row);console.log(JSON.stringify({source:row.id,status:row.status,reason:row.reason,accepted_metadata:row.accepted_metadata}));
  }
}
const out=process.argv.indexOf('--out');
if(out>=0&&process.argv[out+1])await writeFile(process.argv[out+1],JSON.stringify(report,null,2)+'\n',{mode:0o600});
console.log(JSON.stringify(report));
