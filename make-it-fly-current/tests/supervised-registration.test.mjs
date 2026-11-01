import test from 'node:test';
import assert from 'node:assert/strict';
import {opportunityLoader} from './helpers/load-opportunity-module.mjs';

test('adult access requires a verified email and human approval, not a declaration alone',async()=>{
  let reads=0,row;const previous=process.env.MEMBERS_SUPERVISED_REGISTRATION_ENABLED;
  const protection=opportunityLoader({'./db':{getSql:()=>async()=>{reads++;return row?[row]:[];}}})('lib/members/protection.ts');
  try {
    delete process.env.MEMBERS_SUPERVISED_REGISTRATION_ENABLED;assert.equal(await protection.adultAccess('qa'),true);assert.equal(reads,0);
    process.env.MEMBERS_SUPERVISED_REGISTRATION_ENABLED='true';
    for(const [state,expected] of [[null,false],[{role:'member',email_verified:true,status:'pending'},false],[{role:'member',email_verified:false,status:'approved'},false],[{role:'member',email_verified:true,status:'approved'},true],[{role:'admin'},true],[{role:'admin',blocked:true},false]]){row=state;assert.equal(await protection.adultAccess('qa'),expected);}
  }finally{if(previous===undefined)delete process.env.MEMBERS_SUPERVISED_REGISTRATION_ENABLED;else process.env.MEMBERS_SUPERVISED_REGISTRATION_ENABLED=previous;}
});
test('dependent input requires explicit consent and known age bands before any SQL call',async()=>{
  const previous=process.env.MEMBERS_SUPERVISED_REGISTRATION_ENABLED;process.env.MEMBERS_SUPERVISED_REGISTRATION_ENABLED='true';let reads=0;
  const protection=opportunityLoader({'./db':{getSql:()=>{reads++;throw Error('Unexpected database call');}}})('lib/members/protection.ts');
  const input={nickname:'QA Filho',ageBand:'under_12',relationship:'parent',consent:true};
  try{for(const patch of [{consent:false},{ageBand:'adult'},{relationship:'friend'},{nickname:'x'},{nickname:'https://example.invalid'}])await assert.rejects(protection.requestDependent('guardian',{...input,...patch}));assert.equal(reads,0);}
  finally{if(previous===undefined)delete process.env.MEMBERS_SUPERVISED_REGISTRATION_ENABLED;else process.env.MEMBERS_SUPERVISED_REGISTRATION_ENABLED=previous;}
});
test('protection actions derive the guardian from the session and ignore forged actor fields',async()=>{
  const calls=[];let actor={id:'real-guardian'};
  const actions=opportunityLoader({
    '@/lib/members/dal':{getCurrentMember:async()=>actor},
    '@/lib/members/protection':{supervisedRegistrationEnabled:()=>true,requestDependent:async(...args)=>calls.push(args),revokeDependent:async(...args)=>calls.push(args)},
    '@/lib/members/rate-limit':{consumeRateLimit:async()=>true},
    'next/cache':{revalidatePath:()=>{}},'next/navigation':{redirect:path=>{throw Error('REDIRECT:'+path)},notFound:()=>{throw Error('NOT_FOUND')}},
  })('app/membros/protecao/actions.ts');
  const form=new FormData();for(const [key,value] of Object.entries({guardianId:'victim',userId:'victim',nickname:'QA Filho',ageBand:'under_12',relationship:'parent',consent:'on',dependentId:'known-id'}))form.set(key,value);
  await assert.rejects(actions.requestDependentAction(form),/REDIRECT:.*resultado=ok/);assert.equal(calls[0][0],'real-guardian');
  await assert.rejects(actions.revokeDependentAction(form),/REDIRECT:.*resultado=ok/);assert.deepEqual(calls[1],['real-guardian','known-id']);
  actor=null;await assert.rejects(actions.requestDependentAction(form),/REDIRECT:\/membros\/entrar/);assert.equal(calls.length,2);
});
test('raw email registration rejects missing or string adult declarations',async()=>{
  const abuse=opportunityLoader({'./protection':{supervisedRegistrationEnabled:()=>true},'./client-ip':{memberClientIp:()=> '127.0.0.1'}})('lib/members/auth-abuse.ts');
  for(const body of [{},{adultDeclared:false},{adultDeclared:'true'}])await assert.rejects(abuse.enforceMemberAuthAbuse({path:'/sign-up/email',headers:new Headers(),body}));
  await abuse.enforceMemberAuthAbuse({path:'/sign-up/email',headers:new Headers(),body:{adultDeclared:true}});
});
test('pending members cannot exchange Google Calendar OAuth credentials',async()=>{
  let exchanges=0;
  const route=opportunityLoader({
    '@/lib/members/dal':{getMemberFromHeaders:async()=>({id:'pending'})},
    '@/lib/members/protection':{calendarAdultAccess:async()=>false},
    '@/lib/opportunities/google-calendar-config':{googleCalendarConfig:()=>({}),GOOGLE_CALENDAR_PATH:'/membros/meu-calendario',GOOGLE_CALENDAR_COOKIE:'state',GOOGLE_CALENDAR_CALLBACK:'/callback'},
    '@/lib/members/mail':{applicationOrigin:()=> 'http://127.0.0.1:4381'},
    '@/lib/opportunities/google-calendar-store':{completeGoogleCalendarOAuth:async()=>{exchanges++;}},
  })('app/api/integracoes/google-agenda/callback/route.ts');
  const response=await route.GET({headers:new Headers()});assert.match(response.headers.get('location'),/google=access/);assert.equal(exchanges,0);
});

