import assert from 'node:assert/strict';
import test from 'node:test';
import { opportunityLoader } from './helpers/load-opportunity-module.mjs';

const load=opportunityLoader();
const {calendarEntries,stageEnd}=load('lib/opportunities/discovery.ts');
const now=Date.parse('2026-10-29T12:00:00Z');
const stage={id:'exam',name:'Prova',kind:'exam',start:'2026-11-10T13:00:00-03:00',end:'2026-11-10T18:00:00-03:00',sourceUrl:'https://official.test/PRIVATE',checkedAt:'2026-10-28T12:00:00Z'};
const item={id:'radar-qa',title:'Olimpíada QA',organization:'Teste',categories:['competicoes'],deadline:null,officialUrl:'https://official.test/PRIVATE',eligibility:'PRIVATE',verificationTimestamp:stage.checkedAt,discovery:{subtype:'olimpiada',areas:['matematica'],editions:[{id:'2026',name:'2026',stages:[stage]}]}};
test('all-day ranges include the final day and Brazilian midnight boundary',()=>{
  const allDay={...item,discovery:{...item.discovery,editions:[{id:'2026',name:'2026',stages:[{...stage,start:'2026-11-10',end:'2026-11-12'}]}]}};
  assert.equal(stageEnd({start:'2026-11-12'}),Date.parse('2026-11-13T02:59:59Z'));
  assert.equal(calendarEntries([allDay],Date.parse('2026-11-13T03:00:00Z')).length,0);
});
test('calendar suppresses duplicate admission processes without inventing stages for continuous opportunities',()=>{
  const process={id:'same',title:'Processo'};
  assert.equal(calendarEntries([{...item,admissionProcess:process},{...item,id:'radar-other',admissionProcess:process}],now).length,1);
  assert.deepEqual(calendarEntries([{...item,discovery:undefined,eventStartsAt:null,deadline:null}],now),[]);
});

test('all personal calendar actions derive the actor from the server session',async()=>{
  const calls=[];
  const actions=opportunityLoader({
    '@/lib/opportunities/personal-calendar':{requireCalendarMember:async()=>({id:'session-owner'}),saveOpportunity:async(...args)=>calls.push(args)},
    'next/cache':{revalidatePath:()=>{}},
  })('app/membros/meu-calendario/actions.ts');
  await actions.toggleSaved('radar-qa',false);await actions.toggleSaved('radar-qa',true);
  assert.deepEqual(calls,[['session-owner','radar-qa',false],['session-owner','radar-qa',true]]);
});
