import { beforeAll,beforeEach,afterAll,it,expect } from 'vitest';
import { readFile,readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
let db:PGlite;
beforeAll(async()=>{
 db=new PGlite({extensions:{pgcrypto}});const dir=new URL('../../db/migrations/',import.meta.url);
 for(const f of (await readdir(dir)).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL(f,dir),'utf8'));
 await db.exec(`insert into radar_ai.cycle values('finance-fixture','radar','org-fixture01','proj_fixture01',
 date_trunc('month',now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo',
 (date_trunc('month',now() at time zone 'America/Sao_Paulo')+interval '1 month') at time zone 'America/Sao_Paulo',50000000);
 update radar_ai.control set cycle_id='finance-fixture',organization_id='org-fixture01',project_id='proj_fixture01';
 insert into radar_ai.attestation values('finance-fixture',50000000,now()-interval '2 hours',now()-interval '1 hour',true,'fixture-finance-proof');
 insert into radar_ai.month_opening values(date_trunc('month',now() at time zone 'America/Sao_Paulo')::date,'fixture-month-opening',now());
 insert into radar_ai.prior_usage(period,stream,amount_micro,reference) select period,'radar',100,'fixture-prior-use' from radar_ai.month_opening;
 insert into radar_ai.price values('gpt-6-luna','fixture-price',true,now()-interval '1 hour',125000,500000,0);
 insert into radar_ai.response_tariff values('gpt-6-luna','fixture-price',true,now()-interval '1 hour',100000,10000,125000,500000);
 insert into radar_ai.reconciliation_anchor(cycle_id,period,free_grant_micro,grant_until,provider_baseline_micro,radar_baseline_micro,last_provider_micro,reference,auto_reload_off,tariff)
 select 'finance-fixture',period,100000000,now()+interval '1 day',100,100,100,'fixture-free-grant',true,
 '{"input":100000,"output":500000,"cached":10000,"write":125000}' from radar_ai.month_opening;`);
},60000);
afterAll(async()=>{await db?.close()});
beforeEach(async()=>{await db.exec(`update radar_ai.control set enabled=true,manual_paused=false,organization_id='org-fixture01';
 update radar_ai.reconciliation_anchor set last_provider_micro=100,grant_until=now()+interval '1 day',free_grant_micro=100000000;
 update radar_ai.attestation set free_only_verified=true;update radar_ai.response_tariff set output_micro_per_million=500000;
 delete from radar_ai.operation;`)});
async function refresh(cost=100,at='now()') {
 return db.transaction(async tx=>{await tx.exec('set local role radar_ai_reconciler');return (await tx.query<{v:Record<string,unknown>}>(`select radar_ai.refresh_reconciliation($1,${at},'fixture-provider-proof') v`,[cost])).rows[0].v;});
}
it('renews expired proof for two hours without changing the monthly cap or its lanes',async()=>{
 expect(await refresh()).toMatchObject({updated:true,capMicro:50000000,freeRemainingMicro:100000000});
 const s=(await db.query<{v:{budget_block:null;monthly:{cap_micro:number;streams:Record<string,{cap_micro:number}>}}}>('select radar_ai.status() v')).rows[0].v;
 expect(s.budget_block).toBeNull();expect(s.monthly.cap_micro).toBe(50000000);
 expect(Object.fromEntries(Object.entries(s.monthly.streams).map(([k,v])=>[k,v.cap_micro]))).toEqual({radar:30000000,jobs:15000000,reserve:5000000});
 expect((await db.query<{ok:boolean}>('select proof_until<=verified_at+interval \'2 hours\' ok from radar_ai.attestation')).rows[0].ok).toBe(true);
});
it('refuses stale or decreasing provider costs',async()=>{
 await refresh(200);await expect(refresh(199)).rejects.toThrow('Invalid provider evidence');
 await expect(refresh(200,"now()-interval '6 minutes'")).rejects.toThrow('Invalid provider evidence');
});
it('never overrides operator pause, a changed account or an expired credit anchor',async()=>{
 await db.exec('update radar_ai.control set manual_paused=true');expect(await refresh()).toMatchObject({updated:false,reason:'operator_control'});
 await db.exec("update radar_ai.control set manual_paused=false,organization_id='org-other01'");expect(await refresh()).toMatchObject({updated:false,reason:'anchor_unavailable'});
 await db.exec("update radar_ai.control set organization_id='org-fixture01';update radar_ai.reconciliation_anchor set grant_until=now()-interval '1 minute'");
 expect(await refresh()).toMatchObject({updated:false});
});
it('retains uncertain commitments and reduces available credit using greater local or provider consumption',async()=>{
 await db.exec(`update radar_ai.reconciliation_anchor set free_grant_micro=1000;
 insert into radar_ai.operation(operation_key,cycle_id,envelope,request_hash,model,price_snapshot,maximum_micro,state)
 values('uncertain-fixture','finance-fixture','evaluation','fixture-hash','gpt-6-luna','{}',600,'unknown')`);
 expect(await refresh(300)).toMatchObject({updated:true,freeRemainingMicro:400});
 expect((await db.query<{state:string}>('select state from radar_ai.operation')).rows[0].state).toBe('unknown');
 expect(await refresh(1200)).toMatchObject({updated:true,freeRemainingMicro:0});
 expect((await db.query<{v:string}>('select radar_ai.block_reason() v')).rows[0].v).toBe('credit_exhausted');
});
it('requires approved unchanged tariff and a manually opened current month',async()=>{
 await db.exec('update radar_ai.response_tariff set output_micro_per_million=999999');expect(await refresh()).toMatchObject({updated:false,reason:'price_changed'});
 await db.exec("update radar_ai.response_tariff set output_micro_per_million=500000;update radar_ai.month_opening set verified_at=now()+interval '1 day'");
 expect(await refresh()).toMatchObject({updated:false,reason:'monthly_usage_unverified'});
 await db.exec('update radar_ai.month_opening set verified_at=now()');
});
it('does not grant financial writes or arbitrary SQL access to application roles',async()=>{
 for(const role of ['radar_reader','radar_editor','radar_ai_worker'])await expect(db.transaction(async tx=>{
  await tx.exec(`set local role ${role}`);return tx.query("select radar_ai.refresh_reconciliation(100,now(),'fixture-forbidden')");
 })).rejects.toThrow();
 await expect(db.transaction(async tx=>{await tx.exec('set local role radar_ai_reconciler');return tx.query('select * from radar_ai.reconciliation_anchor')})).rejects.toThrow();
});
