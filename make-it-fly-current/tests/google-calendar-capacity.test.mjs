import test from 'node:test';
import assert from 'node:assert/strict';
import {opportunityLoader} from './helpers/load-opportunity-module.mjs';
const queue={ready:30,errors:0,reconnect:0,paused:0,cooldownUntil:null};
const sample=()=>({attempts:25,provider_attempts:20,synced:20,partial:0,failed:0,mean_ms:'1000',p95_ms:2000,google_calls:'80',http_errors:'2',network_errors:'0',quota_responses:'0',events_changed:'30'});
const capacity=row=>opportunityLoader({'@/lib/members/db':{getSql:()=>async()=>[row]}})('lib/opportunities/google-calendar-capacity.ts');
test('capacity distinguishes observed throughput from a conservative single-worker drain estimate',async()=>{
  const result=await capacity(sample()).googleCapacitySnapshot(queue,3);
  assert.equal(result.p95DurationMs,2000);assert.equal(result.meanDurationMs,1000);assert.equal(result.successRate,1);
  assert.equal(result.observedSyncedPerMinute,20/15);assert.equal(result.estimatedDrainSeconds,70);assert.equal(result.estimatedFullSyncsPer15Minutes,385);assert.equal(result.googleCalls,80);
});
test('empty samples are unknown rather than zero-latency or unlimited capacity',async()=>{
  const result=await capacity({}).googleCapacitySnapshot(queue,3);
  assert.equal(result.p95DurationMs,null);assert.equal(result.successRate,null);assert.equal(result.estimateAvailable,false);assert.equal(result.estimatedDrainSeconds,null);
});
test('insufficient samples, errors, quotas, partial work and paused connections suppress projections',async()=>{
  for(const patch of [{provider_attempts:19},{failed:1},{partial:1},{quota_responses:1}])assert.equal((await capacity({...sample(),...patch}).googleCapacitySnapshot(queue,3)).estimateAvailable,false);
  for(const patch of [{errors:1},{paused:1},{reconnect:1},{cooldownUntil:'2026-10-30T12:00:00Z'}])assert.equal((await capacity(sample()).googleCapacitySnapshot({...queue,...patch},3)).estimateAvailable,false);
});
test('metrics policy rejects unbounded history window and unsafe worker freshness thresholds',()=>{
  const names=['GOOGLE_CALENDAR_METRICS_WINDOW_MINUTES','GOOGLE_CALENDAR_WORKER_MAX_AGE_SECONDS'];const old=names.map(n=>process.env[n]);
  try{process.env[names[0]]='99999';assert.throws(()=>capacity({}).googleMetricsPolicy());delete process.env[names[0]];process.env[names[1]]='10';assert.throws(()=>capacity({}).googleMetricsPolicy());}
  finally{names.forEach((n,i)=>{if(old[i]===undefined)delete process.env[n];else process.env[n]=old[i];});}
});
