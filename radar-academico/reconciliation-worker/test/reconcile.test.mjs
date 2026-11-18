import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { usdMicro,verifyPricing,readCosts,reconcileOnce } from '../reconcile.mjs';
const epoch=1794960000, now=()=>epoch*1000+3600000;
const tariff={input:100000,output:500000,cached:10000,write:125000};
const pricing='### Standard pricing data\n| gpt-6-luna | $0.10 | $0.50 | $0.01 | $0.125 | $0.25 |';
const response=body=>new Response(JSON.stringify(body),{headers:{date:new Date(now()).toUTCString()}});
const bucket=(value='0.0853561',start=epoch,end=epoch+86400)=>({start_time:start,end_time:end,results:[{amount:{value,currency:'usd'}}]});
const args={apiKey:'sk-'+'s'.repeat(30),organizationId:'org-fixture01',startTime:epoch,endTime:epoch+3600,now};
const config={...args,monthStartTime:epoch,cycleId:'fixture-cycle',period:'2026-11-01',model:'gpt-6-luna',tariff};
test('rounds decimal and numeric costs upward, including scientific notation',()=>{
 assert.equal(usdMicro('0.0853561'),85357);assert.equal(usdMicro(1e-9),2);assert.equal(usdMicro(0),0);
 assert.ok(usdMicro(0.0853561)>=85357);for(const v of [-1,NaN,Infinity,'-1','1e3',null])assert.throws(()=>usdMicro(v));
 assert.ok(verifyPricing(pricing,'gpt-6-luna',tariff));
 assert.throws(()=>verifyPricing(pricing.replace('$0.50','$0.75'),'gpt-6-luna',tariff),/price_changed/);
});
test('reads complete costs using the fixed host and sends no credential to pricing',async()=>{
 const calls=[];let refreshed=false;
 const result=await reconcileOnce({apiKey:args.apiKey,now,store:{config:async()=>config,refresh:async(cycle,period,cost,monthly)=>{assert.equal(cycle,config.cycleId);assert.equal(period,config.period);assert.equal(cost,85357);assert.equal(monthly,85357);refreshed=true;return {updated:true}}},fetchImpl:async(url,options)=>{
  calls.push([url,options]);return url.includes('/organization/costs')?response({data:[bucket()],has_more:false}):new Response(pricing);
 }});
 assert.equal(result.updated,true);assert.equal(refreshed,true);assert.equal(calls.length,2);
 assert.equal(new URL(calls[0][0]).origin,'https://api.openai.com');assert.equal(calls[0][1].redirect,'error');
 assert.equal(Number(new URL(calls[0][0]).searchParams.get('end_time')),epoch+86400);
 assert.equal(Number(new URL(calls[0][0]).searchParams.get('start_time')),epoch);
 assert.equal(calls[1][1].headers,undefined);
});
test('rejects gaps, incomplete pagination, currency changes, stale costs and repeated cursors',async()=>{
 for(const b of [
  {data:[bucket('0',epoch+1)],has_more:false},
  {data:[bucket('0',epoch,epoch+10)],has_more:false},
  {data:[{...bucket(),results:[{amount:{value:'1',currency:'eur'}}]}],has_more:false},
  {data:[bucket()],has_more:true,next_page:'https://evil.invalid'},
 ])await assert.rejects(readCosts({...args,fetchImpl:async()=>response(b)}));
 await assert.rejects(readCosts({...args,fetchImpl:async()=>new Response('{}',{headers:{date:'Mon, 01 Jan 2024 00:00:00 GMT'}})}),/stale_provider/);
 await assert.rejects(readCosts({...args,fetchImpl:async()=>new Response('denied',{status:403,headers:{date:new Date(now()).toUTCString()}})}));
});
test('a missing anchor or changed pricing never refreshes a financial proof',async()=>{
 let refreshed=0,calls=0;const store={config:async()=>null,refresh:async()=>{refreshed++;return {updated:true}}};
 assert.equal((await reconcileOnce({store,apiKey:args.apiKey,now,fetchImpl:async()=>{calls++;}})).reason,'anchor_unavailable');
 assert.equal(calls,0);store.config=async()=>config;
 await assert.rejects(reconcileOnce({store,apiKey:args.apiKey,now,fetchImpl:async url=>url.includes('/organization/costs')?response({data:[bucket()],has_more:false}):new Response(pricing.replace('$0.50','$0.75'))}));
 assert.equal(refreshed,0);
});
test('rollover checks the new month and the original grant window, without a new credit assumption',async()=>{
 const calls=[];const monthStart=epoch,rootStart=epoch-86400;let refreshed=0;
 const result=await reconcileOnce({apiKey:args.apiKey,now,store:{config:async()=>({...config,startTime:rootStart}),
  refresh:async(cycle,period,total,monthly,at,ref)=>{refreshed++;assert.equal(total,3000000);assert.equal(monthly,1000000);
   assert.match(ref,/costs:[a-f0-9]{64};month:[a-f0-9]{64};pricing:[a-f0-9]{64}/);assert.equal(at,new Date(now()).toISOString());return {updated:true,rolledOver:true}}},
  fetchImpl:async(url,options)=>{
   calls.push([url,options]);if(!url.includes('/organization/costs'))return new Response(pricing);
   const start=Number(new URL(url).searchParams.get('start_time'));
   return response({data:start===monthStart?[bucket('1')]:[bucket('2',rootStart,epoch),bucket('1')],has_more:false});
  }});
 assert.equal(refreshed,1);assert.equal(result.rolledOver,true);assert.equal(calls.length,3);
 assert.equal(Number(new URL(calls[0][0]).searchParams.get('start_time')),monthStart);
 assert.equal(Number(new URL(calls[1][0]).searchParams.get('start_time')),rootStart);
});
test('an incomplete new-month read, inconsistent totals or invalid month cannot open a cycle',async()=>{
 for(const mode of ['incomplete','inconsistent','invalid']){
  let refreshed=0;
  await assert.rejects(reconcileOnce({apiKey:args.apiKey,now,store:{config:async()=>({...config,startTime:epoch-86400,
   ...(mode==='invalid'?{monthStartTime:epoch+86400}:{})}),refresh:async()=>{refreshed++;}},fetchImpl:async url=>{
    if(!url.includes('/organization/costs'))return new Response(pricing);
    const start=Number(new URL(url).searchParams.get('start_time'));
    if(start===epoch)return response({data:[bucket('2')],has_more:mode==='incomplete',next_page:'missing-page'});
    return response({data:[bucket('0',epoch-86400,epoch),bucket('1')],has_more:false});
   }}));assert.equal(refreshed,0);
 }
});
test('a successful pre-midnight reconciliation wakes again just after the BRT boundary',async()=>{
 const result=await reconcileOnce({apiKey:args.apiKey,now,store:{config:async()=>({...config,endTime:epoch+3601}),
  refresh:async()=>({updated:true})},fetchImpl:async url=>url.includes('/organization/costs')?
   response({data:[bucket()],has_more:false}):new Response(pricing)});
 assert.equal(result.nextCheckInMs,2000);
});
test('finance credentials stay isolated from generation, website, scheduler and AI worker',async()=>{
 const compose=await readFile(new URL('../../infra/vps/docker-compose.yml',import.meta.url),'utf8');
 const finance=compose.split('  finance-worker:\n')[1].split('  migrate:\n')[0];
 assert.match(finance,/profiles: \[finance\]/);assert.match(finance,/RADAR_FINANCE_ENABLED:-false/);
 assert.doesNotMatch(finance,/OPENAI_API_KEY|DATABASE_EDITOR|DATABASE_MIGRATION|BLOG_|apogee_radar_bridge|ports:|depends_on:/);
 assert.match(finance,/secrets: \[radar_finance_usage_env, radar_finance_database_url\]/);
 const earlier=compose.split('  finance-worker:\n')[0];assert.doesNotMatch(earlier,/RADAR_FINANCE|radar_finance_usage_env/);
});
