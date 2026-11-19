import Parser from 'rss-parser';
import {readFile,writeFile,rename} from 'node:fs/promises';
import {Blocked,CATEGORIES,fail,validatePolicy} from './policy.mjs';
import {allowedUrl,getFeed} from './http.mjs';
import {normalizeItem} from './editorial.mjs';
import {DEFAULT_OPENAI_CONFIG,validateOpenAIConfig,apiOperationPolicy,API_FALLBACK_REASONS,GOOGLE_FALLBACK_REASONS} from './openai-routing.mjs';

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
  let openai=DEFAULT_OPENAI_CONFIG,openai_error=null;
  try{openai=validateOpenAIConfig(JSON.parse(await readFile(new URL('openai-text.json',directory),'utf8')));}
  catch(error){if(error.code!=='ENOENT')openai_error='openai_config_invalid';}
  return {policy,sources,catalog,openai,openai_error};
}
export function assertSafeFeedXml(body){
  if(typeof body!=='string'||Buffer.byteLength(body)>2*1024*1024)fail('unsafe_xml');
  const markers=/<!\[CDATA\[|<!--|<!DOCTYPE|<!ENTITY/gi;let match;
  while((match=markers.exec(body))){
    const end=match[0]==='<![CDATA['?']]>' : match[0]==='<!--'?'-->':null;
    if(!end)fail('unsafe_xml');
    const close=body.indexOf(end,markers.lastIndex);if(close<0)fail('unsafe_xml');
    markers.lastIndex=close+end.length;
  }
  // Parse the unchanged original. Declarations inside CDATA/comments are
  // literal article examples; executable DTD/entity declarations stay blocked.
  return body;
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
      assertSafeFeedXml(feed.body);
      const parsed=await new Parser().parseString(feed.body);
      // Limit the whole document by bytes before parsing; then inspect at most 20 recent items.
      const items=(parsed.items??[]).sort((a,b)=>Date.parse(b.isoDate??b.pubDate)-Date.parse(a.isoDate??a.pubDate)).slice(0,20);
      for(const item of items){const candidate=normalizeItem(item,source,at);if(candidate)stats[await store.ingest(candidate)]++;}
      await store.sourceResult(source.id,'ok',feed);
    }catch(error){stats.failed++;await store.sourceResult(source.id,'feed_error',{retryAfter:error.retryAfter});}
  }
  return stats;
}
export async function tick({store,config,identity,provider,apiProvider,download}) {
  validatePolicy(config.policy);validateSources(config.sources);
  await store.recover();
  const sources=store.syncPipeline?validateSources(await store.syncPipeline({...config,openai_runtime_ready:!!apiProvider},identity)):config.sources;
  let access;
  if(config.policy.provider==='google_subscription'&&config.policy.generation_enabled&&config.policy.google_automatic_access_validation_enabled){
    try{access=await store.revalidateGoogleAccess(config.policy,provider);}
    catch(error){access={status:'blocked',reason:error instanceof Blocked?error.code:'google_access_unavailable'};}
  }
  const command=store.claimCommand?await store.claimCommand():null;
  const storage=await store.maintenance();
  const collection=storage.capture_allowed?await collect({store,sources,download}):{sources:0,created:0,duplicate:0,failed:0,reason:'storage_cap'};
  let research={prepared:0},discovery=null;
  if(!command&&storage.capture_allowed&&config.policy.generation_enabled&&config.policy.provider==='google_subscription'&&config.policy.automatic_explainers_enabled&&store.prepareRenewableResearch){
    try{discovery=await store.prepareRenewableResearch(config.policy,{discoveryOnly:true});}
    catch(error){discovery={prepared:0,kind:'reference_discovery',reason:error instanceof Blocked?error.code:'research_source_unavailable'};}
    if(discovery)research=discovery;
  }
  async function generate(){
    if(command?.kind==='collect')return {collection,generation:{status:'idle'}};
    if(!config.policy.generation_enabled)return {collection,generation:{status:'blocked',reason:'generation_disabled'}};
    if(config.policy.operator_commands_only && !command)return {collection,generation:{status:'idle',reason:'waiting_for_editor'}};
    if(!provider&&!apiProvider)return {collection,generation:{status:'blocked',reason:'credentials_missing'}};
    const options={...config,sources,identity,candidateId:command?.candidate_id??null};
    async function perform(method){
      const kind=method==='reserveComparison'?'comparison':method==='reserveImage'?'image':'text';
      const optional=options.candidateId&&config.openai?.enabled&&config.policy.provider==='google_subscription';
      const order=optional?(kind==='text'?['api','google']:['google','api']):['google'];
      let fallbackReason=null,fallbackFrom=null;
      for(const lane of order){
        let reservation;
        const selected=lane==='api'?apiProvider:provider;
        try{
          if(!selected)fail('credentials_missing');
          if(lane==='api'){
            const circuit=await store.apiCircuit();if(circuit.blocked)fail(circuit.reason==='openai_disabled'?'openai_disabled':'openai_circuit_open');
            reservation=await store[method]({...options,policy:apiOperationPolicy(config.policy,config.openai,kind)});
          }else{
            if(access&&access.status!=='valid')fail(access.reason??'google_access_unverified');
            if(provider.preflight){const quota=await provider.preflight();if(store.observeQuota)await store.observeQuota(quota,'before');}
            reservation=await store[method](options);
          }
        }catch(error){
          if(!(error instanceof Blocked))throw error;
          const recoverable=(lane==='api'?API_FALLBACK_REASONS:GOOGLE_FALLBACK_REASONS).has(error.code);
          if(recoverable&&lane!==order.at(-1)){fallbackReason=error.code;fallbackFrom=lane==='api'?'openai_api':'google_subscription';continue;}
          if(!command&&options.candidateId&&error.code==='input_limit'&&store.deferAutomaticWork)await store.deferAutomaticWork(options.candidateId,error.code);
          return {status:'blocked',reason:error.code,...(fallbackReason?{fallback_from:fallbackFrom,fallback_reason:fallbackReason}:{})};
        }
        if(reservation.status!=='reserved')return reservation;
        let result;try{result=await selected(reservation);}catch{result={outcome:'unknown'};}
        const completed=await store.finish(reservation,result);
        // Only proof of zero generation permits a second provider. Uncertain
        // outcomes retain both the request and billing reservation for review.
        if(lane==='api'&&completed.status==='not_generated'&&API_FALLBACK_REASONS.has(completed.reason)&&lane!==order.at(-1)){
          fallbackReason=completed.reason;fallbackFrom='openai_api';continue;
        }
        if(lane==='google'&&provider.preflight&&store.observeQuota){try{await store.observeQuota(await provider.preflight(),'after');}catch{/* Durable settlement cannot trigger a retry. */}}
        return {...completed,...(fallbackReason?{fallback_from:fallbackFrom,fallback_reason:fallbackReason}:{}),...(lane==='api'?{provider:'openai_api'}:{})};
      }
    }
    let automatic=!command&&config.policy.provider==='google_subscription'&&!config.policy.operator_commands_only&&store.nextAutomaticWork?await store.nextAutomaticWork(config.policy):null;
    if(!automatic&&!command&&config.policy.provider==='google_subscription'&&!config.policy.operator_commands_only&&store.prepareAutomaticResearch){
      try{if(store.checkResearchBudget)await store.checkResearchBudget(config.policy);}
      catch(error){
        if(!(error instanceof Blocked))throw error;
        if(!GOOGLE_FALLBACK_REASONS.has(error.code)||!config.openai?.enabled||!apiProvider||!store.checkAPIResearchBudget)return {collection,research,generation:{status:'blocked',reason:error.code}};
        try{await store.checkAPIResearchBudget(config,identity);}catch(apiError){if(apiError instanceof Blocked)return {collection,research,generation:{status:'blocked',reason:apiError.code}};throw apiError;}
      }
      if(storage.capture_allowed&&!discovery)research=await store.prepareAutomaticResearch(config.policy);
      automatic=store.nextAutomaticWork?await store.nextAutomaticWork(config.policy):null;
    }
    if(!command&&config.policy.provider==='google_subscription'&&!config.policy.operator_commands_only&&store.nextAutomaticWork&&!automatic)return {collection,research,generation:{status:'idle',reason:'waiting_for_evidence'}};
    if(automatic)options.candidateId=automatic.candidateId;
    const generation=await perform(automatic?.method??(command?.kind==='compare'?'reserveComparison':'reserve'));
    // At most one metered operation in an automatic tick. Pending covers have priority on the next tick.
    if(automatic)return {collection,research,generation};
    if(command?.kind==='compare')return {collection,generation};
    if(!config.policy.automatic_image_generation_enabled || !['draft','idle'].includes(generation.status))return {collection,generation};
    return {collection,research,generation,image:await perform('reserveImage')};
  }
  try{
    const generated=await generate();
    const publication=store.publishAutomatically?await store.publishAutomatically():null;
    const result=publication?{...generated,publication}:generated;
    if(store.recordAutomaticOutcome)await store.recordAutomaticOutcome(result);
    if(command)await store.completeCommand(command.id,result);
    return access?{...result,access}:result;
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
