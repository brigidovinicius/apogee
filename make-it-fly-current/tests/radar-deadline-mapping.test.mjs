import assert from "node:assert/strict";
import test from "node:test";

import { opportunityLoader } from "./helpers/load-opportunity-module.mjs";

test("Radar preserves the Brazilian calendar day for date-only and exact deadlines", async () => {
  const previousUrl = process.env.RADAR_ACADEMICO_API_URL;
  const previousToken = process.env.RADAR_ACADEMICO_API_TOKEN;
  const previousFetch = globalThis.fetch;
  process.env.RADAR_ACADEMICO_API_URL = "http://radar.test/api/public/opportunities";
  process.env.RADAR_ACADEMICO_API_TOKEN = "fixture-token";

  try {
    const client = opportunityLoader()("lib/opportunities/radar-client.ts");
    const base = {
      title: "Bolsa verificada", institution: "Universidade",
      benefitType: "research_scholarship", applicantType: "undergraduate_student",
      categories: ["bolsas", "pesquisa"],
      officialUrl: "https://universidade.example/edital", lastCheckedAt: "2026-10-10T12:00:00Z",
      stateCode: null, cityName: null, requirementsText: "Confira o edital", amountText: "Bolsa",
    };
    globalThis.fetch = async () => new Response(JSON.stringify({
      version: 3, opportunities: [
        { ...base, id: "date-only", deadlineAt: "2026-10-10 00:00:00+00", deadlinePrecision: "date_only" },
        { ...base, id: "exact", eventStartsAt: "2026-10-14T09:00:00-03:00", deadlineAt: "2026-10-11 02:30:00+00", deadlinePrecision: "exact_datetime" },
      ],
    }), { status: 200 });

    const items = await client.listRadarOpportunities();
    assert.deepEqual(items.map((item) => item.id), ["radar-date-only", "radar-exact"]);
    assert.deepEqual(items.map((item) => item.deadline), ["2026-10-10", "2026-10-10"]);
    assert.deepEqual(items.map((item) => item.deadlineLabel), ["Inscrições até 10 de outubro", "Inscrições até 10 de outubro"]);
    assert.equal(items[0].deadlineAt, null);
    assert.equal(items[1].deadlineAt, "2026-10-11T02:30:00.000Z");
    assert.equal(items[1].eventStartsAt, "2026-10-14T09:00:00-03:00");
    assert.deepEqual(items[0].categories, ["bolsas", "pesquisa"]);
    globalThis.fetch = async () => new Response(JSON.stringify({ version: 3, opportunities: [{ ...base, id: "missing", deadlineAt: null, deadlinePrecision: "date_only" }] }));
    await assert.rejects(client.listRadarOpportunities(), /Catálogo indisponível/);
    globalThis.fetch = async () => new Response("unavailable", { status: 503 });
    await assert.rejects(client.listRadarOpportunities(), /Catálogo indisponível/);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousUrl === undefined) delete process.env.RADAR_ACADEMICO_API_URL;
    else process.env.RADAR_ACADEMICO_API_URL = previousUrl;
    if (previousToken === undefined) delete process.env.RADAR_ACADEMICO_API_TOKEN;
    else process.env.RADAR_ACADEMICO_API_TOKEN = previousToken;
  }
});

test("Radar accepts a confirmed open event with an unknown deadline without treating it as continuous flow",async()=>{
 const client=opportunityLoader()("lib/opportunities/radar-client.ts");
 const item={id:"event",title:"Encontro",institution:"Organizador",officialUrl:"https://event.example/edition",lastCheckedAt:"2026-10-14T15:00:00Z",benefitType:"other",applicantType:"mixed",categories:["eventos"],opportunityStatus:"open",deadlineAt:null,deadlinePrecision:"not_informed",eventStartsAt:"2026-10-21T09:00:00-03:00",alertsAvailable:true};
 const mapped=client.toOpportunity(item);assert.equal(mapped.deadline,null);assert.equal(mapped.deadlineLabel,"Prazo não informado");assert.equal(mapped.deadlineUnknown,true);assert.equal(mapped.alertsAvailable,true);
 for(const patch of [{categories:["formacao"]},{eventStartsAt:null},{deadlineAt:"2026-10-20"},{opportunityStatus:"upcoming"}])assert.equal(client.toOpportunity({...item,...patch}),null);
});

test("audited admission metadata survives the Radar bridge only for course options",async()=>{
 const client=opportunityLoader()("lib/opportunities/radar-client.ts");
 const item={id:"course",title:"Curso",institution:"IFSC",officialUrl:"https://www.ifsc.edu.br/tecnicos",lastCheckedAt:"2026-10-14T15:00:00Z",benefitType:"other",applicantType:"mixed",categories:["formacao"],isCourse:true,deadlineAt:"2099-10-20",deadlinePrecision:"date_only",admissionProcess:{id:"ifsc-technical-exam-2027-1",title:"IFSC 2027.1"}};
 assert.deepEqual(client.toOpportunity(item).admissionProcess,item.admissionProcess);
 assert.equal(client.toOpportunity({...item,isCourse:false}).admissionProcess,null);
 assert.equal(client.toOpportunity({...item,admissionProcess:{id:"",title:"Missing ID"}}).admissionProcess,null);
});


test("calendar-only opportunities without a legacy deadline preserve audited stages and closed registration", () => {
  const client = opportunityLoader()("lib/opportunities/radar-client.ts");
  const item = {id:"calendar-only",title:"Olimpíada",institution:"Organizador",officialUrl:"https://official.example/calendar",lastCheckedAt:"2026-10-14T15:00:00Z",benefitType:"other",applicantType:"mixed",categories:["competicoes"],opportunityStatus:"closed",deadlineAt:null,deadlinePrecision:"not_informed",discovery:{areas:[],editions:[{id:"2099",name:"2099",stages:[{id:"exam",name:"Prova",kind:"exam",start:"2099-11-10",checkedAt:"2026-10-14T15:00:00Z",sourceUrl:"https://official.example/calendar"}]}]}};
  const mapped = client.toOpportunity(item);
  assert.ok(mapped);
  assert.equal(mapped.opportunityStatus,"closed");
  assert.equal(mapped.deadline,null);
  assert.equal(mapped.discovery.editions[0].stages.length,1);
  assert.match(mapped.summary,/encerradas/);
  assert.equal(client.toOpportunity({...item,discovery:undefined}),null);
});
