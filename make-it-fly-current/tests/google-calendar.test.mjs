import test from "node:test";
import assert from "node:assert/strict";
import { opportunityLoader } from "./helpers/load-opportunity-module.mjs";
const load = opportunityLoader({"@/lib/members/mail":{applicationOrigin:()=>"http://127.0.0.1:4381"}});
const config = load("lib/opportunities/google-calendar-config.ts");
const client = load("lib/opportunities/google-calendar-client.ts");
process.env.RADAR_CALENDAR_PERSONAL_ENABLED="true";
process.env.RADAR_GOOGLE_CALENDAR_ENABLED="true";
process.env.GOOGLE_CALENDAR_CLIENT_ID="test-client";
process.env.GOOGLE_CALENDAR_CLIENT_SECRET="test-secret";
process.env.GOOGLE_CALENDAR_ENCRYPTION_KEY="ab".repeat(32);

test("credentials are encrypted, authenticated, and bound to one member",()=>{
  const encrypted=config.sealGoogleSecret("private-token","member-a");
  assert.ok(!encrypted.includes("private-token"));
  assert.equal(config.openGoogleSecret(encrypted,"member-a"),"private-token");
  assert.throws(()=>config.openGoogleSecret(encrypted,"member-b"));
  assert.throws(()=>config.openGoogleSecret(encrypted.slice(0,-5)+"xxxxx","member-a"));
});
test("calendar is optional and Google login credentials remain fallback only",()=>{
  process.env.RADAR_GOOGLE_CALENDAR_ENABLED="false";
  assert.equal(config.googleCalendarConfig(),null);
  process.env.RADAR_GOOGLE_CALENDAR_ENABLED="true";
  assert.equal(config.googleCalendarConfig().redirectUri,"http://127.0.0.1:4381/api/integracoes/google-agenda/callback");
});
const entry={key:"test:2026:exam",item:{id:"radar-test",title:"Olimpíada fictícia",discovery:{}},stage:{id:"exam",name:"Prova",start:"2026-11-01",end:"2026-11-02"}};
test("all-day dates have exclusive end; content contains no source or personal data",()=>{
  const body=client.googleEventBody(entry,"http://127.0.0.1:4381");
  assert.deepEqual(body.start,{date:"2026-11-01"});assert.deepEqual(body.end,{date:"2026-11-03"});
  assert.equal(body.attendees,undefined);assert.equal(body.source,undefined);
});
test("timed events preserve offsets and distinguish unknown duration",()=>{
  const body=client.googleEventBody({...entry,stage:{...entry.stage,start:"2026-11-01T14:00:00-03:00",end:undefined}},"http://127.0.0.1:4381");
  assert.equal(body.start.dateTime,"2026-11-01T14:00:00-03:00");
  assert.equal(body.end.dateTime,"2026-11-01T17:01:00.000Z");assert.match(body.description,/um minuto/);
});
test("event IDs isolate accounts, calendars and restoration revisions",()=>{
  const id=client.googleEventId("a","calendar","key");
  assert.match(id,/^[a-f0-9]{64}$/);assert.equal(id,client.googleEventId("a","calendar","key"));
  assert.notEqual(id,client.googleEventId("b","calendar","key"));
  assert.notEqual(id,client.googleEventId("a","calendar2","key"));
  assert.notEqual(id,client.googleEventId("a","calendar","key",1));
});
test("primary calendar is rejected before any API call",async()=>{
  await assert.rejects(client.upsertGoogleEvent("token","primary","event",{}));
  await assert.rejects(client.cancelGoogleEvent("token","primary","event"));
});
test("insert conflict recovers with stable ID and never sends notifications",async()=>{
  const original=global.fetch;const calls=[];let responses=[404,409,200];
  global.fetch=async(url,options)=>{calls.push({url,options});return new Response("{}",{status:responses.shift()});};
  try {
    await client.upsertGoogleEvent("token","owned","a".repeat(64),{summary:"Test"});
    assert.deepEqual(calls.map(c=>c.options.method),["PATCH","POST","PATCH"]);
    assert.ok(calls.every(c=>c.url.endsWith("?sendUpdates=none")));
    assert.ok(calls.every(c=>c.options.redirect==="error"));
  } finally {global.fetch=original;}
});
test("one-time state comparison rejects malformed and mismatched values",()=>{
  const store=load("lib/opportunities/google-calendar-store.ts");
  assert.equal(store.sameOAuthState("ab".repeat(32),"ab".repeat(32)),true);
  assert.equal(store.sameOAuthState("ab".repeat(32),"cd".repeat(32)),false);
  assert.equal(store.sameOAuthState("x","x"),false);
});
test("sync job requires a configured bearer and rejects non-ASCII safely",async()=>{
  const route=opportunityLoader({"@/lib/opportunities/google-calendar-sync":{syncDueGoogleCalendars:async()=>3},
    "@/lib/opportunities/google-calendar-queue":{recordGoogleWorkerHeartbeat:async()=>{},googleQueuePolicy:()=>({batchSize:3,maxLagSeconds:900}),googleQueueStatus:async()=>({configured:true,lagSeconds:0,due:0})},
  })("app/api/internal/google-agenda/sync/route.ts");
  process.env.GOOGLE_CALENDAR_SYNC_SECRET="a".repeat(32);
  assert.equal((await route.POST(new Request("http://localhost",{method:"POST"}))).status,401);
  assert.equal((await route.POST(new Request("http://localhost",{method:"POST",headers:{Authorization:"Bearer "+"é".repeat(32)}}))).status,401);
  assert.equal((await route.POST(new Request("http://localhost",{method:"POST",headers:{Authorization:"Bearer "+"a".repeat(32)}}))).status,200);
});

test("zero-length timed stages remain valid one-minute markers",()=>{
  const body=client.googleEventBody({...entry,stage:{...entry.stage,start:"2026-11-01T14:00:00-03:00",end:"2026-11-01T14:00:00-03:00"}},"http://127.0.0.1:4381");
  assert.equal(body.end.dateTime,"2026-11-01T17:01:00.000Z");assert.match(body.description,/um minuto/);
});
test("callback denies anonymous/unpaid accounts and uses only session identity",async()=>{
  let member=null,active=false,exchanges=0,actor;
  const route=opportunityLoader({
    "@/lib/members/dal":{getMemberFromHeaders:async()=>member},
    "@/lib/billing/store":{radarAccess:async()=>({active})},
    "@/lib/members/mail":{applicationOrigin:()=>"http://127.0.0.1:4381"},
    "@/lib/opportunities/google-calendar-store":{completeGoogleCalendarOAuth:async id=>{exchanges++;actor=id;}},
    "@/lib/opportunities/google-calendar-sync":{syncGoogleCalendar:async()=>"synced"},
  })("app/api/integracoes/google-agenda/callback/route.ts");
  const req={headers:new Headers(),nextUrl:new URL("http://127.0.0.1:4381/api/integracoes/google-agenda/callback?state=test&code=secret-code&userId=attacker"),cookies:{get:()=>({value:"cookie"})}};
  assert.equal(new URL((await route.GET(req)).headers.get("location")).searchParams.get("google"),"access");
  member={id:"real-member"};await route.GET(req);assert.equal(exchanges,0);
  active=true;const response=await route.GET(req);assert.equal(actor,"real-member");
  assert.equal(response.headers.get("referrer-policy"),"no-referrer");assert.equal(response.headers.get("cache-control"),"no-store");
  assert.ok(!response.headers.get("location").includes("secret-code"));
});
