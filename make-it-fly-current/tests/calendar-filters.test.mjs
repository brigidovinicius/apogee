import assert from 'node:assert/strict';
import test from 'node:test';
import { opportunityLoader } from './helpers/load-opportunity-module.mjs';
const load=opportunityLoader();
const filters=()=>load('lib/opportunities/calendar-filters.ts');
const base={id:'radar-one',title:'Olimpíada de astronomia',organization:'Instituto',kind:'Programa',level:'Ensino médio',categories:['competicoes'],location:'Brasil',stateCode:null,cityName:null,nationallyEligible:true,eligibility:'Estudantes',officialUrl:'https://official.test',summary:'Astronomia',benefit:'',deadline:'2026-10-20',deadlineLabel:'20/out',verifiedAt:'2026-10-28',opportunityStatus:'closed',participationFormat:'online',discovery:{subtype:'olimpiada',areas:['ciencias_naturais'],editions:[]}};
test('calendar combines filters without discarding closed registration with future stages',()=>{
  const {readCalendarFilters,filterCalendarItems}=filters();
  const selected=readCalendarFilters(new URLSearchParams('busca=astronomia&categoria=competicoes&formato=online'));
  assert.deepEqual(filterCalendarItems([base,{...base,id:'radar-two',participationFormat:'presencial'}],selected,Date.parse('2026-11-01T12:00:00Z')).map(x=>x.id),['radar-one']);
  assert.equal(filterCalendarItems([base],readCalendarFilters(new URLSearchParams('prazo=abertas'))).length,0);
});
test('saved calendar query preserves the chosen month and only accepts validated filter parameters',()=>{
  const {calendarFilterQuery,readCalendarFilters}=filters();
  const value=calendarFilterQuery(new URLSearchParams('busca=astronomia&formato=online&mes=2026-11&redirect=https://evil.test&beneficio=INVALID&pagina=99'));
  assert.equal(value,'busca=astronomia&formato=online&mes=2026-11');
  assert.equal(calendarFilterQuery(new URLSearchParams('visualizacao=mes&mes=2026-11')),'mes=2026-11&visualizacao=mes');
  assert.equal(readCalendarFilters(new URLSearchParams('mes=2026-99')).month,undefined);
});
test('monthly dates respect Brazilian timezone and date-only registration deadlines',()=>{
  const {calendarMonthDays}=filters();
  const entries=[{key:'a',item:base,stage:{kind:'event',start:'2026-12-01T01:00:00Z'}},{key:'b',item:base,stage:{kind:'registration',start:'2026-10-01',end:'2026-11-30'}},{key:'c',item:base,stage:{kind:'event',start:'2026-12-01'}}];
  const days=calendarMonthDays(entries,'2026-11');
  assert.equal(days.find(d=>d.date==='2026-11-30').entries.length,2);
  assert.equal(days.flatMap(d=>d.entries).some(e=>e.key==='c'),false);
  assert.equal(days.length%7,0);
});
test('saving a calendar filter requires membership inside the action',async()=>{
  const actions=opportunityLoader({'@/lib/opportunities/personal-calendar':{requireCalendarMember:async()=>{throw Error('DENIED')}}})('app/membros/meu-calendario/filter-actions.ts');
  await assert.rejects(actions.saveCalendarFilter(new FormData()),/DENIED/);
});
