import assert from 'node:assert/strict';
import test from 'node:test';
import { opportunityLoader } from './helpers/load-opportunity-module.mjs';
const load=opportunityLoader();
const f=load('lib/opportunities/calendar-filters.ts');
const nav=load('lib/opportunities/calendar-navigation.ts');
const entry=(kind,start,end)=>({key:kind+start,item:{id:'radar-one'},stage:{kind,start,...(end?{end}:{})}});

test('relative periods survive saved searches and discard stale month/day/view',()=>{
  const query=f.calendarFilterQuery(new URLSearchParams('periodo=7dias&mes=2026-11&dia=2026-11-04&visualizacao=mes&prazo=30dias'));
  assert.equal(query,'prazo=30dias&periodo=7dias');
  const filters=f.readCalendarFilters(new URLSearchParams(query));
  assert.equal(filters.view,'list');
  assert.deepEqual(f.calendarPeriodRange(filters,'2026-12-29'),{start:'2026-12-29',end:'2027-01-04'});
  assert.deepEqual(f.calendarPeriodRange(filters,'2027-01-01'),{start:'2027-01-01',end:'2027-01-07'});
});
test('ongoing events overlap the selected day while registration uses its closing date',()=>{
  const entries=[entry('event','2026-11-03','2026-11-07'),entry('registration','2026-11-01','2026-11-09'),entry('exam','2026-11-05T02:00:00Z')];
  const selected=f.filterCalendarEntries(entries,{view:'list',period:'hoje'},'2026-11-05');
  assert.deepEqual(selected.map(e=>e.stage.kind),['event']);
  assert.equal(f.calendarMonthDays(entries,'2026-11').find(d=>d.date==='2026-11-04').entries.length,2);
});
test('months, invalid dates and navigation boundaries are validated',()=>{
  assert.equal(f.calendarMonthDays([],'2028-02').filter(d=>d.date).length,29);
  assert.equal(f.calendarMonthDays([],'2027-02').filter(d=>d.date).length,28);
  assert.equal(f.shiftCalendarMonth('2026-12',1),'2027-01');
  assert.equal(f.shiftCalendarMonth('2000-01',-1),null);
  assert.equal(f.shiftCalendarMonth('2099-12',1),null);
  for(const day of ['2026-02-30','2026-13-01','evil'])assert.equal(f.validCalendarDate(day),false);
  assert.equal(f.readCalendarFilters(new URLSearchParams('mes=2026-11&dia=2026-12-01')).day,undefined);
  assert.equal(f.calendarNavigationQuery(new URLSearchParams('mes=2026-11&dia=2026-11-05&catalogo=1&evil=x')).toString(),'mes=2026-11&catalogo=1&dia=2026-11-05');
});
test('return destinations preserve only internal calendar/catalogue state',()=>{
  assert.equal(nav.calendarReturnPath('/calendarios/hackathons?busca=tecnologia&mes=2026-12&next=https://evil.test'),'/membros/meu-calendario?busca=tecnologia&calendario=hackathons&mes=2026-12&catalogo=1');
  assert.equal(nav.calendarReturnPath('/oportunidades?busca=tech&pagina=2'),'/membros/oportunidades?busca=tech&pagina=2');
  for(const value of ['https://evil.test/','//evil.test','/admin','/membros/meu-calendario/../../admin',null])assert.equal(nav.calendarReturnPath(value),'/membros/meu-calendario');
  const detail=load('lib/opportunities/detail-path.ts');
  assert.equal(detail.radarDetailReturnPath('/membros/meu-calendario?periodo=7dias'),'/membros/meu-calendario?periodo=7dias');
});

function actionFixture() {
 const state={access:{kind:'ready',member:{id:'owner'}},writes:[],queued:0,fail:false};
 const actions=opportunityLoader({
  '@/lib/opportunities/personal-calendar':{calendarSaveAccess:async()=>state.access,saveOpportunity:async(...args)=>{if(state.fail)throw Error('down');state.writes.push(args);}},
  '@/lib/opportunities/google-calendar-store':{queueGoogleCalendarSync:async()=>{state.queued++;return false;}},
  '@/lib/opportunities/google-calendar-sync':{syncGoogleCalendar:async()=>{}},
  'next/cache':{revalidatePath:()=>{}},'next/server':{after:()=>{}}
 })('app/membros/meu-calendario/actions.ts');
 return {state,actions};
}
test('card mutation rechecks access and uses session identity plus explicit desired state',async()=>{
 const {state,actions}=actionFixture();
 assert.deepEqual(await actions.saveOpportunityFromCard('radar-one',true,'/oportunidades'),{ok:true,saved:true});
 assert.deepEqual(state.writes,[['owner','radar-one',false]]);
 state.access={kind:'redirect',href:'/membros/entrar'};
 assert.deepEqual(await actions.saveOpportunityFromCard('radar-two',true,'/oportunidades'),{ok:false,redirect:'/membros/entrar'});
 assert.equal(state.writes.length,1);
 state.access={kind:'disabled'};
 assert.equal((await actions.saveOpportunityFromCard('radar-one',true,'/')).ok,false);
 assert.equal(state.queued,1);
});
test('failed writes and malformed requests never queue sync or report saved',async()=>{
 const {state,actions}=actionFixture();
 state.fail=true;
 assert.equal((await actions.saveOpportunityFromCard('radar-one',true,'/')).ok,false);
 assert.equal((await actions.saveOpportunityFromCard('radar-one','false','/')).ok,false);
 assert.equal((await actions.saveOpportunityFromCard('../invalid',true,'/')).ok,false);
 assert.equal(state.queued,0);
});
