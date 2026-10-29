import assert from 'node:assert/strict';
import test from 'node:test';
import { opportunityLoader } from './helpers/load-opportunity-module.mjs';

const load=opportunityLoader();
const {calendarEntries,stageEnd}=load('lib/opportunities/discovery.ts');
const {renderCalendarFeed}=load('lib/opportunities/ics.ts');
const now=Date.parse('2026-10-29T12:00:00Z');
const stage={id:'exam',name:'Prova',kind:'exam',start:'2026-11-10T13:00:00-03:00',end:'2026-11-10T18:00:00-03:00',sourceUrl:'https://official.test/PRIVATE',checkedAt:'2026-10-28T12:00:00Z'};
const item={id:'radar-qa',title:'Olimpíada QA',organization:'Teste',categories:['competicoes'],deadline:null,officialUrl:'https://official.test/PRIVATE',eligibility:'PRIVATE',verificationTimestamp:stage.checkedAt,discovery:{subtype:'olimpiada',areas:['matematica'],editions:[{id:'2026',name:'2026',stages:[stage]}]}};
const uid=text=>text.match(/UID:[^\r]+/)[0];

test('ICS preserves exact UTC times and event identity when dates and titles change',()=>{
  const saved=[{snapshot:item,removedAt:null}];
  const initial=renderCalendarFeed(saved,[item],now);
  assert.match(initial,/DTSTART:20261110T160000Z/);assert.match(initial,/DTEND:20261110T210000Z/);
  const revised={...item,title:'Título corrigido',discovery:{...item.discovery,editions:[{...item.discovery.editions[0],stages:[{...stage,start:'2026-11-11T13:00:00-03:00',end:undefined,checkedAt:'2026-10-29T11:00:00Z'}]}]}};
  const text=renderCalendarFeed(saved,[revised],now);
  assert.equal(uid(initial),uid(text));assert.match(text,/DTSTART:20261111T160000Z/);
  assert.match(text,/LAST-MODIFIED:20261029T110000Z/);assert.match(text,/Título corrigido/);
  assert.equal((text.match(/BEGIN:VEVENT/g)||[]).length,1);
});
test('ICS cancels only the removed stage and restores the same UID after re-adding',()=>{
  const extra={...stage,id:'result',kind:'result',name:'Resultado',start:'2026-12-01',end:undefined};
  const both={...item,discovery:{...item.discovery,editions:[{...item.discovery.editions[0],stages:[stage,extra]}]}};
  const saved=[{snapshot:both,removedAt:null,history:calendarEntries([both],0)}];
  const cancelled=renderCalendarFeed(saved,[item],now);
  assert.equal((cancelled.match(/STATUS:CANCELLED/g)||[]).length,1);
  assert.equal((cancelled.match(/STATUS:CONFIRMED/g)||[]).length,1);
  const restored=renderCalendarFeed(saved,[both],now);
  assert.doesNotMatch(restored,/STATUS:CANCELLED/);
  assert.deepEqual(cancelled.match(/UID:[^\r]+/g).sort(),restored.match(/UID:[^\r]+/g).sort());
});
test('all-day ranges include the final day and Brazilian midnight boundary',()=>{
  const allDay={...item,discovery:{...item.discovery,editions:[{id:'2026',name:'2026',stages:[{...stage,start:'2026-11-10',end:'2026-11-12'}]}]}};
  assert.match(renderCalendarFeed([{snapshot:allDay,removedAt:null}],[allDay],now),/DTEND;VALUE=DATE:20261113/);
  assert.equal(stageEnd({start:'2026-11-12'}),Date.parse('2026-11-13T02:59:59Z'));
  assert.equal(calendarEntries([allDay],Date.parse('2026-11-13T03:00:00Z')).length,0);
});
test('calendar suppresses duplicate admission processes without inventing stages for continuous opportunities',()=>{
  const process={id:'same',title:'Processo'};
  assert.equal(calendarEntries([{...item,admissionProcess:process},{...item,id:'radar-other',admissionProcess:process}],now).length,1);
  assert.deepEqual(calendarEntries([{...item,discovery:undefined,eventStartsAt:null,deadline:null}],now),[]);
});

