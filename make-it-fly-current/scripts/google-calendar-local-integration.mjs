// Real isolated Postgres + production OAuth/sync functions; only Google's HTTP responses are simulated.
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import postgres from "postgres";
import {drizzle} from "drizzle-orm/postgres-js";
import {opportunityLoader} from "../tests/helpers/load-opportunity-module.mjs";
const config=JSON.parse(await readFile(new URL("../../.local/radar-calendar/config.json",import.meta.url),"utf8"));
const url=new URL(config.DATABASE_URL);
assert.equal(url.hostname,"127.0.0.1");assert.equal(url.port,"48763");assert.equal(url.pathname,"/apogee_radar_calendar_local");
const sql=postgres(url.href,{ssl:false,max:1,prepare:false});drizzle(sql);
const id="radar-local-google-regression";
const other="radar-local-google-other";
const created=[];
const originalFetch=global.fetch;
let active=true,outage=false,invalidGrant=false,writes=0,tokenCalls=0;
const calendars=new Map();let nextCalendar=1;
process.env.RADAR_CALENDAR_PERSONAL_ENABLED="true";process.env.RADAR_GOOGLE_CALENDAR_ENABLED="true";
process.env.GOOGLE_CALENDAR_CLIENT_ID="synthetic-client";process.env.GOOGLE_CALENDAR_CLIENT_SECRET="synthetic-secret";
process.env.GOOGLE_CALENDAR_ENCRYPTION_KEY="ac".repeat(32);process.env.STRIPE_MODE="test";
const reply=(body,status=200)=>new Response(JSON.stringify(body),{status});
global.fetch=async(input,options={})=>{
  const target=new URL(input);
  if(target.hostname==="oauth2.googleapis.com"){
    tokenCalls++;
    if(invalidGrant)return reply({error:"invalid_grant"},400);
    return reply({access_token:"synthetic-access",refresh_token:"synthetic-refresh",token_type:"Bearer",scope:"https://www.googleapis.com/auth/calendar.app.created"});
  }
  assert.equal(target.hostname,"www.googleapis.com","No unmocked external request");
  const parts=target.pathname.split("/").filter(Boolean).map(decodeURIComponent);
  const method=options.method;const body=options.body?JSON.parse(options.body):null;
  if(parts.length===3&&method==="POST"){const cid="synthetic-calendar-"+nextCalendar++;calendars.set(cid,new Map());return reply({id:cid});}
  const cid=parts[3];assert.notEqual(cid,"primary");
  const events=calendars.get(cid);if(!events)return reply({},404);
  if(parts.length===4)return reply({id:cid});
  assert.equal(target.searchParams.get("sendUpdates"),"none");assert.equal(body.attendees,undefined);
  const eventId=parts[5];
  if(method==="PATCH"){
    if(!events.has(eventId))return reply({},404);
    events.set(eventId,{...events.get(eventId),...body});writes++;return reply({id:eventId});
  }
  assert.equal(method,"POST");if(events.has(body.id))return reply({},409);
  events.set(body.id,body);writes++;return reply({id:body.id});
};
try {
  assert.equal((await sql`select marker from radar_local_environment`)[0].marker,"apogee-radar-calendar-local-v1");
  for(const user of [id,other]){
    assert.equal((await sql`select id from "user" where id=${user}`).length,0);
    await sql`insert into "user" (id,name,email,username) values (${user},'Teste Google',${user+"@radar.test"},${user.replaceAll("-","_")})`;created.push(user);
  }
  const raw=(await sql`select payload from radar_local_catalogue where id='demo-olimpiada'`)[0].payload;
  const item=opportunityLoader()("lib/opportunities/radar-client.ts").toOpportunity(raw);
  let live=[item];
  const load=opportunityLoader({
    "@/lib/members/db":{getSql:()=>sql},"@/lib/members/mail":{applicationOrigin:()=>"http://127.0.0.1:4381"},
    "@/lib/billing/store":{radarAccess:async()=>({active})},
    "./radar-client":{listRadarOpportunities:async()=>{if(outage)throw Error("outage");return live;}},
  });
  const oauth=load("lib/opportunities/google-calendar-store.ts");
  const sync=load("lib/opportunities/google-calendar-sync.ts");
  const save=load("lib/opportunities/personal-calendar.ts");
  const auth=await oauth.beginGoogleCalendarOAuth(id);
  assert.equal(new URL(auth.url).searchParams.get("scope"),"https://www.googleapis.com/auth/calendar.app.created");
  assert.equal(new URL(auth.url).searchParams.get("code_challenge_method"),"S256");
  const stored=(await sql`select * from radar_google_calendar_oauth where user_id=${id}`)[0];
  assert.notEqual(stored.state_hash,auth.state);
  await assert.rejects(oauth.completeGoogleCalendarOAuth(other,auth.state,auth.state,"code"));
  await assert.rejects(oauth.completeGoogleCalendarOAuth(id,auth.state,"b".repeat(64),"code"));
  await oauth.completeGoogleCalendarOAuth(id,auth.state,auth.state,"code");
  await assert.rejects(oauth.completeGoogleCalendarOAuth(id,auth.state,auth.state,"code"),"Replay rejected");
  assert.ok(!(await sql`select refresh_token_encrypted as token from radar_google_calendar where user_id=${id}`)[0].token.includes("synthetic-refresh"));
  await save.saveOpportunity(id,item.id,false);
  assert.equal(await sync.syncGoogleCalendar(id),"synced");
  assert.equal(calendars.size,1);const events=[...calendars.values()][0];assert.equal(events.size,3);
  const count=writes;await sync.syncGoogleCalendar(id);assert.equal(writes,count,"Unchanged sync writes nothing");
  const edition=item.discovery.editions[0];const stage=edition.stages[1];
  live=[{...item,discovery:{...item.discovery,editions:[{...edition,stages:[edition.stages[0],{...stage,start:"2027-01-17"},edition.stages[2]]}]}}];
  await sync.syncGoogleCalendar(id);assert.equal(events.size,3);assert.equal(writes,count+1,"Date changes update same event");
  live=[{...item,discovery:{...item.discovery,editions:[{...edition,stages:[edition.stages[0],stage]}]}}];
  await sync.syncGoogleCalendar(id);assert.equal([...events.values()].filter(e=>e.status==="cancelled").length,1);
  await save.saveOpportunity(id,item.id,true);await sync.syncGoogleCalendar(id);
  assert.equal([...events.values()].filter(e=>e.status==="confirmed").length,0);
  live=[item];await save.saveOpportunity(id,item.id,false);await sync.syncGoogleCalendar(id);
  assert.equal([...events.values()].filter(e=>e.status==="confirmed").length,3,"Restoration gets fresh stable revisions");
  outage=true;const before=writes;assert.equal(await sync.syncGoogleCalendar(id),"failed");assert.equal(writes,before);outage=false;
  active=false;const beforeTokens=tokenCalls;assert.equal(await sync.syncGoogleCalendar(id),"failed");assert.equal(tokenCalls,beforeTokens);active=true;
  await oauth.disconnectGoogleCalendar(id);assert.equal(await sync.syncGoogleCalendar(id),"disconnected");assert.equal(events.size,6,"Disconnect retains calendar");
  const auth2=await oauth.beginGoogleCalendarOAuth(id);await oauth.completeGoogleCalendarOAuth(id,auth2.state,auth2.state,"new-code");
  await sync.syncGoogleCalendar(id);assert.equal(calendars.size,1,"Reconnect reuses same calendar");
  invalidGrant=true;assert.equal(await sync.syncGoogleCalendar(id),"failed");assert.equal((await oauth.googleCalendarStatus(id)).connected,false);
  assert.equal((await oauth.googleCalendarStatus(id)).error,"reconnect");
  console.log("OK: OAuth state/PKCE, replay/account isolation, encrypted storage, creation, idempotency, date updates, stage cancellation, remove/restore, outage, entitlement revocation, disconnect/reconnect and revoked Google grant.");
} finally {
  global.fetch=originalFetch;
  for(const user of created)await sql`delete from "user" where id=${user} and email=${user+"@radar.test"}`;
  await sql.end();
}
