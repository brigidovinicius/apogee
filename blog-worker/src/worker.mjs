import Parser from 'rss-parser';
import {readFile,writeFile,rename} from 'node:fs/promises';
import {Blocked,CATEGORIES,fail,validatePolicy} from './policy.mjs';
import {allowedUrl,getFeed} from './http.mjs';
import {normalizeItem} from './editorial.mjs';

export function validateSources(sources) {
  if(!Array.isArray(sources)||sources.length>40||new Set(sources.map(s=>s.id)).size!==sources.length)fail('invalid_sources');
  for(const s of sources){
    if(!/^[A-Z0-9_-]{1,40}$/.test(s.id??'') || typeof s.enabled!=='boolean' || typeof s.feed_content_approved!=='boolean'
      || !CATEGORIES[s.editoria] || s.type!=='rss' || !Number.isInteger(s.interval_minutes)||s.interval_minutes<60||s.interval_minutes>1440
      || !Array.isArray(s.article_hosts)||!s.article_hosts.length||s.article_hosts.some(h=>typeof h!=='string'||!/^[a-z0-9.-]+\.[a-z]+$/.test(h))
      || !Array.isArray(s.keywords)||s.keywords.length>30||s.keywords.some(x=>typeof x!=='string'||!x||x.length>100))fail('invalid_source');
    allowedUrl(s.url,s.article_hosts);
    if(s.enabled&&!s.collection_approval_reference)fail('collection_unapproved');
    if(s.feed_content_approved&&!s.rights_reference)fail('rights_unapproved');
  }
  return sources;
}
export async function loadConfig(directory) {
  const policy=validatePolicy(JSON.parse(await readFile(new URL('policy.json',directory),'utf8')));
  const sources=validateSources(JSON.parse(await readFile(new URL('sources.json',directory),'utf8')));
  const catalog=JSON.parse(await readFile(new URL('prices.json',directory),'utf8'));
  if(!Array.isArray(catalog)||catalog.length>10)fail('invalid_catalog');
  return {policy,sources,catalog};
}
export async function collect({store,sources,download=getFeed,at=new Date()}) {
  const stats={sources:0,created:0,duplicate:0,failed:0};
  for(const source of validateSources(sources)){
    if(!source.enabled)continue;
    const state=await store.claimSource(source);if(!state)continue;
    stats.sources++;
    try{
      const feed=await download(source.url,source.article_hosts,{etag:state.etag,lastModified:state.last_modified});
      if(feed.notModified){await store.sourceResult(source.id,'not_modified');continue;}
      if(typeof feed.body!=='string'||Buffer.byteLength(feed.body)>2*1024*1024||/<!DOCTYPE|<!ENTITY/i.test(feed.body))fail('unsafe_xml');
      const parsed=await new Parser().parseString(feed.body);
      // Limit the whole document by bytes before parsing; then inspect at most 20 recent items.
      const items=(parsed.items??[]).sort((a,b)=>Date.parse(b.isoDate??b.pubDate)-Date.parse(a.isoDate??a.pubDate)).slice(0,20);
      for(const item of items){const candidate=normalizeItem(item,source,at);if(candidate)stats[await store.ingest(candidate)]++;}
      await store.sourceResult(source.id,'ok',feed);
    }catch(error){stats.failed++;await store.sourceResult(source.id,'feed_error',{retryAfter:error.retryAfter});}
  }
  return stats;
}
export async function tick({store,config,identity,provider,download}) {
  validatePolicy(config.policy);validateSources(config.sources);
  await store.recover();
  const sources=store.syncPipeline?validateSources(await store.syncPipeline(config,identity)):config.sources;
  const command=store.claimCommand?await store.claimCommand():null;
  const storage=await store.maintenance();
  const collection=storage.capture_allowed?await collect({store,sources,download}):{sources:0,created:0,duplicate:0,failed:0,reason:'storage_cap'};
  async function generate(){
    if(command?.kind==='collect')return {collection,generation:{status:'idle'}};
    if(!config.policy.generation_enabled)return {collection,generation:{status:'blocked',reason:'generation_disabled'}};
    if(config.policy.operator_commands_only && !command)return {collection,generation:{status:'idle',reason:'waiting_for_editor'}};
    if(!provider)return {collection,generation:{status:'blocked',reason:'credentials_missing'}};
    const options={...config,sources,identity,candidateId:command?.candidate_id??null};
    async function perform(method){
      let reservation;
      try{if(provider.preflight)await provider.preflight();reservation=await store[method](options);}
      catch(error){if(error instanceof Blocked)return {status:'blocked',reason:error.code};throw error;}
      if(reservation.status!=='reserved')return reservation;
      let result;try{result=await provider(reservation);}catch{result={outcome:'unknown'};}
      return store.finish(reservation,result);
    }
    const generation=await perform('reserve');
    if(!config.policy.automatic_image_generation_enabled || !['draft','idle'].includes(generation.status))return {collection,generation};
    return {collection,generation,image:await perform('reserveImage')};
  }
  try{
    const result=await generate();
    if(command)await store.completeCommand(command.id,result);
    return result;
  }catch(error){
    if(command)await store.completeCommand(command.id,{generation:{status:'blocked',reason:'worker_error'}});
    throw error;
  }
}
export async function heartbeat(file,state) {
  await writeFile(file+'.tmp',JSON.stringify(state),{mode:0o600});await rename(file+'.tmp',file);
}
export async function healthy(file,at=Date.now()) {
  try{const state=JSON.parse(await readFile(file,'utf8')),age=at-Date.parse(state.at);return state.alive===true&&age>=0&&age<240000;}catch{return false;}
}
