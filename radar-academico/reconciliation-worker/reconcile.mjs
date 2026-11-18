import { createHash } from 'node:crypto';

const COSTS='https://api.openai.com/v1/organization/costs';
const PRICING='https://developers.openai.com/api/docs/pricing.md';
const hash=text=>createHash('sha256').update(text).digest('hex');
export function usdMicro(value) {
  // JSON numbers may use exponent notation or lose a decimal bit. Round upward,
  // with one extra micro-dollar per positive result; never undercount usage.
  if(typeof value==='number') {
    if(!Number.isFinite(value)||value<0)throw Error('invalid_cost');
    const result=value===0?0:Math.ceil(value*1000000)+1;
    if(!Number.isSafeInteger(result))throw Error('invalid_cost');return result;
  }
  if(typeof value!=='string')throw Error('invalid_cost');
  const text=String(value);
  if(!/^\d{1,12}(?:\.\d{1,30})?$/.test(text))throw Error('invalid_cost');
  const [whole,fraction='']=text.split('.');
  const result=BigInt(whole)*1000000n+BigInt((fraction+'000000').slice(0,6))+(fraction.slice(6).match(/[1-9]/)?1n:0n);
  if(result>BigInt(Number.MAX_SAFE_INTEGER))throw Error('invalid_cost');return Number(result);
}
export function verifyPricing(markdown,model,tariff) {
  if(model!=='gpt-6-luna'||typeof markdown!=='string'||markdown.length>524288)throw Error('price_unverified');
  const first=markdown.split('\n').find(line=>line.startsWith(`| ${model} |`));
  if(!first)throw Error('price_unverified');
  const cells=first.split('|').slice(2,7).map(x=>x.trim().replace(/^\$/,''));
  const [input,output,cached,write]=cells.map(usdMicro);
  if(input!==tariff.input||cached!==tariff.cached||write!==tariff.write||output!==tariff.output)throw Error('price_changed');
  return hash(markdown);
}
async function boundedText(response,max=524288) {
  if(!response.ok||!response.body)throw Error('source_unavailable');
  const chunks=[];let n=0;const reader=response.body.getReader();
  try {for(;;){const r=await reader.read();if(r.done)break;n+=r.value.length;if(n>max)throw Error('response_limit');chunks.push(r.value);}}
  finally {await reader.cancel().catch(()=>{})}
  return Buffer.concat(chunks,n).toString('utf8');
}
export async function readCosts({apiKey,organizationId,startTime,endTime,fetchImpl=fetch,now=Date.now}) {
  if(!/^sk-[A-Za-z0-9_-]{20,}$/.test(apiKey)||!/^org-[A-Za-z0-9]{8,80}$/.test(organizationId)||
    !Number.isSafeInteger(startTime)||!Number.isSafeInteger(endTime)||endTime<=startTime)throw Error('invalid_account');
  let total=0,page=null,observedAt=null,previousEnd=null;const hashes=[];const cursors=new Set();
  // Costs returns whole UTC-day buckets. A partial end_time omits today's
  // bucket. Include the current day, while validating the complete response.
  const queryStart=Math.floor(startTime/86400)*86400;
  const queryEnd=Math.ceil(endTime/86400)*86400;
  for(let i=0;i<4;i++) {
    const u=new URL(COSTS);u.searchParams.set('start_time',String(queryStart));u.searchParams.set('end_time',String(queryEnd));
    u.searchParams.set('bucket_width','1d');u.searchParams.set('limit','31');if(page)u.searchParams.set('page',page);
    const r=await fetchImpl(u.href,{redirect:'error',cache:'no-store',signal:AbortSignal.timeout(25000),
      headers:{Authorization:'Bearer '+apiKey,'OpenAI-Organization':organizationId}});
    const at=Date.parse(r.headers.get('date')||'');if(!Number.isFinite(at)||Math.abs(now()-at)>300000)throw Error('stale_provider');
    observedAt=new Date(at).toISOString();const text=await boundedText(r);hashes.push(hash(text));const body=JSON.parse(text);
    if(!Array.isArray(body.data)||typeof body.has_more!=='boolean')throw Error('invalid_costs');
    for(const bucket of body.data) {
      if(!Array.isArray(bucket.results)||!Number.isSafeInteger(bucket.start_time)||!Number.isSafeInteger(bucket.end_time)||
        bucket.end_time<=bucket.start_time||bucket.end_time<=startTime||bucket.start_time>=endTime)throw Error('invalid_bucket');
      if(previousEnd===null?bucket.start_time>startTime:bucket.start_time!==previousEnd)throw Error('incomplete_buckets');
      previousEnd=bucket.end_time;
      for(const item of bucket.results) {
        if(item.amount?.currency!=='usd')throw Error('currency_mismatch');
        total+=usdMicro(item.amount.value);if(!Number.isSafeInteger(total))throw Error('invalid_costs');
      }
    }
    if(!body.has_more) {
      if(previousEnd===null||previousEnd<endTime)throw Error('incomplete_buckets');
      return {providerMicro:total,observedAt,hash:hash(hashes.join(':'))};
    }
    if(typeof body.next_page!=='string'||!/^[A-Za-z0-9_-]{1,500}$/.test(body.next_page)||cursors.has(body.next_page))throw Error('invalid_cursor');
    page=body.next_page;cursors.add(page);
  }
  throw Error('pagination_limit');
}
export async function reconcileOnce({store,apiKey,fetchImpl=fetch,now=Date.now}) {
  const config=await store.config();if(!config)return {updated:false,reason:'anchor_unavailable'};
  const endTime=Math.min(config.endTime,Math.floor(now()/1000));
  const costs=await readCosts({apiKey,organizationId:config.organizationId,startTime:config.startTime,endTime,fetchImpl,now});
  const price=await fetchImpl(PRICING,{redirect:'error',cache:'no-store',signal:AbortSignal.timeout(25000)});
  const pricingHash=verifyPricing(await boundedText(price),config.model,config.tariff);
  const result=await store.refresh(costs.providerMicro,costs.observedAt,'costs:'+costs.hash+';pricing:'+pricingHash);
  return {updated:result.updated,reason:result.updated?'verified':result.reason};
}