function feedRoute({owner='qa-owner',unavailable=false,storageFailure=false}={}) {
  const calls=[];
  const route=opportunityLoader({
    '@/lib/opportunities/personal-calendar':{
      calendarTokenOwner:async()=>{calls.push('owner');return owner},
      rememberCalendarEvents:async(id)=>{assert.equal(id,owner);calls.push('remember');if(storageFailure)throw Error('database down')},
      savedOpportunities:async(id)=>{assert.equal(id,owner);calls.push('saved');return [{snapshot:item,removedAt:null}]},
    },
    '@/lib/opportunities/radar-client':{listRadarOpportunities:async()=>{calls.push('catalogue');if(unavailable)throw Error('upstream down');return [item]}},
    '@/lib/members/mail':{applicationOrigin:()=> 'http://127.0.0.1:4381'},
  })('app/meu-calendario/[token]/route.ts');
  return {calls,get:(token='a'.repeat(64)+'.ics')=>route.GET(new Request('http://127.0.0.1:4381/meu-calendario/'+token),{params:Promise.resolve({token})})};
}
test('feed HTTP response is private, downloadable and keeps protected data out',async()=>{
  const route=feedRoute();const response=await route.get();
  assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/^text\/calendar/);
  assert.equal(response.headers.get('cache-control'),'private, no-store');
  assert.equal(response.headers.get('referrer-policy'),'no-referrer');
  assert.match(response.headers.get('x-robots-tag'),/noindex/);
  const text=await response.text();assert.doesNotMatch(text,/PRIVATE/);assert.match(text,/URL:http:\/\/127.0.0.1:4381/);
  assert.deepEqual(route.calls,['owner','catalogue','remember','saved']);
});
test('upstream and storage outages return 503 instead of publishing spurious cancellations',async()=>{
  for(const options of [{unavailable:true},{storageFailure:true}]) {
    const route=feedRoute(options);const response=await route.get();
    assert.equal(response.status,503);assert.equal(response.headers.get('cache-control'),'private, no-store');
    assert.doesNotMatch(await response.text(),/VCALENDAR|CANCELLED/);assert.equal(route.calls.includes('saved'),false);
  }
});
test('unknown or malformed feed tokens cannot read catalogue or saved opportunities',async()=>{
  const unknown=feedRoute({owner:null});assert.equal((await unknown.get()).status,404);assert.deepEqual(unknown.calls,['owner']);
  for(const token of ['invalid.ics','A'.repeat(64)+'.ics','a'.repeat(64),'a'.repeat(65)+'.ics']) {
    const route=feedRoute();assert.equal((await route.get(token)).status,404);assert.deepEqual(route.calls,[]);
  }
});
test('all personal calendar actions derive the actor from the server session',async()=>{
  const calls=[];
  const actions=opportunityLoader({
    '@/lib/opportunities/personal-calendar':{requireCalendarMember:async()=>({id:'session-owner'}),saveOpportunity:async(...args)=>calls.push(args),rotateCalendarToken:async id=>{calls.push([id]);return 'a'.repeat(64)}},
    'next/cache':{revalidatePath:()=>{}},
  })('app/membros/meu-calendario/actions.ts');
  await actions.toggleSaved('radar-qa',false);await actions.toggleSaved('radar-qa',true);
  assert.equal((await actions.createFeed()).url,'/meu-calendario/'+'a'.repeat(64)+'.ics');
  assert.deepEqual(calls,[['session-owner','radar-qa',false],['session-owner','radar-qa',true],['session-owner']]);
});
test('token creation denies an unauthorized session before any write',async()=>{
  let writes=0;
  const actions=opportunityLoader({'@/lib/opportunities/personal-calendar':{requireCalendarMember:async()=>{throw Error('DENIED')},rotateCalendarToken:async()=>{writes++}}})('app/membros/meu-calendario/actions.ts');
  await assert.rejects(actions.createFeed(),/DENIED/);assert.equal(writes,0);
});
