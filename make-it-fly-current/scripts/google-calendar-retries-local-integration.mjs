// Real PostgreSQL and HTTP, isolated schema and loopback provider/alert receiver.
// No production credentials, users, APIs or destinations are used.
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:http';
import postgres from 'postgres';
import {opportunityLoader} from '../tests/helpers/load-opportunity-module.mjs';
import {syncBatch} from './google-calendar-worker.mjs';
import {createAlertMonitor,webhookSender} from './google-calendar-alerts.mjs';

const config=JSON.parse(await readFile(new URL('../../.local/radar-calendar/config.json',import.meta.url),'utf8'));
const dbUrl=new URL(config.DATABASE_URL);
assert.equal(dbUrl.hostname,'127.0.0.1');assert.equal(dbUrl.port,'48763');assert.equal(dbUrl.pathname,'/apogee_radar_calendar_local');
const sql=postgres(dbUrl.href,{ssl:false,max:3,prepare:false,onnotice:()=>{}});
const schema='calendar_retry_qa_'+randomBytes(6).toString('hex');
const tables=['radar_google_calendar_queue_state','radar_google_calendar_event','radar_google_calendar_oauth','radar_google_calendar','radar_saved_opportunity'];
// Real tagged driver and transactions; only this random schema is in search_path.
// Do not add public as fallback: a missing fixture table must fail closed.
const qa=postgres(dbUrl.href,{ssl:false,max:2,prepare:false,connection:{search_path:schema},onnotice:()=>{}});
const originalFetch=global.fetch,events=new Map(),alerts=[],alertKeys=[],logs=[];
let mode='quota',tokenCalls=0,apiCalls=0,partialWrites=0,alertFail=true,route,time=Date.now(),checks=0;
const check=(value,label)=>{assert.ok(value,label);checks++;};
const server=createServer(async(req,res)=>{
  try {
    const chunks=[];for await(const chunk of req)chunks.push(chunk);
    const raw=Buffer.concat(chunks).toString(),path=new URL(req.url,'http://127.0.0.1').pathname;
    const reply=(body,status=200,headers={})=>{res.writeHead(status,{'Content-Type':'application/json',...headers});res.end(JSON.stringify(body));};
    if(path==='/alerts') {alerts.push(JSON.parse(raw));alertKeys.push(req.headers['idempotency-key']);reply({},alertFail?503:200);return;}
    if(path==='/api/internal/google-agenda/sync') {
      const request=new Request('http://127.0.0.1'+path,{method:req.method,headers:req.headers});
      const result=await route[req.method](request);res.writeHead(result.status,Object.fromEntries(result.headers));res.end(await result.text());return;
    }
    if(path==='/provider-token') {
      tokenCalls++;if(mode==='revoked'){reply({error:'invalid_grant'},400);return;}
      reply({access_token:'SYNTHETIC_ACCESS',token_type:'Bearer',scope:'https://www.googleapis.com/auth/calendar.app.created'});return;
    }
    assert.ok(path.startsWith('/provider/calendar/v3/calendars/'));
    apiCalls++;const parts=path.split('/').map(decodeURIComponent);const calendar=parts[5];assert.notEqual(calendar,'primary');
    if(mode==='quota'){reply({error:{errors:[{reason:'rateLimitExceeded'}]}},429,{'Retry-After':'120'});return;}
    if(mode==='userQuota' && calendar==='synthetic-a'){reply({error:{errors:[{reason:'userRateLimitExceeded'}]}},403,{'Retry-After':'90'});return;}
    if(mode==='outage'){reply({},503);return;}
    if(mode==='permission'){reply({error:{errors:[{reason:'forbidden'}]}},403);return;}
    if(parts.length===6){reply({id:calendar});return;}
    const body=JSON.parse(raw),eventId=parts[7]??body.id,key=calendar+':'+eventId;
    if(mode==='partialQuota' && calendar==='synthetic-a' && partialWrites>=1){reply({error:{errors:[{reason:'rateLimitExceeded'}]}},429,{'Retry-After':'120'});return;}
    if(req.method==='PATCH'&&!events.has(key)){reply({},404);return;}
    if(req.method==='POST'&&events.has(key)){reply({},409);return;}
    events.set(key,{...events.get(key),...body});if(calendar==='synthetic-a')partialWrites++;reply({id:eventId});
  }catch{res.writeHead(500);res.end('{}');}
});
try {
  assert.equal((await sql`select marker from radar_local_environment`)[0].marker,'apogee-radar-calendar-local-v1');
  await sql`create schema ${sql(schema)}`;
  for(const table of tables)await sql.unsafe('create table "'+schema+'"."'+table+'" (like public."'+table+'" including all)');
  await qa`insert into radar_google_calendar_queue_state(singleton) values (true)`;
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+server.address().port;
  global.fetch=async(input,options)=>{
    const target=new URL(input);
    if(target.hostname==='oauth2.googleapis.com')return originalFetch(origin+'/provider-token',options);
    if(target.hostname==='www.googleapis.com')return originalFetch(origin+'/provider'+target.pathname+target.search,options);
    assert.equal(target.origin,origin,'No request may leave the loopback fixture');return originalFetch(input,options);
  };
  process.env.RADAR_CALENDAR_PERSONAL_ENABLED='true';process.env.RADAR_GOOGLE_CALENDAR_ENABLED='true';
  process.env.GOOGLE_CALENDAR_CLIENT_ID='synthetic-client';process.env.GOOGLE_CALENDAR_CLIENT_SECRET='synthetic-secret';
  process.env.GOOGLE_CALENDAR_ENCRYPTION_KEY='ab'.repeat(32);process.env.GOOGLE_CALENDAR_SYNC_SECRET='s'.repeat(32);
  const raw=(await sql`select payload from radar_local_catalogue where id='demo-olimpiada'`)[0].payload;
  const load=opportunityLoader({'@/lib/members/db':{getSql:()=>qa},'@/lib/members/mail':{applicationOrigin:()=>origin},
    '@/lib/billing/store':{radarAccess:async()=>({active:true})},'@/lib/members/protection':{adultAccess:async()=>true},
    './radar-client':{listRadarOpportunities:async()=>[opportunityLoader()('lib/opportunities/radar-client.ts').toOpportunity(raw)]}});
  const sync=load('lib/opportunities/google-calendar-sync.ts'),store=load('lib/opportunities/google-calendar-store.ts');
  const encryption=load('lib/opportunities/google-calendar-config.ts');route=load('app/api/internal/google-agenda/sync/route.ts');
  for(const id of ['a','b']) {
    await qa`insert into radar_google_calendar(user_id,refresh_token_encrypted,calendar_id,next_sync_at)
      values (${id},${encryption.sealGoogleSecret('SYNTHETIC_REFRESH',id)},${'synthetic-'+id},${id==='a'?new Date(0):new Date(Date.now()+86400000)})`;
    await qa`insert into radar_saved_opportunity(user_id,opportunity_id,snapshot) values (${id},'radar-demo-olimpiada','{}')`;
  }
  const state=async id=>(await qa`select * from radar_google_calendar where user_id=${id}`)[0];
  const release=async id=>{await qa`update radar_google_calendar set retry_not_before=now()-interval '1 second',next_sync_at=now()-interval '1 second' where user_id=${id}`;await qa`update radar_google_calendar_queue_state set cooldown_until=null`;};
  const directory=await mkdtemp(join(tmpdir(),'calendar-retry-http-'));
  try {
    const monitorFile=join(directory,'alerts.json');
    const monitor=createAlertMonitor({file:monitorFile,deliver:webhookSender({url:origin+'/alerts',local:true}),now:()=>time,random:()=>0,log:l=>logs.push(l)});
    const batch=()=>syncBatch({origin,secret:process.env.GOOGLE_CALENDAR_SYNC_SECRET,observe:monitor,log:l=>logs.push(l)});
    check((await originalFetch(origin+'/api/internal/google-agenda/sync')).status===401,'Anonymous monitor refused');
    await batch();let row=await state('a');
    check(row.consecutive_failures===1&&row.last_error==='quota','First quota recorded persistently');
    check(new Date(row.retry_not_before)-Date.now()>118000,'Provider Retry-After respected');
    check((await qa`select cooldown_until>now() as active from radar_google_calendar_queue_state`)[0].active,'Broad quota pauses project');
    const calls=tokenCalls+apiCalls;await batch();await sync.syncGoogleCalendar('a',{manual:true});
    check(tokenCalls+apiCalls===calls,'Worker and manual sync cannot bypass quota');
    check(!(await store.queueGoogleCalendarSync('a')),'Save cannot override the retry hold');
    check(alerts.length===1&&alerts[0].type==='opened','Local receiver saw one incident attempt');
    await release('a');mode='outage';await sync.syncGoogleCalendar('a');row=await state('a');
    check(row.consecutive_failures===2,'Second failure survives a new invocation');
    check(new Date(row.retry_not_before)-Date.now()>=118000,'Progressive second retry');
    await release('a');mode='ok';await batch();row=await state('a');
    check(row.consecutive_failures===0&&!row.retry_paused&&!row.retry_not_before,'Recovery resets retries');
    check(events.size===3,'Real HTTP fixture created all stage events');
    const count=events.size;await sync.syncGoogleCalendar('a');check(events.size===count,'Retry recovery does not duplicate events');
    time+=60000;alertFail=false;await monitor({status:'ok'});await monitor({status:'ok'});
    check(alerts.map(a=>a.type).join(',')==='opened,opened,recovered','Alert delivery retried before recovery');
    check(alertKeys[0]===alertKeys[1],'Repeated delivery has same idempotency key');
    check(JSON.parse(await readFile(monitorFile)).outbox.length===0,'Delivered outbox drained');
    await release('a');mode='userQuota';await sync.syncGoogleCalendar('a');
    check(!(await qa`select cooldown_until>now() as active from radar_google_calendar_queue_state`)[0].active,'Explicit user quota does not pause other accounts');
    check(await sync.syncGoogleCalendar('b')==='synced','Another account proceeds');
    await release('a');await qa`delete from radar_google_calendar_event where user_id='a'`;
    for(const key of events.keys())if(key.startsWith('synthetic-a:'))events.delete(key);
    mode='partialQuota';partialWrites=0;await sync.syncGoogleCalendar('a');
    check((await qa`select count(*)::int as n from radar_google_calendar_event where user_id='a'`)[0].n===1,'Successful event mapping commits before a later quota failure');
    await release('a');mode='ok';await sync.syncGoogleCalendar('a');
    check((await qa`select count(*)::int as n from radar_google_calendar_event where user_id='a'`)[0].n===3&&events.size===6,'Partial retry resumes without duplicate events');
    mode='outage';await qa`update radar_google_calendar set consecutive_failures=0,last_error=null,retry_paused=false where user_id='a'`;
    for(let i=0;i<8;i++){await release('a');await sync.syncGoogleCalendar('a');}
    row=await state('a');check(row.consecutive_failures===8&&row.retry_paused,'Eight failures pause background retries');
    check(await sync.syncDueGoogleCalendars()===0,'Paused account not claimed');
    const before=tokenCalls;await sync.syncGoogleCalendar('a',{manual:true});check(tokenCalls===before,'Manual resume still observes waiting time');
    await release('a');mode='ok';check(await sync.syncGoogleCalendar('a',{manual:true})==='synced','Explicit manual resume after hold');
    check((await state('a')).consecutive_failures===0,'Manual recovery resets failures');
    mode='permission';await release('a');await sync.syncGoogleCalendar('a');row=await state('a');
    check(row.retry_paused&&row.last_error==='permission','Permission error pauses without hammering');
    await release('a');const permittedCalls=tokenCalls;await sync.syncGoogleCalendar('a',{manual:true});check(tokenCalls===permittedCalls,'Missing permission requires renewed authorization');
    mode='revoked';await qa`update radar_google_calendar set retry_paused=false where user_id='a'`;await sync.syncGoogleCalendar('a');
    check((await state('a')).refresh_token_encrypted===null,'Revoked grant is removed from retry queue');
    check(!logs.join('').includes('SYNTHETIC_REFRESH')&&!JSON.stringify(alerts).includes('synthetic-a'),'Logs and alerts do not identify accounts/tokens');
    const [{n}]=await qa`select count(*)::int as n from radar_google_calendar_event where user_id='a'`;check(n===3,'Event mapping retained after failures');
    console.log(JSON.stringify({passed:checks,localOnly:true,realPostgres:true,realLoopbackHttp:true,googleResponsesSimulated:true,externalAlertsSent:0}));
  } finally {await rm(directory,{recursive:true});}
} finally {
  global.fetch=originalFetch;await new Promise(resolve=>server.close(resolve));
  await qa.end();
  await sql`drop schema if exists ${sql(schema)} cascade`;await sql.end();
}