test('existing account transition preserves access without granting Google or dependent privileges',async()=>{
  const keys=['MEMBERS_SUPERVISED_REGISTRATION_ENABLED','MEMBERS_PROTECTION_EXISTING_ACCOUNTS_BEFORE'];
  const prior=keys.map(k=>process.env[k]);let row;
  const sql=async()=>row?[row]:[];sql.begin=async(...args)=>args.at(-1)(sql);
  const protection=opportunityLoader({'./db':{getSql:()=>sql}})('lib/members/protection.ts');
  try {
    process.env.MEMBERS_SUPERVISED_REGISTRATION_ENABLED='true';
    process.env.MEMBERS_PROTECTION_EXISTING_ACCOUNTS_BEFORE='2026-01-01T00:00:00.000Z';
    row={role:'member',email_verified:true,created_at:'2025-01-01T00:00:00Z',status:null};
    assert.equal(await protection.adultAccess('existing'),true);
    assert.equal(await protection.calendarAdultAccess('existing'),false);
    row.status='pending';assert.equal(await protection.adultAccess('existing'),true);assert.equal(await protection.calendarAdultAccess('existing'),false);
    row.status='rejected';row.reviewed_at='2026-01-02T00:00:00Z';assert.equal(await protection.adultAccess('existing'),false);
    row.status='pending';assert.equal(await protection.adultAccess('existing'),false);
    row.status='approved';assert.equal(await protection.calendarAdultAccess('existing'),true);
    row.email_verified=false;assert.equal(await protection.calendarAdultAccess('existing'),false);
    row.blocked=true;assert.equal(await protection.adultAccess('existing'),false);
    row={role:'member',email_verified:true,created_at:'2026-01-01T00:00:00Z',status:null};
    assert.equal(await protection.adultAccess('new'),false);
    row.created_at='2025-01-01T00:00:00Z';
    for(const cutoff of ['', 'invalid','2999-01-01T00:00:00.000Z','2026-02-30T00:00:00.000Z','2026-01-01']) {
      process.env.MEMBERS_PROTECTION_EXISTING_ACCOUNTS_BEFORE=cutoff;
      assert.equal(await protection.adultAccess('existing'),false);
    }
    process.env.MEMBERS_SUPERVISED_REGISTRATION_ENABLED='false';
    assert.equal(await protection.calendarAdultAccess('existing'),false);
  }finally{keys.forEach((k,i)=>{if(prior[i]===undefined)delete process.env[k];else process.env[k]=prior[i];});}
});
test('Google OAuth is refused before storing state or exchanging a token when review is missing',async()=>{
  let queries=0,exchanges=0;
  const sql=async()=>{queries++;return [];};sql.begin=async(...args)=>args.at(-1)(sql);
  const store=opportunityLoader({
    '@/lib/members/protection':{calendarAdultAccess:async()=>false},
    '@/lib/members/db':{getSql:()=>sql},
    './google-calendar-config':{requiredGoogleCalendarConfig:()=>({})},
    './google-calendar-client':{GoogleCalendarError:class extends Error {},googleTokens:async()=>{exchanges++;}},
  })('lib/opportunities/google-calendar-store.ts');
  await assert.rejects(store.beginGoogleCalendarOAuth('existing'));
  assert.equal(queries,0);
  const state='ab'.repeat(32);
  await assert.rejects(store.completeGoogleCalendarOAuth('existing',state,state,'qa-code'));
  assert.equal(exchanges,0);assert.equal(queries,1);
});
test('Google disconnect is available to the authenticated account without entitlement or review',async()=>{
  const calls=[];
  const actions=opportunityLoader({
    '@/lib/members/dal':{getCurrentMember:async()=>({id:'session-user'})},
    '@/lib/opportunities/personal-calendar':{requireCalendarMember:async()=>{throw Error('Must not require paid access');}},
    '@/lib/opportunities/google-calendar-store':{disconnectGoogleCalendar:async id=>calls.push(id)},
    'next/cache':{revalidatePath:()=>{}},
  })('app/membros/meu-calendario/google-actions.ts');
  await actions.disconnectGoogleCalendarAction();assert.deepEqual(calls,['session-user']);
});

test('Google interface routes pending accounts to review and still offers disconnect for a retained connection',()=>{
  const disconnect=()=>{};
  const Google=opportunityLoader({
    '@/app/membros/meu-calendario/google-actions':{connectGoogleCalendarAction:()=>{},disconnectGoogleCalendarAction:disconnect,syncGoogleCalendarAction:()=>{}},
  })('components/opportunities/google-calendar.tsx').GoogleCalendar;
  const nodes=node=>Array.isArray(node)?node.flatMap(nodes):node?.props?[node,...nodes(node.props.children)]:[];
  const status={configured:true,connected:false,reviewRequired:true,lastSync:null,error:null};
  const pending=nodes(Google({status}));
  assert.ok(pending.some(node=>node.props.href==='/membros/protecao'));
  assert.equal(pending.filter(node=>node.type==='form').length,0);
  const connected=nodes(Google({status:{...status,connected:true}}));
  assert.deepEqual(connected.filter(node=>node.type==='form').map(node=>node.props.action),[disconnect]);
});
