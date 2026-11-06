import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import postgres from 'postgres';
import {drizzle} from 'drizzle-orm/postgres-js';
import {opportunityLoader} from './load-opportunity-module.mjs';
export async function calendarTestDatabase() {
 const config=JSON.parse(await readFile(new URL('../../../.local/radar-collections-calendar/config.json',import.meta.url),'utf8'));
 const url=new URL(config.DATABASE_URL);
 assert.equal(url.hostname,'127.0.0.1');assert.equal(url.port,'48941');assert.equal(url.pathname,'/apogee_radar_calendar_local');assert.equal(url.username,'radar_calendar_local');
 const sql=postgres(url.href,{ssl:false,max:3,prepare:false,onnotice:()=>{}});
 // Match getDb(): Drizzle changes postgres-js timestamp/JSON serializers. A bare
 // postgres client silently accepts Date/JSON parameters that production rejects.
 drizzle(sql,{schema:opportunityLoader()('lib/members/schema.ts')});
 const [row]=await sql`select current_database() as db,current_user as role,inet_server_port() as port,(select marker from radar_local_environment limit 1) as marker`;
 assert.equal(row.db,'apogee_radar_calendar_local');assert.equal(row.role,'radar_calendar_local');assert.equal(row.port,48941);assert.equal(row.marker,'apogee-radar-calendar-local-v1');
 return sql;
}
