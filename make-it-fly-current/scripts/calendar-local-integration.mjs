// Regression check against the dedicated local database and actual shared driver.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { opportunityLoader } from '../tests/helpers/load-opportunity-module.mjs';
const config=JSON.parse(await readFile(new URL('../../.local/radar-calendar/config.json',import.meta.url),'utf8'));
const url=new URL(config.DATABASE_URL);
assert.equal(url.hostname,'127.0.0.1');assert.equal(url.port,'48763');assert.equal(url.pathname,'/apogee_radar_calendar_local');
const sql=postgres(url.href,{ssl:false,prepare:false,max:1});
drizzle(sql); // Reproduce the production client's JSON serializer configuration.
const id='radar-local-storage-regression';
let created=false;
try {
  assert.equal((await sql`select marker from radar_local_environment`)[0].marker,'apogee-radar-calendar-local-v1');
  assert.equal((await sql`select id from "user" where id=${id}`).length,0,'Do not overwrite an existing account');
  await sql`insert into "user" (id,name,email,username) values (${id},'Teste de persistência','storage-regression@radar.test','storage_regression')`;
  created=true;
  await sql`insert into radar_legacy_access (user_id) values (${id})`;
  const raw=(await sql`select payload from radar_local_catalogue where id='demo-olimpiada'`)[0].payload;
  const item=opportunityLoader()('lib/opportunities/radar-client.ts').toOpportunity(raw);
  const calendar=opportunityLoader({'@/lib/members/db':{getSql:()=>sql},'./radar-client':{listRadarOpportunities:async()=>[item]}})('lib/opportunities/personal-calendar.ts');
  process.env.RADAR_CALENDAR_PERSONAL_ENABLED='true';process.env.STRIPE_MODE='test';
  await calendar.saveOpportunity(id,item.id,false);
  await calendar.rememberCalendarEvents(id,[item]);
  let saved=await calendar.savedOpportunities(id);
  assert.equal(saved[0].snapshot.id,item.id);assert.equal(saved[0].history.length,3);
  assert.equal(saved[0].history[0].item.discovery,undefined);
  const first=await calendar.rotateCalendarToken(id);
  assert.equal(await calendar.calendarTokenOwner(first),id);
  const second=await calendar.rotateCalendarToken(id);
  assert.equal(await calendar.calendarTokenOwner(first),null);
  assert.equal(await calendar.calendarTokenOwner(second),id);
  await calendar.saveOpportunity(id,item.id,true);
  saved=await calendar.savedOpportunities(id);assert.ok(saved[0].removedAt);
  await sql`delete from radar_legacy_access where user_id=${id}`;
  assert.equal(await calendar.calendarTokenOwner(second),null);
  console.log('OK: shared Drizzle/Postgres client, save/read/history, removal, token rotation and entitlement revocation.');
} finally {if(created)await sql`delete from "user" where id=${id} and email='storage-regression@radar.test'`;await sql.end();}
