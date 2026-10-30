import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createAlertMonitor,webhookSender} from '../scripts/google-calendar-alerts.mjs';
const good={status:'ok',due:0,connected:10,lagSeconds:0,errors:0,reconnect:0,quota:0,paused:0};
const bad={...good,status:'warning',errors:1,quota:1};
async function fixture(fn) {const dir=await mkdtemp(join(tmpdir(),'google-alert-'));try{await fn(join(dir,'state.json'));}finally{await rm(dir,{recursive:true});}}
test('one opened/recovered alert per incident, also across monitor restart, with sanitized metrics',()=>fixture(async file=>{
  const sent=[],logs=[];const opts={file,deliver:async e=>sent.push(e),log:e=>logs.push(e)};
  let monitor=createAlertMonitor(opts);
  await monitor({...bad,secret:'NEVER_LOG',email:'private@example.invalid'});await monitor(bad);
  monitor=createAlertMonitor(opts);await monitor(bad);await monitor(good);await monitor(good);
  assert.deepEqual(sent.map(e=>e.type),['opened','recovered']);assert.equal(sent[0].incidentId,sent[1].incidentId);
  assert.equal((await stat(file)).mode&0o777,0o600);assert.doesNotMatch(logs.join(''),/NEVER_LOG|private@example/);
}));
test('failed delivery persists, retries progressively with stable idempotency and recovery ordering',()=>fixture(async file=>{
  let time=1000000,fail=true;const sent=[],attempts=[],logs=[];
  const opts={file,now:()=>time,random:()=>0,log:e=>logs.push(e),deliver:async e=>{attempts.push(e.eventId);if(fail)throw Error('SECRET_WEBHOOK');sent.push(e);}};
  let monitor=createAlertMonitor(opts);await monitor(bad);await monitor(good);
  assert.equal(attempts.length,1);time+=60000;monitor=createAlertMonitor(opts);await monitor(good);assert.equal(attempts.length,2);
  time+=119999;await monitor(good);assert.equal(attempts.length,2);time++;fail=false;await monitor(good);await monitor(good);
  assert.equal(new Set(attempts.slice(0,3)).size,1);assert.deepEqual(sent.map(e=>e.type),['opened','recovered']);
  assert.equal(JSON.parse(await readFile(file)).outbox.length,0);assert.doesNotMatch(logs.join(''),/SECRET_WEBHOOK/);
}));
test('external delivery is disabled by default, local HTTP explicit, redirects and arbitrary response data not followed',async()=>{
  assert.equal(webhookSender({}),null);assert.throws(()=>webhookSender({url:'http://example.invalid'}));assert.throws(()=>webhookSender({url:'https://user:secret@example.invalid'}));
  assert.throws(()=>webhookSender({url:'PRIVATE_INVALID_DESTINATION'}),error=>!String(error).includes('PRIVATE_INVALID_DESTINATION'));
  let init;
  const send=webhookSender({url:'http://127.0.0.1:1234/alerts',local:true,fetcher:async(url,options)=>{init=options;return new Response('PRIVATE',{status:302});}});
  await assert.rejects(send({eventId:'test'}),/Alert delivery failed/);assert.equal(init.redirect,'error');assert.equal(init.headers['Idempotency-Key'],'test');
});
test('paused accounts and reconnections alert even when aggregate lag is zero',()=>fixture(async file=>{
  const sent=[];const monitor=createAlertMonitor({file,deliver:async e=>sent.push(e),log:()=>{}});
  await monitor({...good,paused:1,reconnect:1});assert.ok(sent[0].reasons.includes('retries_paused'));assert.ok(sent[0].reasons.includes('reconnect'));
}));
test('prolonged receiver outage has bounded storage and explicit compaction of flapping events',()=>fixture(async file=>{
  const monitor=createAlertMonitor({file,deliver:async()=>{throw Error('down');},log:()=>{},now:()=>1000});
  for(let i=0;i<140;i++)await monitor(i%2?good:bad);
  const state=JSON.parse(await readFile(file));assert.ok(state.outbox.length<=64);assert.equal(state.outbox[0].event.type,'opened');assert.ok(state.outbox.some(item=>item.event.coalescedEvents>0));
  assert.ok(state.outbox.some(item=>item.event.reconcileComponent===true));
}));
test('enabling delivery during an existing incident sends its opening once',()=>fixture(async file=>{
  await createAlertMonitor({file,log:()=>{}})(bad);
  const sent=[];const monitor=createAlertMonitor({file,deliver:async e=>sent.push(e),log:()=>{}});
  await monitor(bad);await monitor(bad);await monitor(good);
  assert.deepEqual(sent.map(e=>e.type),['opened','recovered']);assert.equal(sent[0].incidentId,sent[1].incidentId);
}));
test('enabling delivery after an unreported incident does not send an orphan recovery',()=>fixture(async file=>{
  await createAlertMonitor({file,log:()=>{}})(bad);
  const sent=[];await createAlertMonitor({file,deliver:async e=>sent.push(e),log:()=>{}})(good);
  assert.equal(sent.length,0);
}));
