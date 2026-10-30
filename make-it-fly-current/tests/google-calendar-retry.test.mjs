import test from 'node:test';
import assert from 'node:assert/strict';
import {opportunityLoader} from './helpers/load-opportunity-module.mjs';
const load=opportunityLoader({'@/lib/members/mail':{applicationOrigin:()=> 'http://127.0.0.1:4381'},
  './google-calendar-config':{requiredGoogleCalendarConfig:()=>({clientId:'synthetic',clientSecret:'synthetic'}),GOOGLE_CALENDAR_SCOPE:'calendar.app.created'}});
const retry=load('lib/opportunities/google-calendar-retry.ts');
const client=load('lib/opportunities/google-calendar-client.ts');

test('Retry-After accepts seconds and HTTP dates, rejects invalid and past values',()=>{
  const now=Date.parse('2026-10-30T12:00:00Z');
  assert.equal(retry.retryAfterMilliseconds('120',now),120000);
  assert.equal(retry.retryAfterMilliseconds('Fri, 30 Oct 2026 12:05:00 GMT',now),300000);
  for(const value of [null,'','garbage','-20','1.5','0','Fri, 30 Oct 2026 11:00:00 GMT','9'.repeat(100)])assert.equal(retry.retryAfterMilliseconds(value,now),0);
});
test('exponential retries grow with jitter, cap local delay, honor provider floors and pause exhaustion',()=>{
  assert.deepEqual([0,1,2,3].map(n=>retry.googleRetryPlan({code:'quota'},n,()=>0).delayMs),[60000,120000,240000,480000]);
  assert.equal(retry.googleRetryPlan({code:'quota'},0,()=>1).delayMs,75000);
  assert.equal(retry.googleRetryPlan({code:'quota'},20,()=>1).delayMs,3600000);
  assert.equal(retry.googleRetryPlan({code:'quota',retryAfterMs:7200000},0).delayMs,7200000);
  assert.equal(retry.googleRetryPlan({code:'unavailable'},6).paused,false);
  assert.equal(retry.googleRetryPlan({code:'unavailable'},7).paused,true);
  for(const code of ['permission','invalid_response','reconnect'])assert.equal(retry.googleRetryPlan({code},0).paused,true);
});
test('invalid retry resource settings fail closed',()=>{
  const names=['GOOGLE_CALENDAR_RETRY_BASE_SECONDS','GOOGLE_CALENDAR_RETRY_MAX_SECONDS','GOOGLE_CALENDAR_RETRY_MAX_ATTEMPTS'];
  const old=names.map(n=>process.env[n]);
  try{process.env[names[0]]='120';process.env[names[1]]='60';assert.throws(()=>retry.googleRetryPolicy());delete process.env[names[0]];delete process.env[names[1]];process.env[names[2]]='0';assert.throws(()=>retry.googleRetryPolicy());}
  finally{names.forEach((n,i)=>{if(old[i]===undefined)delete process.env[n];else process.env[n]=old[i];});}
});
test('HTTP classification preserves Retry-After and separates explicit user quotas from broad quotas',async()=>{
  const original=global.fetch;
  try {
    for(const [status,reason,code,scope] of [[403,'userRateLimitExceeded','quota','account'],[403,'rateLimitExceeded','quota','project'],[403,'quotaExceeded','quota','project'],[403,'dailyLimitExceeded','quota','project'],[429,null,'quota','project'],[403,'forbidden','permission','project'],[401,'authError','reconnect','project'],[503,null,'unavailable','project'],[400,'timeRangeEmpty','invalid_response','project']]){
      global.fetch=async()=>Response.json({error:{errors:[{reason}]}},{status,headers:{'Retry-After':'600'}});
      await assert.rejects(client.googleApi('SYNTHETIC_TOKEN','/calendars/owned'),error=>error.code===code&&error.quotaScope===scope&&error.retryAfterMs===600000);
    }
    global.fetch=async()=>new Response('PRIVATE_PROVIDER_BODY',{status:503,headers:{'Retry-After':'120'}});
    await assert.rejects(client.googleApi('SYNTHETIC_TOKEN','/calendars/owned'),error=>error.code==='unavailable'&&error.retryAfterMs===120000&&!String(error).includes('PRIVATE'));
    global.fetch=async()=>Response.json({message:'rateLimitExceeded is not an error reason'},{status:403});
    await assert.rejects(client.googleApi('synthetic','/calendars/owned'),error=>error.code==='permission');
  }finally{global.fetch=original;}
});
test('OAuth quota, non-JSON outage and invalid_grant are distinct and never expose token data',async()=>{
  const original=global.fetch;
  try {
    global.fetch=async()=>new Response('PRIVATE',{status:429,headers:{'Retry-After':'180'}});
    await assert.rejects(client.googleTokens({refresh_token:'PRIVATE'}),e=>e.code==='quota'&&e.retryAfterMs===180000&&!String(e).includes('PRIVATE'));
    global.fetch=async()=>Response.json({error:'invalid_grant'},{status:400});
    await assert.rejects(client.googleTokens({}),e=>e.code==='reconnect');
  }finally{global.fetch=original;}
});
