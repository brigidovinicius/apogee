import test,{before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import { readFile,readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import pg from 'pg';
import { AiStore } from '../store.mjs';
import { dispatch } from '../dispatch.mjs';
import { prepareRequest } from '../policy.mjs';
import { processOne } from '../queue.mjs';
import { createOpenAIProvider } from '../openai.mjs';
let db,store,worker;
const hash='a'.repeat(64);
async function migrate(target){
  const dir=new URL('../../db/migrations/',import.meta.url);
  for(const f of (await readdir(dir)).filter(n=>n.endsWith('.sql')).sort()) await target.exec(await readFile(new URL(f,dir),'utf8'));
}
before(async()=>{
  const adminUrl=process.env.RADAR_AI_TEST_ADMIN_URL;
  if(adminUrl){
    const url=new URL(adminUrl);
    if(url.hostname!=='127.0.0.1'||url.pathname!=='/radar_ai_test'||url.username!=='postgres') throw Error('Disposable loopback database required');
    db=new pg.Pool({connectionString:adminUrl,max:1});db.exec=sql=>db.query(sql);db.close=()=>db.end();
    if((await db.query("select to_regclass('public.opportunities') as name")).rows[0].name) throw Error('Empty database required');
    await migrate(db);
    url.username='radar_ai_worker';worker=new pg.Pool({connectionString:url.toString(),max:2});
    store=new AiStore((sql,args)=>worker.query(sql,args));
  }else{
    db=new PGlite({extensions:{pgcrypto}});await migrate(db);
    store=new AiStore((sql,args=[])=>db.transaction(async tx=>{await tx.exec('set local role radar_ai_worker');return tx.query(sql,args);}));
  }
});
after(async()=>{await worker?.end();await db?.close();});
beforeEach(async()=>{
  await db.exec(`reset session authorization; reset role;
    truncate radar_ai.operation,radar_ai.attestation,radar_ai.cycle,radar_ai.month_opening cascade;
    insert into radar_ai.month_opening(period,reference) values(date_trunc('month',now() at time zone 'America/Sao_Paulo')::date,'synthetic-month-opening');
    insert into radar_ai.control(singleton) values(true);
    delete from radar_ai.price;
    insert into radar_ai.cycle values('cycle','radar','org-test','project-test',date_trunc('month',now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo',(date_trunc('month',now() at time zone 'America/Sao_Paulo')+interval '1 month') at time zone 'America/Sao_Paulo',50000000);
    insert into radar_ai.attestation values('cycle',50000000,now()-interval '1 minute',now()+interval '1 hour',true,'synthetic-billing-proof');
    update radar_ai.control set enabled=true,cycle_id='cycle',organization_id='org-test',project_id='project-test';
    insert into radar_ai.price values('test-model','v1',true,now()+interval '1 day',100000,500000,0);
    insert into radar_ai.response_tariff values('test-model','v1',true,now()+interval '1 day',100000,10000,100000,500000);`);
});
const reserve=(key='radar:test:0001',envelope='evaluation',inputBound=12000,outputLimit=1500)=>store.reserve({key,envelope,inputBound,outputLimit,requestHash:hash,model:'test-model'});
const monthSql = "date_trunc('month',now() at time zone 'America/Sao_Paulo')::date";
async function prior(stream, amount, ref = `synthetic-${stream}`) {
  await db.query(`insert into radar_ai.prior_usage(period,stream,amount_micro,reference) values(${monthSql},$1,$2,$3)`, [stream, amount, ref]);
}
const laneReserve=(key,stream,purpose='normal')=>store.reserve({key,stream,purpose,envelope:'evaluation',inputBound:12000,outputLimit:1500,requestHash:hash,model:'test-model'});
test('USD 30/15/5 limits share one ledger and existing month usage is included',async()=>{
  await prior('radar',29_999_000);
  assert.equal((await reserve()).reason,'stream_limit');
  assert.equal((await laneReserve('jobs:test:0001','jobs')).status,'reserved');
  const monthly=(await store.status()).monthly;
  assert.equal(Number(monthly.cap_micro),50_000_000);
  assert.equal(Number(monthly.streams.radar.cap_micro),30_000_000);
  assert.equal(Number(monthly.streams.jobs.cap_micro),15_000_000);
  assert.equal(Number(monthly.streams.reserve.cap_micro),5_000_000);
  assert.equal(Number(monthly.spent_micro),29_999_000);
});
test('two concurrent jobs requests cannot exceed the USD 15 allocation',async()=>{
  await prior('jobs',14_998_000);
  const results=await Promise.all([laneReserve('jobs:race:0001','jobs'),laneReserve('jobs:race:0002','jobs')]);
  assert.equal(results.filter(x=>x.status==='reserved').length,1);
  assert.equal(results.find(x=>x.status==='blocked').reason,'stream_limit');
});
test('reserve admits rechecks and recovery only and still respects USD 50 total',async()=>{
  assert.equal((await laneReserve('reserve:test:0001','reserve')).reason,'invalid_budget_stream');
  await prior('radar',30_000_000);await prior('jobs',15_000_000);await prior('reserve',4_999_000);
  assert.equal((await laneReserve('reserve:test:0002','reserve','recheck')).reason,'monthly_limit');
  await db.exec("delete from radar_ai.prior_usage where stream='reserve'");
  assert.equal((await laneReserve('reserve:test:0003','reserve','recovery')).status,'reserved');
  assert.equal((await laneReserve('reserve:test:0003','jobs')).reason,'identity_conflict');
});
test('absence of opening reconciliation and non-calendar cycles block all paid work',async()=>{
  await db.exec('delete from radar_ai.month_opening');
  assert.equal((await reserve()).reason,'monthly_usage_unverified');
  await db.exec(`insert into radar_ai.month_opening(period,reference) values(${monthSql},'synthetic-reopening');
    update radar_ai.cycle set starts_at=now()-interval '1 day'`);
  assert.equal((await reserve()).reason,'calendar_month_unverified');
});
test('switching cycle IDs within a month cannot reset spent money',async()=>{
  await prior('jobs',14_999_000);
  await db.exec(`insert into radar_ai.cycle select 'alias',product,organization_id,project_id,starts_at,ends_at,cap_micro from radar_ai.cycle;
    insert into radar_ai.attestation select 'alias',free_micro,verified_at,proof_until,free_only_verified,'synthetic-alias-proof' from radar_ai.attestation;
    update radar_ai.control set cycle_id='alias'`);
  assert.equal((await laneReserve('jobs:alias:0001','jobs')).reason,'stream_limit');
});
test('last send gate rechecks imported spend and private legacy functions cannot bypass limits',async()=>{
  const r=await laneReserve('jobs:send:0001','jobs');
  await prior('jobs',15_000_000);
  assert.equal((await store.markSent(r.id)).reason,'stream_limit');
  await assert.rejects(store.query("select radar_ai.legacy_reserve('bypass:0001','evaluation',$1,'test-model',12000,1500)",[hash]));
});
test('an uncertain previous-month charge still reduces the jobs allocation',async()=>{
  const r=await laneReserve('jobs:old-month:0001','jobs');await store.markSent(r.id);await store.finish(r.id,'unknown');
  await db.exec(`update radar_ai.operation set created_at=(date_trunc('month',now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo')-interval '1 second';
    update radar_ai.control set circuit_until=null`);
  await prior('jobs',14_999_000);
  assert.equal((await laneReserve('jobs:new-month:0001','jobs')).reason,'stream_limit');
  assert.equal(Number((await store.status()).monthly.reserved_micro),1950);
});
test('least-privilege worker cannot read/publish catalogue, edit allocations, or become editor',async()=>{
  // PGlite does not restore session authorization; use a separate disposable instance.
  const limited=worker||new PGlite({extensions:{pgcrypto}});
  if(!worker){await migrate(limited);await limited.exec('set session authorization radar_ai_worker');}
  try {
  for(const sql of ['select * from public.opportunities',"update public.official_sources set active=false",
    'update radar_ai.control set enabled=true','select * from radar_ai.attestation','set role radar_editor','set role radar_ai_owner']){
    await assert.rejects(worker?limited.query(sql):limited.exec(sql),undefined,sql);
  }
  } finally { if(!worker) await limited.close(); }
  assert.equal((await store.status()).product,'radar');
});
test('reserve uses real SQL prices, preserves identities and rejects tampering',async()=>{
  const r=await reserve();assert.equal(r.status,'reserved');assert.equal(r.maximum_micro,1950);
  assert.equal((await reserve()).status,'duplicate');
  assert.equal((await store.reserve({key:'radar:test:0001',envelope:'evaluation',inputBound:12000,outputLimit:1500,requestHash:'b'.repeat(64),model:'test-model'})).reason,'identity_conflict');
  assert.equal((await reserve('radar:test:0002','blog')).reason,'invalid_envelope');
});
test('response tariff is mandatory, bound to the approved version and worst-case reservation rate',async()=>{
  await db.exec('update radar_ai.response_tariff set cache_write_micro_per_million=125000');
  assert.equal((await reserve()).reason,'price_unverified');
  await db.exec('update radar_ai.price set input_micro_per_million=125000');
  const r=await reserve();assert.equal(r.maximum_micro,2250);assert.equal(r.response_tariff.cache_write_micro_per_million,125000);
  assert.equal(r.organization_id,'org-test');assert.equal(r.project_id,'project-test');
  await db.exec("update radar_ai.response_tariff set price_version='another'");
  assert.equal((await store.markSent(r.id)).reason,'price_changed');
  assert.equal((await reserve('radar:price:0002')).reason,'price_unverified');
  await db.exec('delete from radar_ai.response_tariff');assert.equal((await reserve('radar:price:0003')).reason,'price_unverified');
});
test('account edits after reservation cannot send to the old provider target',async()=>{
  const r=await reserve();
  await db.exec("update radar_ai.control set project_id='changed';update radar_ai.cycle set project_id='changed'");
  assert.equal((await store.markSent(r.id)).reason,'allocation_unverified');
  await assert.rejects(store.query('select radar_ai.budget_mark_sent($1)',[r.id]));
  await assert.rejects(store.query("select radar_ai.budget_reserve('bypass:0001','evaluation',$1,'test-model',12000,1500,'jobs','normal')",[hash]));
});
test('transport dispatch records actual token receipt exactly once under the shared ledger',async()=>{
  await db.exec("update radar_ai.control set organization_id='org-synthetic123',project_id='proj_synthetic123';update radar_ai.cycle set organization_id='org-synthetic123',project_id='proj_synthetic123'");
  let calls=0;
  const provider=createOpenAIProvider({apiKey:'sk-synthetic_not_a_real_key_12345',organizationId:'org-synthetic123',projectId:'proj_synthetic123',fetchImpl:async()=>{
    calls++;return new Response(JSON.stringify({id:'resp_synthetic1234',model:'test-model',service_tier:'default',status:'completed',
      output:[{type:'message',role:'assistant',content:[{type:'output_text',text:'source quote'}]}],
      usage:{input_tokens:1000,output_tokens:100,total_tokens:1100,input_tokens_details:{cached_tokens:200,cache_write_tokens:300}}}),{headers:{'content-type':'application/json','x-request-id':'req_synthetic'}});
  }});
  const request=prepareRequest('jobs:transport:0001','extraction',{model:'test-model',input:'fixture',max_output_tokens:500,store:false,service_tier:'default'},{stream:'jobs'});
  assert.equal((await dispatch({store,provider,request,onBase:()=>null})).mode,'AMPLIADO');
  await dispatch({store,provider,request,onBase:()=>null});assert.equal(calls,1);
  const op=(await db.query('select * from radar_ai.operation')).rows[0];
  assert.equal(Number(op.actual_micro),132);assert.equal(op.provider_receipt.responseId,'resp_synthetic1234');
  assert.equal(Number((await store.status()).monthly.streams.jobs.spent_micro),132);
  assert.equal((await store.finish(op.id,'confirmed',0,null,{...op.provider_receipt,responseId:'resp_another12345'})).accepted,false);
  assert.equal((await db.query('select provider_receipt from radar_ai.operation')).rows[0].provider_receipt.responseId,'resp_synthetic1234');
  await assert.rejects(store.query('select * from radar_ai.response_tariff'));
});
test('two concurrent reservations at the remaining allocation cannot exceed it',async()=>{
  await db.exec('update radar_ai.cycle set cap_micro=10; update radar_ai.price set fixed_micro=10,input_micro_per_million=0,output_micro_per_million=0; update radar_ai.response_tariff set input_micro_per_million=0,cached_input_micro_per_million=0,cache_write_micro_per_million=0,output_micro_per_million=0');
  const rows=await Promise.all([reserve('radar:cent:0001'),reserve('radar:cent:0002')]);
  assert.deepEqual(rows.map(r=>r.status).sort(),['blocked','reserved']);
});
test('concurrent send attempts admit only one provider operation',async()=>{
  const a=await reserve('radar:send:0001'),b=await reserve('radar:send:0002');
  const results=await Promise.all([store.markSent(a.id),store.markSent(b.id)]);
  assert.equal(results.filter(r=>r.sent).length,1);
  assert.equal(results.find(r=>!r.sent).reason,'worker_busy');
});
test('free credit zero, stale proof, absent billing barrier and wrong project fail before dispatch',async()=>{
  for(const [sql,reason] of [
    ['update radar_ai.attestation set free_micro=0','credit_exhausted'],
    ["update radar_ai.attestation set free_micro=50000000,proof_until=now()-interval '1 second'",'billing_unverified'],
    ["update radar_ai.attestation set proof_until=now()+interval '1 hour',free_only_verified=false",'billing_unverified'],
    ["update radar_ai.attestation set free_only_verified=true; update radar_ai.control set project_id='foreign'",'allocation_unverified'],
  ]){await db.exec(sql);assert.equal((await reserve()).reason,reason);}
});
test('mark_sent rechecks expiry, cycle and price before any network I/O',async()=>{
  const r=await reserve();await db.exec("update radar_ai.price set approved=false");
  assert.equal((await store.markSent(r.id)).reason,'price_changed');
  assert.equal(BigInt((await db.query('select state,actual_micro from radar_ai.operation')).rows[0].actual_micro),0n);
});
test('reduced credit blocks an already reserved send and releases only that unsent hold',async()=>{
  const r=await reserve();await db.exec('update radar_ai.attestation set free_micro=1000');
  assert.equal((await store.markSent(r.id)).reason,'cycle_limit');
  assert.equal(BigInt((await db.query('select actual_micro from radar_ai.operation')).rows[0].actual_micro),0n);
});
for(const [name,sql,reason] of [
  ['expired cycle',"update radar_ai.cycle set ends_at=now()-interval '1 second'",'credit_expired'],
  ['stale proof',"update radar_ai.attestation set proof_until=now()-interval '1 second'",'billing_unverified'],
  ['manual pause','update radar_ai.control set manual_paused=true','operator_pause'],
  ['expired lease',"update radar_ai.operation set created_at=now()-interval '4 minutes'",'reservation_expired'],
])test(`send rechecks ${name}`,async()=>{
  const r=await reserve();await db.exec(sql);assert.equal((await store.markSent(r.id)).reason,reason);
  assert.equal((await db.query('select state from radar_ai.operation')).rows[0].state,'not_sent');
});
test('missing control fails closed instead of creating an allocation',async()=>{
  await db.exec('delete from radar_ai.control');assert.equal((await reserve()).reason,'control_unavailable');
});
test('sent operations cannot be released as not_sent, even by a misleading provider error',async()=>{
  const r=await reserve();await store.markSent(r.id);
  await assert.rejects(store.finish(r.id,'not_sent'));
  assert.equal((await db.query('select state from radar_ai.operation')).rows[0].state,'sent');
});
test('confirmed use replaces reservation; duplicate completions cannot mutate receipts',async()=>{
  const r=await reserve();assert.equal((await store.markSent(r.id)).sent,true);
  assert.equal((await store.finish(r.id,'confirmed',1000)).accepted,true);
  assert.equal((await store.finish(r.id,'confirmed',0)).accepted,false);
  assert.equal(BigInt((await db.query('select actual_micro from radar_ai.operation')).rows[0].actual_micro),1000n);
});
test('uncertain/recovered operations remain held and cannot be released by worker',async()=>{
  const r=await reserve();await store.markSent(r.id);await store.finish(r.id,'unknown');
  assert.equal((await store.finish(r.id,'not_sent')).accepted,false);
  const row=(await db.query('select * from radar_ai.operation')).rows[0];assert.equal(BigInt(row.maximum_micro),1950n);assert.equal(row.actual_micro,null);
  await db.exec("update radar_ai.control set circuit_until=null; update radar_ai.operation set state='sent',created_at=now()-interval '10 minutes'");
  assert.equal(await store.recover(),1);assert.equal((await reserve()).status,'duplicate');
});
test('unknown old-cycle holds reduce new availability without resetting manual pauses',async()=>{
  const r=await reserve();await store.markSent(r.id);await store.finish(r.id,'unknown');
  await db.exec(`update radar_ai.control set manual_paused=true;
    insert into radar_ai.cycle values('next','radar','org-test','project-test',date_trunc('month',now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo',(date_trunc('month',now() at time zone 'America/Sao_Paulo')+interval '1 month') at time zone 'America/Sao_Paulo',2000);
    insert into radar_ai.attestation values('next',2000,now(),now()+interval '1 hour',true,'next-synthetic-proof');
    update radar_ai.control set cycle_id='next',circuit_until=null;`);
  assert.equal((await reserve('radar:next:0001')).reason,'operator_pause');
  await db.exec('update radar_ai.control set manual_paused=false');
  assert.equal((await reserve('radar:next:0001')).reason,'cycle_limit');
});
test('usage above reservation stops only AI and preserves the receipt',async()=>{
  const r=await reserve();await store.markSent(r.id);
  assert.equal((await store.finish(r.id,'confirmed',3000)).reason,'usage_exceeded_reservation');
  assert.equal((await reserve('radar:next:0001')).reason,'operator_pause');
  assert.equal(BigInt((await db.query('select actual_micro from radar_ai.operation')).rows[0].actual_micro),3000n);
});
test('fake credit-exhausted provider is called once; subsequent work serves the base',async()=>{
  let called=0,bases=0;
  const request=prepareRequest('radar:dispatch:0001','evaluation',{model:'test-model',input:'fixture',max_output_tokens:500,tools:[]});
  const provider=async()=>{called++;throw Object.assign(Error(),{code:'credit_balance_exhausted',status:429});};
  for(let n=0;n<2;n++)await dispatch({store,request:{...request,key:`radar:dispatch:000${n+1}`},provider,onBase:()=>{bases++;return ['base'];}});
  assert.equal(called,1);assert.equal(bases,2);assert.equal((await store.status()).manual_paused,false);
});

async function enqueue(key='radar:queue:0001',revision='1'.repeat(64)){
  const request=prepareRequest(key,'evaluation',{model:'test-model',input:'fixture',max_output_tokens:100});
  await db.query("select set_config('app.is_admin','true',false)");
  return (await db.query('select radar_ai.enqueue($1,$2,$3,$4,$5,$6,now()+interval \'1 hour\') as result',
    [key,'fixture-subject',revision,request.requestHash,request.envelope,request.body])).rows[0].result;
}
test('queue is private, idempotent and cannot dispatch without a transport',async()=>{
  assert.equal((await enqueue()).status,'queued');assert.equal((await enqueue()).status,'duplicate');
  assert.equal((await enqueue('radar:queue:alias')).status,'duplicate');
  assert.equal((await processOne({store})).reason,'transport_disabled');
  assert.equal((await db.query('select state from radar_ai.task')).rows[0].state,'pending');
  await assert.rejects(store.query("select radar_ai.reconcile(gen_random_uuid(),'not_sent',0,'fake-receipt')"));
});
test('queued content survives JSONB ordering, produces only one private proposal and receipt',async()=>{
  await enqueue();let calls=0;
  const provider=async()=>{calls++;return {costMicro:100,value:{title:'proposal'}};};
  assert.equal((await processOne({store,provider})).mode,'AMPLIADO');
  await processOne({store,provider});assert.equal(calls,1);
  assert.equal((await db.query('select count(*)::int as count from radar_ai.proposal')).rows[0].count,1);
  const task=(await db.query('select id,revision from radar_ai.task')).rows[0];
  assert.equal((await db.query('select radar_ai.read_proposal($1,$2) as r',[task.id,task.revision])).rows[0].r.proposal.title,'proposal');
  assert.equal((await db.query('select radar_ai.read_proposal($1,$2) as r',[task.id,'0'.repeat(64)])).rows[0].r,null);
  await db.query("select set_config('app.is_admin','false',false)");
  await assert.rejects(db.query('select radar_ai.read_proposal($1,$2)',[task.id,task.revision]));
});
test('incomplete model output is charged once, held and never exposed as a complete proposal',async()=>{
  await enqueue();let calls=0;
  const provider=async()=>{calls++;return {costMicro:100,value:{complete:false,text:'unfinished'}};};
  assert.equal((await processOne({store,provider})).reason,'incomplete_response');
  await processOne({store,provider});assert.equal(calls,1);
  assert.equal((await db.query('select count(*)::int as count from radar_ai.proposal')).rows[0].count,0);
  assert.equal((await db.query('select state from radar_ai.task')).rows[0].state,'held');
  assert.equal(Number((await store.status()).monthly.spent_micro),100);
});
test('new revision rejects the old task lease and late proposal without resending',async()=>{
  await enqueue();const {task}=await store.claimTask();
  await enqueue('radar:queue:0002','2'.repeat(64));
  const request=prepareRequest(task.task_key,task.envelope,task.body),r=await store.reserve(request);
  assert.equal(await store.attachTask(task.id,task.lease_token,r.id),false);
  assert.equal(await store.completeTask(task.id,task.lease_token,{late:true}),false);
  assert.equal((await db.query('select state from radar_ai.task where id=$1',[task.id])).rows[0].state,'stale');
});
test('supersession after reservation attachment still blocks the final send gate',async()=>{
  await enqueue();const {task}=await store.claimTask();
  const r=await store.reserve(prepareRequest(task.task_key,task.envelope,task.body));
  assert.equal(await store.attachTask(task.id,task.lease_token,r.id),true);
  await enqueue('radar:queue:0002','2'.repeat(64));
  assert.equal((await store.markSent(r.id)).reason,'task_changed');
});
test('operator reconciliation preserves audit/pauses and never requeues unknown work',async()=>{
  await enqueue();await processOne({store,provider:async()=>{throw Error('uncertain');}});
  const {operation_id:id,state}=(await db.query('select operation_id,state from radar_ai.task')).rows[0];
  assert.equal(state,'held');
  await db.exec('update radar_ai.control set manual_paused=true');
  assert.equal((await db.query("select radar_ai.reconcile($1,'confirmed',100,'synthetic-receipt-0001') as r",[id])).rows[0].r.accepted,true);
  assert.equal((await db.query("select radar_ai.reconcile($1,'confirmed',0,'synthetic-receipt-0002') as r",[id])).rows[0].r.accepted,false);
  assert.equal((await db.query('select state from radar_ai.task')).rows[0].state,'held');
  assert.equal((await store.status()).manual_paused,true);
});
