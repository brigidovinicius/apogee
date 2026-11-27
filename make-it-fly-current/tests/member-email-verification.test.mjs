import test from 'node:test';
import assert from 'node:assert/strict';
import {opportunityLoader} from './helpers/load-opportunity-module.mjs';

test('email eligibility reads only the account and locks it inside a transaction',async()=>{
  let row={email_verified:true};
  const queries=[];
  const sql=async(parts,...params)=>{queries.push({statement:parts.join('?'),params});return row?[row]:[];};
  const {hasVerifiedMemberEmail}=opportunityLoader({'./db':{getSql:()=>sql}})('lib/members/email-verification.ts');
  assert.equal(await hasVerifiedMemberEmail('member'),true);
  assert.match(queries[0].statement,/not blocked$/);
  assert.deepEqual(queries[0].params,['member']);
  assert.equal(await hasVerifiedMemberEmail('member',sql),true);
  assert.match(queries[1].statement,/not blocked for share$/);
  row={email_verified:false};assert.equal(await hasVerifiedMemberEmail('member'),false);
  row=undefined;assert.equal(await hasVerifiedMemberEmail('missing'),false);
});

test('legacy confirmation links retain their protected destination and cannot loop or leave Apogee',()=>{
  const {emailVerificationDestination}=opportunityLoader()('lib/members/validation.ts');
  assert.equal(emailVerificationDestination('/membros/meu-calendario?integracao=google#google-calendar-heading'),'/membros/meu-calendario?integracao=google#google-calendar-heading');
  for(const path of ['/membros/protecao?next=/membros/protecao','/membros/protecao/','https://external.test/membros'])
    assert.equal(emailVerificationDestination(path),'/membros');
});

test('members without confirmed email cannot exchange Google Calendar OAuth credentials',async()=>{
  let exchanges=0;
  const route=opportunityLoader({
    '@/lib/members/dal':{getMemberFromHeaders:async()=>({id:'pending'})},
    '@/lib/members/email-verification':{hasVerifiedMemberEmail:async()=>false},
    '@/lib/opportunities/google-calendar-config':{googleCalendarConfig:()=>({}),GOOGLE_CALENDAR_PATH:'/membros/meu-calendario',GOOGLE_CALENDAR_COOKIE:'state',GOOGLE_CALENDAR_CALLBACK:'/callback'},
    '@/lib/members/mail':{applicationOrigin:()=> 'http://127.0.0.1:4381'},
    '@/lib/opportunities/google-calendar-store':{completeGoogleCalendarOAuth:async()=>{exchanges++;}},
  })('app/api/integracoes/google-agenda/callback/route.ts');
  const response=await route.GET({headers:new Headers(),cookies:{get:()=>undefined}});assert.match(response.headers.get('location'),/google=access/);assert.equal(exchanges,0);
});

test('Google OAuth is refused before storing state or exchanging a token when email is unverified',async()=>{
  let queries=0,exchanges=0;
  const sql=async()=>{queries++;return [];};sql.begin=async(...args)=>args.at(-1)(sql);
  const store=opportunityLoader({
    '@/lib/members/email-verification':{hasVerifiedMemberEmail:async()=>false},
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
test('Google disconnect is available to the authenticated account without entitlement or confirmed email',async()=>{
  const calls=[];
  const actions=opportunityLoader({
    '@/lib/members/dal':{getCurrentMember:async()=>({id:'session-user'})},
    '@/lib/opportunities/personal-calendar':{requireCalendarMember:async()=>{throw Error('Must not require paid access');}},
    '@/lib/opportunities/google-calendar-store':{disconnectGoogleCalendar:async id=>calls.push(id)},
    'next/cache':{revalidatePath:()=>{}},
  })('app/membros/meu-calendario/google-actions.ts');
  await actions.disconnectGoogleCalendarAction();assert.deepEqual(calls,['session-user']);
});

test('Google interface routes unverified accounts to email confirmation and still offers disconnect for a retained connection',()=>{
  const disconnect=()=>{};
  const Google=opportunityLoader({
    '@/app/membros/meu-calendario/google-actions':{connectGoogleCalendarAction:()=>{},disconnectGoogleCalendarAction:disconnect,syncGoogleCalendarAction:()=>{}},
  })('components/opportunities/google-calendar.tsx').GoogleCalendar;
  const nodes=node=>Array.isArray(node)?node.flatMap(nodes):node?.props?[node,...nodes(node.props.children)]:[];
  const status={configured:true,connected:false,emailVerificationRequired:true,lastSync:null,error:null};
  const pending=nodes(Google({status}));
  assert.ok(pending.some(node=>node.props.href==='/membros/protecao?next=%2Fmembros%2Fmeu-calendario%3Fintegracao%3Dgoogle%23google-calendar-heading'));
  assert.equal(pending.filter(node=>node.type==='form').length,0);
  const connected=nodes(Google({status:{...status,connected:true}}));
  assert.deepEqual(connected.filter(node=>node.type==='form').map(node=>node.props.action),[disconnect]);
});
