import { afterAll,beforeAll,beforeEach,expect,it,vi } from 'vitest';
import { readFile,readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import type { PoolClient } from 'pg';
const state=vi.hoisted(()=>({db:null as PGlite|null}));
vi.mock('@/lib/db/client',()=>({withAdminTransaction:(work:(tx:PoolClient)=>Promise<unknown>)=>state.db!.transaction(async tx=>{
  await tx.exec("set local role radar_editor;select set_config('app.is_admin','true',true)");
  return work(tx as unknown as PoolClient);
})}));
import { discoveryAdviceRequest,validateDiscoveryAdvice,runAutomaticDiscoveryAdvice } from '@/lib/discovery/automatic-ai';
import { claimDueDiscoveryLeads } from '@/lib/discovery/process-leads';
const target='automatic-advice-test';
const lead={id:'11111111-1111-4111-8111-111111111111',url:'https://official.example.org/call/one',title:'Bolsa de pesquisa em tecnologia',excerpt:'Inscrições abertas.',target_url:'https://official.example.org/'};
beforeAll(async()=>{
  state.db=new PGlite({extensions:{pgcrypto}});
  const dir=new URL('../../db/migrations/',import.meta.url);
  for(const f of (await readdir(dir)).filter(f=>f.endsWith('.sql')).sort())await state.db.exec(await readFile(new URL(f,dir),'utf8'));
  await state.db.exec(`insert into radar_ai.cycle values('advice-fixture','radar','org-fixture01','proj_fixture01',
    date_trunc('month',now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo',
    (date_trunc('month',now() at time zone 'America/Sao_Paulo')+interval '1 month') at time zone 'America/Sao_Paulo',50000000);
    update radar_ai.control set enabled=true,cycle_id='advice-fixture',organization_id='org-fixture01',project_id='proj_fixture01';
    insert into radar_ai.attestation values('advice-fixture',50000000,now(),now()+interval '6 hours',true,'fixture-financial-proof');
    insert into radar_ai.month_opening values(date_trunc('month',now() at time zone 'America/Sao_Paulo')::date,'fixture-advice-month',now());
    insert into radar_ai.price values('gpt-6-luna','fixture-advice-price',true,now()+interval '6 hours',125000,500000,0);
    insert into radar_ai.response_tariff values('gpt-6-luna','fixture-advice-price',true,now()+interval '6 hours',100000,10000,125000,500000);
    insert into discovery_targets(id,name,organizer,kind,official_url,evidence_url,enabled,official_verified_at,official_verified_url,official_verified_by,official_review_note)
      values('${target}','Fixture','Fixture','site','${lead.target_url}','${lead.target_url}',true,now(),'${lead.target_url}','test:fixture','Authority and collection confirmed with synthetic fixtures.');`);
},60000);
afterAll(async()=>{await state.db?.close()});
beforeEach(async()=>{
  await state.db!.exec("delete from discovery_priority_hints;delete from discovery_leads;delete from ingestion_runs;delete from radar_ai.proposal;delete from radar_ai.task;delete from radar_ai.operation;update radar_ai.control set enabled=true;update discovery_targets set enabled=true where id='automatic-advice-test'");
  await state.db!.query('insert into discovery_leads(id,target_id,url,title,excerpt) values($1,$2,$3,$4,$5)',[lead.id,target,lead.url,lead.title,lead.excerpt]);
});
function proposed(ids:unknown,patch:Record<string,unknown>={}) {
  const {request,revision}=discoveryAdviceRequest('2026-11-17','radar',[lead]);
  return {id:'22222222-2222-4222-8222-222222222222',key:request.key,revision,requestHash:request.requestHash,
    stream:'radar' as const,body:request.body,expiresAt:'2099-01-01T00:00:00Z',result:{proposal:{complete:true,text:JSON.stringify({leadIds:ids})}},...patch};
}
it('rejects fabricated IDs, duplicates, extra fields and tampered request snapshots',()=>{
  expect(validateDiscoveryAdvice(proposed([lead.id]))).toEqual([lead]);
  expect(()=>validateDiscoveryAdvice(proposed(['not-supplied']))).toThrow();
  expect(()=>validateDiscoveryAdvice(proposed([lead.id,lead.id]))).toThrow();
  expect(()=>validateDiscoveryAdvice(proposed([lead.id],{revision:'0'.repeat(64)}))).toThrow();
  expect(()=>validateDiscoveryAdvice(proposed([lead.id],{result:{proposal:{complete:true,text:JSON.stringify({leadIds:[lead.id],url:'https://evil.invalid'})}}}))).toThrow();
});
it('enqueues at most one bounded text task per lane and civil day, despite repeated calls',async()=>{
  expect(await runAutomaticDiscoveryAdvice()).toMatchObject({queued:1,mode:'AMPLIADO'});
  expect(await runAutomaticDiscoveryAdvice()).toMatchObject({queued:0});
  const tasks=(await state.db!.query<{body:Record<string,unknown>;stream:string}>('select body,stream from radar_ai.task')).rows;
  expect(tasks).toHaveLength(1);expect(tasks[0].stream).toBe('radar');
  expect(tasks[0].body).toMatchObject({model:'gpt-6-luna',store:false,service_tier:'default',max_output_tokens:600});
  expect(tasks[0].body.tools).toBeUndefined();
});
it('keeps professional and other discovery inside their existing 15 and 30 dollar lanes',async()=>{
  await state.db!.query('insert into discovery_leads(target_id,url,title) values($1,$2,$3)',[target,lead.target_url+'jobs/fde','Forward Deployed Engineer Brazil']);
  expect(await runAutomaticDiscoveryAdvice()).toMatchObject({queued:2});
  expect((await state.db!.query<{stream:string}>('select stream from radar_ai.task order by stream')).rows.map(r=>r.stream)).toEqual(['jobs','radar']);
});
it('continues without a paid task when financial control is disabled',async()=>{
  await state.db!.exec('update radar_ai.control set enabled=false');
  expect(await runAutomaticDiscoveryAdvice()).toMatchObject({mode:'BASE',reason:'disabled',queued:0});
  expect((await state.db!.query('select * from radar_ai.task')).rows).toHaveLength(0);
});
async function complete(ids:string[]) {
  await runAutomaticDiscoveryAdvice();
  const task=(await state.db!.query<{id:string;revision:string}>("select id,revision from radar_ai.task where stream='radar'")).rows[0];
  await state.db!.query(`with op as (insert into radar_ai.operation(cycle_id,operation_key,request_hash,envelope,model,price_snapshot,maximum_micro,actual_micro,state,stream)
    select 'advice-fixture',task_key,request_hash,envelope,'gpt-6-luna','{}'::jsonb,1000,100,'confirmed',stream from radar_ai.task where id=$1 returning id)
    update radar_ai.task set operation_id=op.id,state='proposed' from op where radar_ai.task.id=$1`,[task.id]);
  await state.db!.query('insert into radar_ai.proposal select id,operation_id,revision,$2,now() from radar_ai.task where id=$1',[task.id,{text:JSON.stringify({leadIds:ids}),complete:true}]);
}
it('applies a confirmed ranking once, selects its lead first, and never publishes model output',async()=>{
  await state.db!.query('insert into discovery_leads(target_id,url,title,first_seen_at) values($1,$2,$3,now()+interval \'1 minute\')',[target,lead.target_url+'call/two',lead.title]);
  await complete([lead.id]);
  expect(await runAutomaticDiscoveryAdvice()).toMatchObject({applied:1,queued:0});
  expect(await runAutomaticDiscoveryAdvice()).toMatchObject({applied:0,queued:0});
  expect((await claimDueDiscoveryLeads(1,[],false,false))[0].id).toBe(lead.id);
  expect((await state.db!.query('select * from opportunities where official_source_id like \'automatic-advice%\'')).rows).toHaveLength(0);
});
it('does not apply a proposal after a lead URL or target authority changes',async()=>{
  await complete([lead.id]);await state.db!.query('update discovery_leads set url=$2 where id=$1',[lead.id,lead.target_url+'changed']);
  expect(await runAutomaticDiscoveryAdvice()).toMatchObject({applied:0});
  expect((await state.db!.query('select * from discovery_priority_hints')).rows).toHaveLength(0);
});
it.each([null,'processing_budget_exhausted'])('reserves the fresh round ahead of older AI advice (previous reason: %s)',async(reason)=>{
  await state.db!.query("update discovery_leads set first_seen_at=now()-interval '2 days',processing_reason=$2 where id=$1",[lead.id,reason]);
  await complete([lead.id]);
  expect(await runAutomaticDiscoveryAdvice()).toMatchObject({applied:1});
  const fresh=(await state.db!.query<{id:string}>('insert into discovery_leads(target_id,url,title) values($1,$2,$3) returning id',[target,lead.target_url+'call/fresh','Hackathon novo'])).rows[0];
  expect((await claimDueDiscoveryLeads(1,[],false,true))[0].id).toBe(fresh.id);
  expect((await claimDueDiscoveryLeads(1,[],false,false))[0].id).toBe(lead.id);
});
it('rejects a malicious result without adding a priority or repaying for a replacement',async()=>{
  await complete(['33333333-3333-4333-8333-333333333333']);
  expect(await runAutomaticDiscoveryAdvice()).toMatchObject({rejected:1,applied:0,queued:0});
  expect(await runAutomaticDiscoveryAdvice()).toMatchObject({rejected:0,queued:0});
  expect((await state.db!.query('select * from discovery_priority_hints')).rows).toHaveLength(0);
});
it('does not expose task context or priority hints to the public reader or AI worker',async()=>{
  for(const role of ['radar_reader','radar_ai_worker']) {
    await expect(state.db!.transaction(async tx=>{await tx.exec(`set local role ${role}`);return tx.query('select * from discovery_priority_hints')})).rejects.toThrow();
    await expect(state.db!.transaction(async tx=>{await tx.exec(`set local role ${role}`);return tx.query('select radar_ai.automatic_discovery_context()')})).rejects.toThrow();
  }
});
it('keeps the indexed history identity synchronized and preserves malformed metadata as unknown',async()=>{
  const id='abcdefab-1111-4111-8111-111111111111';
  for(const raw of [id,id.toUpperCase(),'not-a-uuid',null,123]) {
    const row=(await state.db!.query<{id:string;discovery_lead_id:string|null}>(`insert into ingestion_runs(started_at,status,execution_metadata)
      values(now(),'completed',$1) returning id,discovery_lead_id`,[{lead_id:raw}])).rows[0];
    expect(row.discovery_lead_id).toBe(raw===id?id:null);
    await state.db!.query("update ingestion_runs set execution_metadata=execution_metadata-'lead_id' where id=$1",[row.id]);
    expect((await state.db!.query<{discovery_lead_id:string|null}>('select discovery_lead_id from ingestion_runs where id=$1',[row.id])).rows[0].discovery_lead_id).toBeNull();
  }
});
