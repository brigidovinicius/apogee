import assert from "node:assert/strict";
import test from "node:test";
import { opportunityLoader } from "./helpers/load-opportunity-module.mjs";
const load=opportunityLoader();
const { readDiscovery, calendarEntries, publicOpportunityPath, displayOpportunityTitle }=load("lib/opportunities/discovery.ts");
const { opportunityCardData }=load("lib/opportunities/card-data.ts");
const { isOpportunityOpen, opportunityFiltersFromSearchParams, setOpportunityFilterSearchParams, primaryOpportunityCategory }=load("lib/opportunities/types.ts");
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
test("paid authorization is required inside the save action and cannot be supplied by a client",async()=>{
  let saved=null;
  const actions=opportunityLoader({"@/lib/opportunities/personal-calendar":{requireCalendarMember:async()=>{throw Error("DENIED")},saveOpportunity:async(...args)=>{saved=args}}})("app/membros/meu-calendario/actions.ts");
  await assert.rejects(actions.toggleSaved("radar-abc",false),/DENIED/);assert.equal(saved,null);
});
