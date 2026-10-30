import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pollGoogleCalendar,monitorConfig,checkMonitorSnapshot} from '../scripts/google-calendar-monitor.mjs';
import {opportunityLoader} from './helpers/load-opportunity-module.mjs';
const now=Date.parse('2026-10-30T12:00:00Z');
const body=()=>({healthy:true,workerHealthy:true,workerHeartbeatAt:new Date(now).toISOString(),connected:10,due:0,ready:0,lagSeconds:0,errors:0,reconnect:0,quota:0,paused:0,retrying:0,capacity:{providerAttempts:20,p95DurationMs:2000,estimateAvailable:true,estimatedDrainSeconds:0}});
const poll=options=>pollGoogleCalendar({origin:'http://127.0.0.1:9999',secret:'PRIVATE_READ_ONLY',now:()=>now,...options});

test('monitor config requires an explicit origin and enforces loopback-only local testing',()=>{
  assert.throws(()=>monitorConfig({}));
  assert.throws(()=>monitorConfig({GOOGLE_CALENDAR_MONITOR_ORIGIN:'http://example.invalid',GOOGLE_CALENDAR_MONITOR_SECRET:'a'.repeat(32)}));
  assert.throws(()=>monitorConfig({APOGEE_LOCAL_PREVIEW:'1',GOOGLE_CALENDAR_MONITOR_ORIGIN:'https://www.apogee.community',GOOGLE_CALENDAR_MONITOR_SECRET:'a'.repeat(32)}));
  const config=monitorConfig({APOGEE_LOCAL_PREVIEW:'1',GOOGLE_CALENDAR_MONITOR_ORIGIN:'http://127.0.0.1:1234',GOOGLE_CALENDAR_MONITOR_SECRET:'a'.repeat(32)});
  assert.equal(config.intervalSeconds,60);assert.equal(config.webhook,undefined);
});
test('monitor uses only GET and catches a stale worker even with an empty healthy-looking queue',async()=>{
  let request;const data=body();data.workerHeartbeatAt=new Date(now-241000).toISOString();
  const result=await poll({fetcher:async(url,init)=>{request=init;return Response.json(data);}});
  assert.equal(request.method,'GET');assert.equal(request.redirect,'error');assert.equal(request.headers.Authorization,'Bearer PRIVATE_READ_ONLY');
  assert.equal(result.status,'warning');assert.equal(result.workerStale,true);assert.equal(result.ready,0);
});
test('fresh heartbeat with healthy metrics recovers; future and missing heartbeat fail closed',async()=>{
  assert.equal((await poll({fetcher:async()=>Response.json(body())})).status,'ok');
  for(const value of [null,new Date(now+1000).toISOString()]){const data=body();data.workerHeartbeatAt=value;assert.equal((await poll({fetcher:async()=>Response.json(data)})).workerStale,true);}
});
test('503 reports remain inspectable and capacity pressure is distinct from latency backlog',async()=>{
  const data=body();data.healthy=false;data.quota=1;data.errors=1;
  const result=await poll({fetcher:async()=>Response.json(data,{status:503})});assert.equal(result.status,'warning');assert.equal(result.quota,1);
  const pressure=body();pressure.capacity.estimatedDrainSeconds=901;
  assert.equal((await poll({fetcher:async()=>Response.json(pressure)})).capacityPressure,true);
});
test('network, authentication, redirects, malformed and oversized responses produce sanitized failures',async()=>{
  for(const fetcher of [async()=>{throw Error('PRIVATE_PROVIDER_BODY');},async()=>new Response('PRIVATE',{status:401}),async()=>new Response('PRIVATE',{status:302}),async()=>new Response('bad json'),async()=>new Response('x'.repeat(65537)),async()=>Response.json({healthy:true})]){
    const result=await poll({fetcher});assert.equal(result.status,'failed');assert.equal(result.endpointUnavailable,true);assert.doesNotMatch(JSON.stringify(result),/PRIVATE|Bearer/);
  }
});
test('unknown response fields and private provider values never enter monitor output',async()=>{
  const data={...body(),user_id:'DO_NOT_LOG',secret:'DO_NOT_LOG',token:'DO_NOT_LOG'};
  Object.assign(data.capacity,{user_id:'DO_NOT_LOG',providerBody:'DO_NOT_LOG',meanDurationMs:1000,googleCalls:80,successRate:1,estimatedFullSyncsPer15Minutes:385});
  const result=await poll({fetcher:async()=>Response.json(data)});
  assert.doesNotMatch(JSON.stringify(result),/DO_NOT_LOG|user_id|secret|token|providerBody/);
  assert.equal(result.capacity.meanDurationMs,1000);assert.equal(result.capacity.googleCalls,80);assert.equal(result.capacity.estimatedFullSyncsPer15Minutes,385);assert.equal(result.capacity.successRate,1);
  data.capacity.successRate=99;assert.equal((await poll({fetcher:async()=>Response.json(data)})).capacity.successRate,null);
});
test('monitor own health checks liveness even while its target is down, with bounded freshness',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'monitor-health-')),file=join(dir,'status.json');
  try{assert.equal(await checkMonitorSnapshot(file,180,now),false);
    await writeFile(file,JSON.stringify({at:new Date(now).toISOString(),status:'failed'}));assert.equal(await checkMonitorSnapshot(file,180,now),true);
    assert.equal(await checkMonitorSnapshot(file,180,now+181000),false);assert.equal(await checkMonitorSnapshot(file,180,now-1000),false);
  }finally{await rm(dir,{recursive:true});}
});
test('read-only monitor credential can inspect health but cannot process accounts or write heartbeats',async()=>{
  const names=['GOOGLE_CALENDAR_SYNC_SECRET','GOOGLE_CALENDAR_MONITOR_SECRET'],old=names.map(n=>process.env[n]);
  process.env[names[0]]='s'.repeat(32);process.env[names[1]]='m'.repeat(32);let runs=0,beats=0;
  const route=opportunityLoader({'@/lib/opportunities/google-calendar-sync':{syncDueGoogleCalendars:async()=>{runs++;return 0;}},
    '@/lib/opportunities/google-calendar-queue':{googleQueuePolicy:()=>({batchSize:3,maxLagSeconds:900}),googleQueueStatus:async()=>({configured:true,lagSeconds:0,workerHealthy:true}),recordGoogleWorkerHeartbeat:async()=>{beats++;}}})('app/api/internal/google-agenda/sync/route.ts');
  const request=secret=>new Request('http://localhost',{headers:{Authorization:'Bearer '+secret}});
  try{assert.equal((await route.GET(request('m'.repeat(32)))).status,200);assert.equal((await route.POST(request('m'.repeat(32)))).status,401);assert.equal(runs,0);assert.equal(beats,0);
    assert.equal((await route.POST(request('s'.repeat(32)))).status,200);assert.equal(runs,1);assert.equal(beats,2);
    process.env[names[1]]=process.env[names[0]];assert.equal((await route.GET(request('s'.repeat(32)))).status,401);assert.equal((await route.POST(request('s'.repeat(32)))).status,401);
  }finally{names.forEach((n,i)=>{if(old[i]===undefined)delete process.env[n];else process.env[n]=old[i];});}
});
