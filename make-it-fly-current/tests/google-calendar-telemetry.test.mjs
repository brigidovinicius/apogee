import test from 'node:test';
import assert from 'node:assert/strict';
import {opportunityLoader} from './helpers/load-opportunity-module.mjs';
test('request counters stay isolated across asynchronous operations without storing request payloads',async()=>{
  const telemetry=opportunityLoader()('lib/opportunities/google-calendar-telemetry.ts');
  const original=global.fetch;global.fetch=async()=>Response.json({});
  try {
    const a=telemetry.newGoogleTelemetry(),b=telemetry.newGoogleTelemetry();
    await Promise.all([telemetry.withGoogleTelemetry(a,async()=>{await telemetry.measuredGoogleFetch('https://example.invalid/PRIVATE',{});await Promise.resolve();telemetry.recordGoogleEventChange();}),telemetry.withGoogleTelemetry(b,async()=>{await Promise.resolve();telemetry.recordGoogleQuotaResponse();})]);
    assert.equal(a.googleCalls,1);assert.equal(a.eventsChanged,1);assert.equal(a.quotaResponses,0);assert.equal(b.googleCalls,0);assert.equal(b.quotaResponses,1);
    assert.doesNotMatch(JSON.stringify([a,b]),/PRIVATE|url|token|user/);
  }finally{global.fetch=original;}
});
test('network failures and non-success HTTP responses have separate counters',async()=>{
  const telemetry=opportunityLoader()('lib/opportunities/google-calendar-telemetry.ts'),sample=telemetry.newGoogleTelemetry(),original=global.fetch;
  try{await telemetry.withGoogleTelemetry(sample,async()=>{
    global.fetch=async()=>Response.json({},{status:503});await telemetry.measuredGoogleFetch('https://example.invalid',{});
    global.fetch=async()=>{throw Error('private');};await assert.rejects(telemetry.measuredGoogleFetch('https://example.invalid',{}));
  });assert.equal(sample.googleCalls,2);assert.equal(sample.httpErrors,1);assert.equal(sample.networkErrors,1);}
  finally{global.fetch=original;}
});
test('a metrics sink failure cannot turn a successful calendar sync into a failed operation or log secrets',async()=>{
  const logs=[],original=console.warn;console.warn=value=>logs.push(value);
  try{const metrics=opportunityLoader({'@/lib/members/db':{getSql:()=>{throw Error('PRIVATE_DATABASE_URL');}}})('lib/opportunities/google-calendar-metrics.ts');
    assert.equal(await metrics.measureGoogleCalendarSync(async()=> 'synced'),'synced');assert.doesNotMatch(logs.join(''),/PRIVATE_DATABASE_URL/);
  }finally{console.warn=original;}
});
