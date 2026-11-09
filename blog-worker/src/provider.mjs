import {boundedJson} from './http.mjs';
import {fail,hash} from './policy.mjs';
import {openAIImageProvider} from './images.mjs';

const ORIGIN='https://api.openai.com/v1/responses';
// Fixed official endpoint, API key only. No CLI, browser sessions, alternate providers, SDK retries or tools.
export function openAIProvider({apiKey,identity,fetcher=fetch,now=Date.now}) {
  if(typeof apiKey!=='string'||!apiKey.startsWith('sk-')||apiKey.length<20||!identity.organization_id||!identity.project_id)fail('credentials_missing');
  const headers={'Content-Type':'application/json','Authorization':'Bearer '+apiKey,
    'OpenAI-Organization':identity.organization_id,'OpenAI-Project':identity.project_id};
  const images=openAIImageProvider({apiKey,identity,fetcher,now});
  return async reservation=>{
    if(reservation.kind==='image')return images(reservation);
    const body=reservation.body,p=reservation.policy;
    if(body.model!==p.model_id || body.tools.length || body.max_output_tokens!==p.billed_output_tokens_cap_including_reasoning
      || body.store!==false || body.background!==false || body.service_tier!=='default'
      || body.reasoning?.effort!==p.reasoning_effort || body.prompt_cache_options?.mode!=='explicit'
      || body.prompt_cache_options?.ttl!=='30m' || !reservation.id)fail('request_policy_mismatch');
    if(!(Date.parse(reservation.not_after)>now()+110000))return {outcome:'not_sent',reason:'reservation_expired'};
    try {
      // The approved price catalog must attest that this non-generation endpoint is unbilled.
      // Reserve the FULL input cap first, then count all processed input (including schema/formatting).
      let inputTokens;
      if(p.input_counting_mode==='local_byte_bound'){
        // UTF-8 bytes plus a conservative serialization allowance; no paid token-count request.
        // The server usage is still reconciled; an unexpected excess pauses the circuit.
        inputTokens=Buffer.byteLength(JSON.stringify(body))+1024;
      }else{
      const counter=await fetcher(ORIGIN+'/input_tokens',{method:'POST',redirect:'error',headers,
        body:JSON.stringify({model:body.model,instructions:body.instructions,input:body.input,text:body.text,reasoning:body.reasoning,tools:[]}),signal:AbortSignal.timeout(20000)});
      if(!counter.ok)return {outcome:'unknown'};
      const count=await boundedJson(counter,16384);
      if(!Number.isSafeInteger(count.input_tokens)||count.input_tokens<1)return {outcome:'unknown'};
      inputTokens=count.input_tokens;
      }
      if(inputTokens>p.input_tokens_cap_including_overhead)return {outcome:'not_sent',reason:'input_limit'};
      if(!(Date.parse(reservation.not_after)>now()+90000))return {outcome:'not_sent',reason:'reservation_expired'};
      const response=await fetcher(ORIGIN,{method:'POST',redirect:'error',headers:{...headers,'X-Client-Request-Id':reservation.id},
        body:JSON.stringify(body),signal:AbortSignal.timeout(90000)});
      // Even an HTTP error can have an uncertain charge. Never release or retry based only on status.
      if(!response.ok)return {outcome:'unknown'};
      const data=await boundedJson(response);
      if(data.model!==body.model || data.service_tier!=='default')return {outcome:'unknown'};
      const usage=data.usage;
      if(!usage)return {outcome:'unknown'};
      if(data.status!=='completed')return {outcome:'rejected',reason:'incomplete_response',usage};
      if(!Array.isArray(data.output)||data.output.some(x=>!['message','reasoning'].includes(x.type)))return {outcome:'rejected',reason:'unexpected_output',usage};
      const parts=data.output.filter(x=>x.type==='message').flatMap(x=>x.content??[]);
      if(parts.length!==1||parts[0].type!=='output_text'||typeof parts[0].text!=='string')return {outcome:'rejected',reason:'refusal_or_missing_text',usage};
      return {outcome:'completed',text:parts[0].text,usage,response_hash:hash(parts[0].text)};
    }catch{return {outcome:'unknown'};}
  };
}
