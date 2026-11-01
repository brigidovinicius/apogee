// Explicit local PostgreSQL acceptance test; never reads a production DATABASE_URL.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import postgres from 'postgres';
import { opportunityLoader } from './helpers/load-opportunity-module.mjs';
const config=JSON.parse(await readFile(new URL('../../.local/radar-completion-calendar/config.json',import.meta.url),'utf8'));
const url=new URL(config.DATABASE_URL);
assert.equal(url.hostname,'127.0.0.1');assert.equal(url.port,'48931');assert.equal(url.pathname,'/apogee_radar_calendar_local');
const sql=postgres(url.href,{ssl:false,prepare:false,max:3,onnotice:()=>{}});
const users=['radar-completion-filter-a','radar-completion-filter-b'];
const store=opportunityLoader({'@/lib/members/db':{getSql:()=>sql}})('lib/opportunities/saved-calendar-filters.ts');
try {
  for(const id of users)await sql`insert into "user"(id,name,email) values(${id},${id},${id+'@example.test'}) on conflict(id) do nothing`;
  await store.storeCalendarFilter(users[0],'Astronomia online','busca=astronomia&formato=online&redirect=https://evil.test');
  await store.storeCalendarFilter(users[1],'Astronomia online','busca=biologia');
  const [first]=await store.listSavedCalendarFilters(users[0]);
  assert.equal(first.name,'Astronomia online');assert.equal(first.query,'busca=astronomia&formato=online');
  assert.equal((await store.listSavedCalendarFilters(users[1]))[0].query,'busca=biologia');
  await store.removeCalendarFilter(users[1],first.id);
  assert.equal((await store.listSavedCalendarFilters(users[0])).length,1,'another account cannot remove the saved filter');
  await store.storeCalendarFilter(users[0],'ASTRONOMIA ONLINE','area=astronomia&formato=online');
  const updated=await store.listSavedCalendarFilters(users[0]);
  assert.equal(updated.length,1);assert.equal(updated[0].id,first.id);assert.equal(updated[0].query,'area=astronomia&formato=online');
  await assert.rejects(store.storeCalendarFilter(users[0],' ','busca=astronomia'));
  const results=await Promise.allSettled(Array.from({length:20},(_,i)=>store.storeCalendarFilter(users[0],'Coleção '+i,'categoria=competicoes')));
  assert.equal(results.filter(r=>r.status==='rejected').length,1,'concurrent requests still enforce 20 filters');
  assert.equal((await store.listSavedCalendarFilters(users[0])).length,20);
  await store.removeCalendarFilter(users[0],first.id);
  assert.equal((await store.listSavedCalendarFilters(users[0])).length,19);
  console.log(JSON.stringify({passed:true,migration:'0013_radar_calendar_filters',checks:['canonical query','account isolation','ownership on removal','case-insensitive update','input validation','concurrent limit','removal']}));
} finally {
  for(const id of users)await sql`delete from "user" where id=${id} and email=${id+'@example.test'}`;
  await sql.end();
}
