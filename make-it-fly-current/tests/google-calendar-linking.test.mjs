import assert from 'node:assert/strict';
import test from 'node:test';
import {opportunityLoader} from './helpers/load-opportunity-module.mjs';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

const nav=opportunityLoader()('lib/opportunities/google-calendar-navigation.ts');
const base='/membros/meu-calendario?integracao=google#google-calendar-heading';
test('saved cards retain the connection shortcut after a server refresh clears action messages',()=>{
 const view=opportunityLoader({
   'next/navigation':{useRouter:()=>({push:()=>{}})},
   'next/link':{__esModule:true,default:({children,href})=>createElement('a',{href},children)},
   '@/app/membros/meu-calendario/actions':{saveOpportunityFromCard:()=>{}},
 })('components/opportunities/save-opportunity.tsx');
 const render=saved=>renderToStaticMarkup(createElement(view.CalendarSaveProvider,{state:{kind:'ready',savedIds:saved?['radar-qa']:[]},returnTo:'/membros/meu-calendario?busca=tech'},createElement(view.SaveOpportunityButton,{id:'radar-qa',title:'QA'})));
 const saved=render(true);assert.match(saved,/Configurar Google Agenda/);assert.match(saved,/integracao=google#google-calendar-heading/);assert.match(saved,/Ver minha agenda/);
 assert.doesNotMatch(render(false),/Configurar Google Agenda/);
});
test('calendar connection resumes only allowlisted filters at the Google section',()=>{
  assert.equal(nav.googleCalendarReturnPath('/membros/meu-calendario?busca=tech&periodo=30dias&google=failed&code=PRIVATE'),'/membros/meu-calendario?busca=tech&periodo=30dias&integracao=google#google-calendar-heading');
  assert.equal(nav.googleCalendarReturnPath('/calendarios/eventos?busca=tech'),'/membros/meu-calendario?busca=tech&calendario=eventos&catalogo=1&integracao=google#google-calendar-heading');
  for(const value of [null,'https://evil.test/membros/meu-calendario','//evil.test','/admin','/membros/colecoes','/membros/meu-calendario/../../admin','/membros\\evil','x'.repeat(5000)])assert.equal(nav.googleCalendarReturnPath(value),base);
  const review=new URL(nav.googleCalendarReviewPath(base),'https://apogee.invalid');
  assert.equal(review.pathname,'/membros/protecao');assert.equal(review.searchParams.get('next'),base);
  assert.equal(opportunityLoader()('lib/opportunities/calendar-navigation.ts').calendarReturnPath(base),base);
});
test('the server retains connection intent when the browser omits the fragment from HTTP',async()=>{
  const browser=new URL(nav.googleCalendarReturnPath('/membros/meu-calendario?busca=tech'),'https://apogee.invalid');
  browser.hash='';
  let destination;
  const page=opportunityLoader({
    '@/lib/opportunities/personal-calendar':{requireCalendarMember:async next=>{destination=next;throw Error('pending-verification');}},
  })('app/membros/meu-calendario/page.tsx');
  await assert.rejects(page.default({searchParams:Promise.resolve(Object.fromEntries(browser.searchParams))}),/pending-verification/);
  assert.equal(destination,'/membros/meu-calendario?busca=tech&integracao=google#google-calendar-heading');
});
function actionFixture(){
  const state={allowed:true,cookies:[],started:[],members:[],syncs:[]};
  const actions=opportunityLoader({
    'next/headers':{cookies:async()=>({set:(...args)=>state.cookies.push(args)})},
    'next/navigation':{redirect:href=>{throw Object.assign(Error('redirect'),{href});}},
    'next/cache':{revalidatePath:()=>{}},
    '@/lib/opportunities/personal-calendar':{requireCalendarMember:async next=>{state.members.push(next);return {id:'password-only-member'};}},
    '@/lib/members/protection':{calendarAdultAccess:async()=>state.allowed},
    '@/lib/opportunities/google-calendar-store':{beginGoogleCalendarOAuth:async id=>{state.started.push(id);return {state:'ab'.repeat(32),url:'https://accounts.google.com/authorized'};}},
    '@/lib/opportunities/google-calendar-sync':{syncGoogleCalendar:async(...args)=>{state.syncs.push(args);return 'synced';}},
    '@/lib/members/mail':{applicationOrigin:()=> 'https://apogee.example.test'},
  })('app/membros/meu-calendario/google-actions.ts');
  return {state,actions};
}
test('a password session starts Calendar OAuth without linking a Google login',async()=>{
  const {state,actions}=actionFixture();const form=new FormData();form.set('next','/membros/meu-calendario?busca=tech&periodo=7dias');form.set('userId','attacker');
  await assert.rejects(actions.connectGoogleCalendarAction(form),e=>e.href==='https://accounts.google.com/authorized');
  assert.deepEqual(state.started,['password-only-member']);
  assert.deepEqual(state.members,['/membros/meu-calendario?busca=tech&periodo=7dias&integracao=google#google-calendar-heading']);
  assert.equal(state.cookies.length,2);
  for(const [, ,options] of state.cookies){assert.equal(options.httpOnly,true);assert.equal(options.secure,true);assert.equal(options.sameSite,'lax');assert.equal(options.maxAge,600);assert.equal(options.path,'/api/integracoes/google-agenda/callback');}
  assert.equal(state.cookies.find(([name])=>name==='apogee_google_calendar_return')[1],state.members[0]);
});
test('pending verification resumes the connection after review without starting OAuth',async()=>{
  const {state,actions}=actionFixture();state.allowed=false;
  const form=new FormData();form.set('next','/membros/meu-calendario?busca=tech');
  await assert.rejects(actions.connectGoogleCalendarAction(form),e=>new URL(e.href,'https://apogee.invalid').searchParams.get('next')==='/membros/meu-calendario?busca=tech&integracao=google#google-calendar-heading');
  assert.equal(state.started.length,0);assert.equal(state.cookies.length,0);
});
test('manual synchronization preserves the calendar filters and section',async()=>{
  const {state,actions}=actionFixture();const form=new FormData();form.set('next','/membros/meu-calendario?periodo=30dias');
  await assert.rejects(actions.syncGoogleCalendarAction(form),e=>e.href==='/membros/meu-calendario?periodo=30dias&integracao=google&google=synced#google-calendar-heading');
  assert.deepEqual(state.syncs,[['password-only-member',{manual:true}]]);
});
function callbackFixture(){
 const state={member:{id:'password-only-member'},active:true,allowed:true,exchanges:[],result:'synced'};
 const route=opportunityLoader({
  '@/lib/members/dal':{getMemberFromHeaders:async()=>state.member},
  '@/lib/members/protection':{calendarAdultAccess:async()=>state.allowed},
  '@/lib/billing/store':{radarAccess:async()=>({active:state.active})},
  '@/lib/members/mail':{applicationOrigin:()=> 'https://apogee.example.test'},
  '@/lib/opportunities/google-calendar-config':{googleCalendarConfig:()=>({}),GOOGLE_CALENDAR_COOKIE:'apogee_google_calendar_state',GOOGLE_CALENDAR_RETURN_COOKIE:'apogee_google_calendar_return',GOOGLE_CALENDAR_CALLBACK:'/api/integracoes/google-agenda/callback'},
  '@/lib/opportunities/google-calendar-store':{completeGoogleCalendarOAuth:async(...args)=>state.exchanges.push(args)},
  '@/lib/opportunities/google-calendar-sync':{syncGoogleCalendar:async()=>state.result},
 })('app/api/integracoes/google-agenda/callback/route.ts');
 const request=(next,query='code=PRIVATE&state=state&userId=attacker')=>({headers:new Headers(),nextUrl:new URL('https://apogee.example.test/api/integracoes/google-agenda/callback?'+query),cookies:{get:name=>({value:name==='apogee_google_calendar_return'?next:'state'})}});
 return {state,route,request};
}
test('callback preserves safe context, uses session identity and clears both temporary cookies',async()=>{
 const {state,route,request}=callbackFixture();
 const response=await route.GET(request('/membros/meu-calendario?busca=tech&code=PRIVATE'));
 assert.equal(response.status,303);assert.equal(response.headers.get('location'),'https://apogee.example.test/membros/meu-calendario?busca=tech&integracao=google&google=synced#google-calendar-heading');
 assert.equal(state.exchanges[0][0],'password-only-member');
 assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(response.headers.get('referrer-policy'),'no-referrer');
 const deleted=response.cookies.getAll();assert.equal(deleted.length,2);assert.ok(deleted.every(c=>c.value===''&&c.maxAge===0));
});
test('tampered return cookies cannot redirect outside the calendar or echo secrets',async()=>{
 for(const next of ['https://evil.test/','//evil.test/','/admin','/membros/meu-calendario?token=PRIVATE&code=PRIVATE&next=https://evil.test']){
  const {route,request}=callbackFixture();const response=await route.GET(request(next));
  assert.equal(response.headers.get('location'),'https://apogee.example.test/membros/meu-calendario?integracao=google&google=synced#google-calendar-heading');
 }
});
test('refusal and invalid access never exchange Google credentials',async()=>{
 const {state,route,request}=callbackFixture();
 assert.match((await route.GET(request(base,'error=access_denied'))).headers.get('location'),/google=denied/);
 for(const change of [{member:null},{allowed:false},{active:false}]){
  Object.assign(state,{member:{id:'password-only-member'},allowed:true,active:true},change);
  assert.match((await route.GET(request(base))).headers.get('location'),/google=access/);
 }
 assert.equal(state.exchanges.length,0);
});
