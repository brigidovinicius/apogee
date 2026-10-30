// Real local PostgreSQL queue validation. No OAuth tokens or Google HTTP calls.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import postgres from 'postgres';
import {opportunityLoader} from '../tests/helpers/load-opportunity-module.mjs';
const config=JSON.parse(await readFile(new URL('../../.local/radar-calendar/config.json',import.meta.url),'utf8'));
const url=new URL(config.DATABASE_URL);
assert.equal(url.hostname,'127.0.0.1');assert.equal(url.port,'48763');assert.equal(url.pathname,'/apogee_radar_calendar_local');
const sql=postgres(url.href,{ssl:false,max:2,prepare:false});
const table='radar_google_queue_qa_'+randomBytes(6).toString('hex');
let claim;
const tagged=async(strings,...values)=>{
  const text=strings.reduce((text,part,i)=>text+(i?'$'+i:'')+part,'').replace(/\bradar_google_calendar\b/g,'"'+table+'"');
  if(text.includes('with candidate'))claim=text;
  return sql.unsafe(text,values);
};
try {
  assert.equal((await sql`select marker from radar_local_environment`)[0].marker,'apogee-radar-calendar-local-v1');
  await sql`create table ${sql(table)} (user_id text primary key,refresh_token_encrypted text,next_sync_at timestamptz,last_error text,retry_paused boolean default false,retry_not_before timestamptz)`;
  for(let n=0;n<7;n++)await sql`insert into ${sql(table)} (user_id,refresh_token_encrypted,next_sync_at) values (${'synthetic-'+n},'not-a-token',now()-interval '1 minute')`;
  const sync=opportunityLoader({
    '@/lib/members/db':{getSql:()=>tagged},
    './google-calendar-metrics':{measureGoogleCalendarSync:fn=>fn()},
    '@/lib/billing/store':{radarAccess:async()=>({active:false})},
    './google-calendar-config':{googleCalendarConfig:()=>({})},
    './google-calendar-queue':{googleQueuePolicy:()=>({batchSize:3,budgetMs:90000})},
  })('lib/opportunities/google-calendar-sync.ts');
  assert.equal(await sync.syncDueGoogleCalendars(),3);
  assert.equal(await sync.syncDueGoogleCalendars(),3);
  assert.equal(await sync.syncDueGoogleCalendars(),1);
  assert.equal(await sync.syncDueGoogleCalendars(),0);
  assert.equal((await sql`select count(*)::int as n from ${sql(table)} where last_error='access' and next_sync_at>now()`)[0].n,7);
  // A locked oldest row must not block another worker or be claimed twice.
  await sql`update ${sql(table)} set next_sync_at=now()-interval '1 minute',last_error=null`;
  await sql.begin(async first=>{
    const [locked]=await first`select user_id from ${sql(table)} order by user_id for update limit 1`;
    const [claimed]=await sql.unsafe(claim);
    assert.notEqual(claimed.user_id,locked.user_id);
    const leased=(await sql`select next_sync_at>now() as future from ${sql(table)} where user_id=${claimed.user_id}`)[0];
    assert.equal(leased.future,true);
  });
  console.log('OK: real PostgreSQL drains 7 isolated test connections across batches; locked rows are skipped and claims receive recovery leases.');
}finally{await sql`drop table if exists ${sql(table)}`;await sql.end();}
