import assert from "node:assert/strict";
import test from "node:test";
import { opportunityLoader } from "./helpers/load-opportunity-module.mjs";
const load=opportunityLoader();
const { readDiscovery, calendarEntries, publicOpportunityPath, displayOpportunityTitle }=load("lib/opportunities/discovery.ts");
const { opportunityCardData }=load("lib/opportunities/card-data.ts");
const { isOpportunityOpen, opportunityFiltersFromSearchParams, setOpportunityFilterSearchParams, primaryOpportunityCategory }=load("lib/opportunities/types.ts");
const { renderCalendarFeed }=load("lib/opportunities/ics.ts");
const now=Date.parse("2026-10-29T12:00:00Z");
const stage={id:"exam",name:"Prova",kind:"exam",start:"2026-11-10",sourceUrl:"https://official.test/PRIVATE",checkedAt:"2026-10-28T12:00:00Z"};
const base={id:"radar-abc",title:"Olimpíada de Matemática",organization:"Organização",kind:"Programa",level:"Ensino médio",categories:["competicoes"],
  location:"Brasil",stateCode:null,cityName:null,eligibility:"PRIVATE_REQUIREMENT",officialUrl:"https://official.test/PRIVATE",
  summary:"Resumo",benefit:"",deadline:"2026-10-20",deadlineLabel:"Inscrições até 20/out",verifiedAt:"2026-10-28",verificationTimestamp:"2026-10-28T12:00:00Z",
  opportunityStatus:"closed",discovery:{primaryType:"competicoes",subtype:"olimpiada",areas:["matematica"],editions:[{id:"2026",name:"2026",stages:[stage]}]}};
test("calendar keeps confirmed next stages after enrollment closes, without reopening registration",()=>{
  assert.equal(isOpportunityOpen(base,"2026-10-29",now),false);
  assert.equal(calendarEntries([base],now).length,1);
  assert.equal(calendarEntries([base],Date.parse("2026-11-11T03:00:00Z")).length,0);
  assert.equal(calendarEntries([{...base,deadline:null,discovery:undefined,eventStartsAt:null}],now).length,0);
});
test("classification does not infer age or area; invalid dates and unaudited stages are ignored",()=>{
  assert.deepEqual(readDiscovery(null),{areas:[],editions:[]});
  for(const patch of [{start:"2026-02-30"},{start:"2026-11-10T12:00:00"},{sourceUrl:"javascript:alert(1)"},{checkedAt:"2099-01-01T00:00:00Z"}]) {
    assert.equal(readDiscovery({...base.discovery,editions:[{id:"x",name:"x",stages:[{...stage,...patch}]}]}).editions[0].stages.length,0);
  }
  assert.equal(primaryOpportunityCategory({...base,discovery:{...base.discovery,primaryType:"pesquisa"}}),"pesquisa");
});
test("public cards include calendar dates but never protected URLs, requirements or source references",()=>{
  const publicItem=opportunityCardData(base);
  assert.equal(JSON.stringify(publicItem).includes("PRIVATE"),false);
  assert.equal(publicItem.discovery.editions[0].stages[0].start,stage.start);
  assert.equal(base.discovery.editions[0].stages[0].sourceUrl,stage.sourceUrl);
});
test("area filters round-trip through URLs and titles are cleaned without changing source identity",()=>{
  const params=new URLSearchParams("area=matematica");const filters=opportunityFiltersFromSearchParams(params);
  assert.equal(filters.area,"matematica");
  assert.equal(setOpportunityFilterSearchParams(new URLSearchParams(),filters).get("area"),"matematica");
  assert.equal(opportunityFiltersFromSearchParams(new URLSearchParams("area=unknown")).area,undefined);
  assert.equal(displayOpportunityTitle("Curso, início 2026-10-22"),"Curso");
  assert.ok(publicOpportunityPath(base).endsWith("--radar-abc"));
});
test("ICS uses stable UIDs, inclusive all-day dates and never leaks official URLs or requirements",()=>{
  const saved=[{snapshot:base,removedAt:null}];
  const first=renderCalendarFeed(saved,[base],now);
  assert.match(first,/DTSTART;VALUE=DATE:20261110/);assert.match(first,/DTEND;VALUE=DATE:20261111/);
  assert.doesNotMatch(first,/PRIVATE/);
  const revised={...base,title:"Nome atualizado"};
  assert.equal(first.match(/UID:[^\r]+/)[0],renderCalendarFeed(saved,[revised],now).match(/UID:[^\r]+/)[0]);
  const cancelled=renderCalendarFeed([{snapshot:base,removedAt:"2026-10-29T12:00:00Z"}],[],now);
  assert.match(cancelled,/STATUS:CANCELLED/);
  assert.match(renderCalendarFeed(saved,[],now),/LAST-MODIFIED:20261029T120000Z/);
  assert.match(renderCalendarFeed([{snapshot:base,removedAt:"2026-10-29T12:00:00Z"}],[],Date.parse("2027-01-01T00:00:00Z")),/STATUS:CANCELLED/);
});
test("ICS remembers stages first exported after saving and cancels them after removal",()=>{
  const extra={...base,discovery:{...base.discovery,editions:[{id:"2026",name:"2026",stages:[stage,{...stage,id:"result",name:"Resultado",kind:"result",start:"2026-12-01"}]}]}};
  const text=renderCalendarFeed([{snapshot:base,history:calendarEntries([extra],0),removedAt:"2026-10-29T12:00:00Z"}],[],now);
  assert.equal((text.match(/STATUS:CANCELLED/g)||[]).length,2);
});
test("ICS escapes line injection and folds UTF-8 at 75 octets",()=>{
  const item={...base,title:"á".repeat(90)+"\nBEGIN:VEVENT,;"};
  const text=renderCalendarFeed([{snapshot:item,removedAt:null}],[item],now);
  assert.equal(text.split("\r\n").filter(l=>l==="BEGIN:VEVENT").length,1);
  for(const line of text.split("\r\n"))assert.ok(Buffer.byteLength(line)<=75);
});
test("private feed rejects malformed tokens before a database lookup and revoked access before reading saved content",async()=>{
  let reads=0,active=false;
  const tagged=async()=>{reads++;return [{user_id:"owner"}];};
  const personal=opportunityLoader({"@/lib/members/db":{getSql:()=>tagged},"@/lib/billing/store":{radarAccess:async()=>({active})}})("lib/opportunities/personal-calendar.ts");
  process.env.RADAR_CALENDAR_PERSONAL_ENABLED="true";
  try {
    assert.equal(await personal.calendarTokenOwner("invalid"),null);assert.equal(reads,0);
    assert.equal(await personal.calendarTokenOwner("a".repeat(64)),null);
    active=true;assert.equal(await personal.calendarTokenOwner("a".repeat(64)),"owner");
  } finally { delete process.env.RADAR_CALENDAR_PERSONAL_ENABLED; }
});
test("paid authorization is required inside the save action and cannot be supplied by a client",async()=>{
  let saved=null;
  const actions=opportunityLoader({"@/lib/opportunities/personal-calendar":{requireCalendarMember:async()=>{throw Error("DENIED")},saveOpportunity:async(...args)=>{saved=args}}})("app/membros/meu-calendario/actions.ts");
  await assert.rejects(actions.toggleSaved("radar-abc",false),/DENIED/);assert.equal(saved,null);
});
