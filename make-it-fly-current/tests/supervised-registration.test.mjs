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
    '@/lib/members/protection':{adultAccess:async()=>false},
    '@/lib/opportunities/google-calendar-config':{googleCalendarConfig:()=>({}),GOOGLE_CALENDAR_PATH:'/membros/meu-calendario',GOOGLE_CALENDAR_COOKIE:'state',GOOGLE_CALENDAR_CALLBACK:'/callback'},
    '@/lib/members/mail':{applicationOrigin:()=> 'http://127.0.0.1:4381'},
    '@/lib/opportunities/google-calendar-store':{completeGoogleCalendarOAuth:async()=>{exchanges++;}},
  })('app/api/integracoes/google-agenda/callback/route.ts');
  const response=await route.GET({headers:new Headers()});assert.match(response.headers.get('location'),/google=access/);assert.equal(exchanges,0);
});
