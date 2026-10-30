import test from 'node:test';
import assert from 'node:assert/strict';
import {writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {syncBatch,checkHeartbeat} from '../scripts/google-calendar-worker.mjs';
import {opportunityLoader} from './helpers/load-opportunity-module.mjs';

test('worker drains more than one batch, backs off at empty queue, and never overlaps requests',async()=>{
  const sizes=[{processed:3,due:7},{processed:3,due:4},{processed:3,due:1},{processed:1,due:0}];
  const records=[];let calls=0,active=0;
  const options={origin:'http://web:3000',secret:'synthetic-secret',record:async r=>records.push(r),log:()=>{},fetcher:async(url,init)=>{
    assert.equal(String(url),'http://web:3000/api/internal/google-agenda/sync');
    assert.equal(init.redirect,'error');assert.equal(init.headers.Authorization,'Bearer synthetic-secret');
    assert.equal(active++,0);const body=sizes[calls++];active--;
    return Response.json({...body,healthy:true,connected:10,errors:0,reconnect:0,lagSeconds:0});
  }};
  for(let i=0;i<4;i++)assert.equal((await syncBatch(options)).drain,i<3);
  assert.equal(records.reduce((sum,r)=>sum+r.processed,0),10);assert.equal(calls,4);
});
test('provider failures, invalid JSON and redirects back off without exposing secrets or response bodies',async()=>{
  for(const fetcher of [async()=>new Response('SENSITIVE',{status:503}),async()=>Response.json({}),async()=>{throw Error('TOKEN_SECRET');}]){
    const records=[],logs=[];
    const result=await syncBatch({origin:'http://web:3000',secret:'TOKEN_SECRET',fetcher,record:async r=>records.push(r),log:l=>logs.push(l)});
    assert.deepEqual(result,{drain:false,healthy:false});assert.equal(records[0].status,'failed');
    assert.doesNotMatch(logs.join(''),/SENSITIVE|TOKEN_SECRET/);
  }
});
test('heartbeat rejects missing, stale, future and unhealthy states',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'google-calendar-health-'));const file=join(dir,'status.json');const now=Date.now();
  try {
    assert.equal(await checkHeartbeat(file,now),false);
    for(const [offset,status,expected] of [[0,'ok',true],[-241000,'ok',false],[1000,'ok',false],[0,'failed',false],[0,'warning',false]]){
      await writeFile(file,JSON.stringify({at:new Date(now+offset).toISOString(),status}));assert.equal(await checkHeartbeat(file,now),expected);
    }
  }finally{await rm(dir,{recursive:true});}
});
test('protected monitoring reports backlog as unhealthy and does not run sync',async()=>{
  let lag=1000,runs=0;
  const route=opportunityLoader({
    '@/lib/opportunities/google-calendar-sync':{syncDueGoogleCalendars:async()=>{runs++;return 3;}},
    '@/lib/opportunities/google-calendar-queue':{recordGoogleWorkerHeartbeat:async()=>{},googleQueuePolicy:()=>({batchSize:3,maxLagSeconds:900}),googleQueueStatus:async()=>({configured:true,due:10,connected:20,lagSeconds:lag,errors:2,reconnect:1})},
  })('app/api/internal/google-agenda/sync/route.ts');
  const previous=process.env.GOOGLE_CALENDAR_SYNC_SECRET;process.env.GOOGLE_CALENDAR_SYNC_SECRET='a'.repeat(32);
  const request=()=>new Request('http://localhost',{headers:{Authorization:'Bearer '+'a'.repeat(32)}});
  try {
    assert.equal((await route.GET(new Request('http://localhost'))).status,401);
    const delayed=await route.GET(request());assert.equal(delayed.status,503);assert.equal((await delayed.json()).due,10);assert.equal(runs,0);
    lag=0;assert.equal((await route.GET(request())).status,503,'Errors/reconnections require attention even without lag');
    assert.equal((await (await route.POST(request())).json()).processed,3);assert.equal(runs,1);
  }finally{if(previous===undefined)delete process.env.GOOGLE_CALENDAR_SYNC_SECRET;else process.env.GOOGLE_CALENDAR_SYNC_SECRET=previous;}
});
test('queue reports only aggregate metrics and validates resource limits',async()=>{
  const queue=opportunityLoader({
    './google-calendar-config':{googleCalendarConfig:()=>({})},
    '@/lib/members/db':{getSql:()=>async()=>[{connected:100,due:7,oldest_due_at:new Date(Date.now()-2000),errors:2,reconnect:1}]},
  })('lib/opportunities/google-calendar-queue.ts');
  const status=await queue.googleQueueStatus();assert.equal(status.connected,100);assert.equal(status.due,7);assert.ok(status.lagSeconds>=2);
  assert.doesNotMatch(JSON.stringify(status),/user_id|token|secret/);
  const previous=process.env.GOOGLE_CALENDAR_SYNC_BATCH_SIZE;
  try{process.env.GOOGLE_CALENDAR_SYNC_BATCH_SIZE='1000';assert.throws(()=>queue.googleQueuePolicy());process.env.GOOGLE_CALENDAR_SYNC_BATCH_SIZE='10';assert.equal(queue.googleQueuePolicy().batchSize,10);}
  finally{if(previous===undefined)delete process.env.GOOGLE_CALENDAR_SYNC_BATCH_SIZE;else process.env.GOOGLE_CALENDAR_SYNC_BATCH_SIZE=previous;}
});
