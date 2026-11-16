import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { opportunityLoader } from './helpers/load-opportunity-module.mjs';
const load=opportunityLoader();
const {toOpportunity}=load('lib/opportunities/radar-client.ts');
const types=load('lib/opportunities/types.ts');
const {rankOpportunities}=load('lib/opportunities/ranking.ts');
const employment={version:1,provider:'ashby',postingId:'posting',requisitionId:'requisition',roleFamily:'fde',
  workplace:'remote',brazilEligibility:'confirmed',locationText:'Remote Brazil',employmentType:'FullTime',experienceYears:2,
  languages:['English'],travelText:null,publishedAt:null,salary:null};
function row(patch={}) {return {id:'job1',title:'Forward Deployed Engineer',institution:'Employer',benefitType:'employment',
  categories:['carreira'],isCourse:false,nationallyEligible:false,applicantType:'mixed',stateCode:null,cityName:null,
  deadlineAt:null,deadlinePrecision:'not_informed',eventStartsAt:null,opportunityStatus:'open',
  officialUrl:'https://jobs.ashbyhq.com/whippy/8013f907-e90f-4e3d-92c2-d14808891efb',
  lastCheckedAt:new Date().toISOString(),requirementsText:'Original requirements',amountText:'Remuneração não informada na fonte oficial.',employment,...patch};}
test('employment survives the Radar bridge, keeps unknown deadlines and is separate from online courses',()=>{
  const item=toOpportunity(row());assert.ok(item);assert.equal(item.kind,'Emprego');assert.equal(item.deadlineUnknown,true);
  assert.equal(item.participationFormat,null);assert.deepEqual(item.employment,employment);
  assert.equal(types.filterOpportunities([item],{...types.EMPTY_OPPORTUNITY_FILTERS,workplace:'remote',brazilJobs:true}).length,1);
  assert.equal(types.filterOpportunities([item],{...types.EMPTY_OPPORTUNITY_FILTERS,format:'online'}).length,0);
  assert.equal(item.financials.benefits.length,0);
});
test('invalid eligibility, hybrid and stale jobs never pass the public bridge',()=>{
  for(const patch of [{employment:{...employment,brazilEligibility:'unknown'}},{employment:{...employment,workplace:'hybrid'}},
    {lastCheckedAt:new Date(Date.now()-49*3600000).toISOString()},{employment:null}]) assert.equal(toOpportunity(row(patch)),null);
});
test('job filters round-trip in URLs and FDE Brazilian remote jobs rank first within Career',()=>{
  const filters={...types.EMPTY_OPPORTUNITY_FILTERS,category:'carreira',workplace:'remote',brazilJobs:true};
  const params=types.setOpportunityFilterSearchParams(new URLSearchParams(),filters);
  assert.equal(types.opportunityFiltersFromSearchParams(params).workplace,'remote');assert.equal(types.opportunityFiltersFromSearchParams(params).brazilJobs,true);
  const item=toOpportunity(row());const related={...item,id:'related',employment:{...employment,roleFamily:'ai_implementation'}};
  assert.equal(rankOpportunities([related,item],filters)[0].id,item.id);
});
test('salary preserves currency and period, and preview never leaks protected requirements',()=>{
  const salary={min:60000,max:80000,currency:'USD',interval:'1 YEAR'};
  const item=toOpportunity(row({employment:{...employment,salary}}));
  assert.match(item.financials.benefits[0].text,/USD.*1 YEAR/);
  const {opportunityCardData}=load('lib/opportunities/card-data.ts');
  const card=opportunityCardData(item);assert.equal(card.employment.salary,null);assert.deepEqual(card.employment.languages,[]);
  assert.equal(card.employment.experienceYears,null);assert.equal(card.eligibility,'');assert.equal(card.officialUrl,'');
});
test('job source audit confirms eligibility per vacancy without claiming national coverage',()=>{
  const scoped=opportunityLoader({'./actions':{verifyRadarSource(){},setRadarSourceActive(){},ingestRadarSource(){}}});
  const {SourceCard}=scoped('app/admin/radar/source-card.tsx');
  const source={id:'jobs-whippy',name:'Whippy jobs',institutionName:'Whippy',institutionAcronym:'Whippy',
    extractionMode:'api',verificationStatus:'pending',active:false,geographicScope:[],cityName:null,stateCode:null,
    allowedDomains:['api.ashbyhq.com'],listingUrls:[],auditEvidenceUrl:'https://www.whippy.ai/'};
  const html=renderToStaticMarkup(SourceCard({source}));
  assert.match(html,/Elegibilidade por vaga/);
  assert.match(html,/confirmada separadamente em cada vaga/);
  assert.doesNotMatch(html,/abrangência nacional foi confirmada/);
  const legacy=renderToStaticMarkup(SourceCard({source:{...source,id:'legacy',extractionMode:'html',geographicScope:['Brasil']}}));
  assert.match(legacy,/abrangência nacional foi confirmada/);
});
test('budget panel never presents an unreconciled month as confirmed zero spending',async()=>{
  const lane=(cap_micro)=>({cap_micro,spent_micro:0,reserved_micro:0,available_micro:cap_micro});
  const scoped=opportunityLoader({'@/lib/opportunities/radar-editorial-client':{radarBudgetStatus:async()=>({
    enabled:false,monthly:{period:'2026-11-01',opening_verified:false,cap_micro:50000000,spent_micro:0,
      reserved_micro:0,available_micro:50000000,warning_percent:0,
      streams:{radar:lane(30000000),jobs:lane(15000000),reserve:lane(5000000)}}})}});
  const {RadarBudgetPanel}=scoped('app/admin/radar/budget-panel.tsx');
  const html=renderToStaticMarkup(await RadarBudgetPanel());
  assert.match(html,/consumo anterior do mês pendente/);
  assert.match(html,/A conciliar/);
  assert.doesNotMatch(html,/Gasto confirmado:/);
  assert.match(html,/Chamadas pagas de IA desativadas/);
});
