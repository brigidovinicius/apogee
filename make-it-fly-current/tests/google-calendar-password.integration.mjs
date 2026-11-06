// Real password registration, email verification, sessions and PostgreSQL.
// Only provider HTTP is simulated here; the separate browser pilot uses real Google OAuth.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {drizzle} from 'drizzle-orm/postgres-js';
import * as betterAuthPackage from 'better-auth';
import {calendarTestDatabase} from './helpers/calendar-test-database.mjs';
import {opportunityLoader} from './helpers/load-opportunity-module.mjs';

const sql=await calendarTestDatabase();
const config=JSON.parse(await readFile(new URL('../../.local/radar-collections-calendar/config.json',import.meta.url),'utf8'));
Object.assign(process.env,{NODE_ENV:'production',APOGEE_LOCAL_PREVIEW:'1',APPLICATION_HOSTING_PROVIDER:'caddy',BETTER_AUTH_URL:'http://127.0.0.1:4381',BETTER_AUTH_SECRET:config.BETTER_AUTH_SECRET,
 MEMBERS_SUPERVISED_REGISTRATION_ENABLED:'true',RADAR_CALENDAR_PERSONAL_ENABLED:'true',RADAR_GOOGLE_CALENDAR_ENABLED:'true',RADAR_BILLING_ENABLED:'false',STRIPE_MODE:'test',
 GOOGLE_CALENDAR_CLIENT_ID:'synthetic-client',GOOGLE_CALENDAR_CLIENT_SECRET:'synthetic-secret',GOOGLE_CALENDAR_ENCRYPTION_KEY:'ad'.repeat(32),GOOGLE_CLIENT_ID:'',GOOGLE_CLIENT_SECRET:''});
const origin=process.env.BETTER_AUTH_URL,nonce=randomUUID().slice(0,8),password='Synthetic-password-'+nonce+'!';
const email='calendar-password-'+nonce+'@radar.test';
const created=[],mail=[],checks=[],deferred=[],providerCalendars=new Map();
let actorHeaders=new Headers(),db,auth,providerCalls=0,refreshExpired=false;
const originalFetch=global.fetch;
global.fetch=async(target,options={})=>{
 const url=new URL(target);providerCalls++;
 if(url.hostname==='oauth2.googleapis.com')return Response.json(refreshExpired?{error:'invalid_grant'}:{access_token:'synthetic-access',refresh_token:'synthetic-refresh',token_type:'Bearer',scope:'https://www.googleapis.com/auth/calendar.app.created'},{status:refreshExpired?400:200});
 assert.equal(url.hostname,'www.googleapis.com','Unmocked network is forbidden');
 const parts=url.pathname.split('/').filter(Boolean).map(decodeURIComponent),body=options.body?JSON.parse(options.body):null;
 assert.notEqual(parts[3],'primary');
 if(parts.length===3&&options.method==='POST'){const id='synthetic-calendar-'+providerCalendars.size;providerCalendars.set(id,new Map());return Response.json({id});}
 const events=providerCalendars.get(parts[3]);if(!events)return Response.json({},{status:404});
 if(parts.length===4)return Response.json({id:parts[3]});
 assert.equal(url.searchParams.get('sendUpdates'),'none');assert.equal(body.attendees,undefined);
 if(options.method==='PATCH'){
  if(!events.has(parts[5]))return Response.json({},{status:404});
  events.set(parts[5],{...events.get(parts[5]),...body});return Response.json({id:parts[5]});
 }
 assert.equal(options.method,'POST');assert.ok(!events.has(body.id));events.set(body.id,body);return Response.json({id:body.id});
};
const load=opportunityLoader({
 './db':{getDb:()=>db,getSql:()=>sql},'@/lib/members/db':{getDb:()=>db,getSql:()=>sql},
 'better-auth':betterAuthPackage,'better-auth/next-js':{nextCookies:()=>({id:'test-no-next-cookies'})},
 'next/headers':{headers:async()=>actorHeaders},'next/navigation':{redirect:href=>{throw Object.assign(Error('redirect'),{href});}},
 'next/cache':{revalidatePath:()=>{}},'next/server':{after:fn=>deferred.push(fn)},
 '@/lib/members/mail':{applicationOrigin:()=>origin,sendMemberMail:async message=>mail.push(message)},
 './mail':{applicationOrigin:()=>origin,sendMemberMail:async message=>mail.push(message)},
 './google-calendar-metrics':{measureGoogleCalendarSync:fn=>fn()},
 './radar-client':{listRadarOpportunities:async()=>catalogue},
});
const schema=load('lib/members/schema.ts');db=drizzle(sql,{schema});
const item={id:'radar-password-one',title:'Evento sintético de senha',organization:'QA local',kind:'Programa',level:'Público diverso',categories:['eventos'],location:'Brasil',summary:'Teste',eligibility:'Teste',officialUrl:'https://example.invalid/qa',deadline:'2099-01-12',verifiedAt:'2026-11-06',discovery:{editions:[{id:'qa',stages:[{id:'evento',name:'Realização',kind:'event',start:'2099-01-23',sourceUrl:'https://example.invalid',checkedAt:'2026-11-06'}]}]}};
const catalogue=[item,{...item,id:'radar-password-two',title:'Segundo evento sintético'}];
const call=async(path,body,cookie)=>auth.handler(new Request(origin+'/api/auth/'+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','x-apogee-client-ip':'198.51.100.224',...(cookie?{cookie}:{})},body:JSON.stringify(body)}));
const mark=name=>checks.push(name);
try{
 delete globalThis.__apogeeMembersAuth;
 auth=load('lib/members/auth.ts').getAuth();
 const registration=await call('sign-up/email',{name:'Teste Agenda',username:'agenda_senha_'+nonce,email,password,adultDeclared:true});
 assert.equal(registration.status,200,await registration.clone().text());
 const id=(await registration.json()).user.id;created.push(id);
 const login=await call('sign-in/email',{email,password});assert.equal(login.status,200,await login.clone().text());
 const cookie=login.headers.get('set-cookie').split(';')[0];actorHeaders=new Headers({cookie,Origin:origin});
 const initialAuth=await sql`select id,provider_id,password from account where user_id=${id}`;
 assert.equal(initialAuth.length,1);assert.equal(initialAuth[0].provider_id,'credential');assert.ok(initialAuth[0].password);
 assert.equal((await sql`select email_verified from "user" where id=${id}`)[0].email_verified,false);mark('real password registration and session without Google login');
 const protection=load('lib/members/protection.ts'),store=load('lib/opportunities/google-calendar-store.ts'),sync=load('lib/opportunities/google-calendar-sync.ts');
 const callsBefore=providerCalls;await assert.rejects(store.beginGoogleCalendarOAuth(id));assert.equal(providerCalls,callsBefore);mark('unverified password account cannot authorize Calendar');
 const verification=await call('send-verification-email',{email,callbackURL:origin+'/membros/protecao?next=%2Fmembros%2Fmeu-calendario%23google-calendar-heading'},cookie);
 assert.equal(verification.status,200,await verification.clone().text());assert.equal(mail.length,1);
 const link=mail[0].text.match(/http:\/\/\S+/)[0];
 const confirmed=await auth.handler(new Request(link,{headers:actorHeaders}));assert.ok([200,302,303].includes(confirmed.status));
 assert.equal((await sql`select email_verified from "user" where id=${id}`)[0].email_verified,true);mark('real one-time email verification through intercepted message');
 await protection.requestAdultReview(id,true);
 await assert.rejects(store.beginGoogleCalendarOAuth(id));mark('pending adult review cannot authorize Calendar');
 // QA fixtures only: no production review or paid entitlement is granted.
 await sql`update member_adult_review set status='approved',reviewed_at=now(),evidence_reference='FICTIONAL LOCAL PASSWORD CALENDAR QA' where user_id=${id}`;
 await sql`insert into radar_legacy_access(user_id) values(${id})`;
 assert.equal(await protection.calendarAdultAccess(id),true);
 const member=await load('lib/members/dal.ts').getMemberFromHeaders(actorHeaders);assert.equal(member.id,id);
 const save=load('app/membros/meu-calendario/actions.ts');
 assert.deepEqual(await save.saveOpportunityFromCard(item.id,true,'/calendarios/eventos'),{ok:true,saved:true});
 assert.equal(deferred.length,0);mark('save before connection stays in Apogee');
 const first=await store.beginGoogleCalendarOAuth(id);const firstUrl=new URL(first.url);
 assert.equal(firstUrl.searchParams.get('prompt'),'consent select_account');assert.equal(firstUrl.searchParams.get('access_type'),'offline');assert.equal(firstUrl.searchParams.get('login_hint'),null);
 assert.equal(firstUrl.searchParams.get('scope'),'https://www.googleapis.com/auth/calendar.app.created');mark('independent Calendar consent permits choosing Google account');
 await assert.rejects(store.completeGoogleCalendarOAuth(id,first.state,'ab'.repeat(32),'synthetic-code'));
 const outsider=await call('sign-up/email',{name:'Outra Conta',username:'outra_senha_'+nonce,email:'calendar-other-'+nonce+'@radar.test',password,adultDeclared:true});assert.equal(outsider.status,200);
 const other=(await outsider.json()).user.id;created.push(other);
 await sql`update "user" set email_verified=true where id=${other}`;
 await sql`insert into member_adult_review(user_id,status,reviewed_at,evidence_reference) values(${other},'approved',now(),'FICTIONAL LOCAL QA')`;
 await assert.rejects(store.completeGoogleCalendarOAuth(other,first.state,first.state,'synthetic-code'));mark('state mismatch and another session cannot steal connection');
 await sql`update radar_google_calendar_oauth set expires_at=now()-interval '1 second' where user_id=${id}`;
 await assert.rejects(store.completeGoogleCalendarOAuth(id,first.state,first.state,'synthetic-code'));mark('expired consent is refused');
 const current=await store.beginGoogleCalendarOAuth(id);await store.completeGoogleCalendarOAuth(id,current.state,current.state,'synthetic-code');
 await assert.rejects(store.completeGoogleCalendarOAuth(id,current.state,current.state,'synthetic-code'));mark('valid consent is consumed once');
 assert.equal(await sync.syncGoogleCalendar(id),'synced');
 let events=[...providerCalendars.values()][0];assert.ok([...events.values()].some(e=>e.summary.startsWith(item.title)));mark('first connection synchronizes earlier saved events');
 const count=events.size;assert.equal(await sync.syncGoogleCalendar(id),'synced');assert.equal(events.size,count);mark('repeat synchronization does not duplicate events');
 assert.deepEqual(await save.saveOpportunityFromCard(catalogue[1].id,true,'/membros/meu-calendario'),{ok:true,saved:true});
 assert.equal(deferred.length,1);await deferred.shift()();assert.ok([...events.values()].some(e=>e.summary.startsWith(catalogue[1].title)));mark('save after connection automatically synchronizes');
 assert.deepEqual(await sql`select id,provider_id,password from account where user_id=${id}`,initialAuth);
 assert.equal((await sql`select email from "user" where id=${id}`)[0].email,email);mark('password, email and login identities remain unchanged');
 assert.deepEqual(await save.saveOpportunityFromCard(item.id,false,'/membros/meu-calendario'),{ok:true,saved:false});await deferred.shift()();
 assert.ok([...events.values()].filter(e=>e.summary.startsWith(item.title)).every(e=>e.status==='cancelled'));mark('remove cancels only the selected saved event');
 const retainedId=(await sql`select calendar_id from radar_google_calendar where user_id=${id}`)[0].calendar_id;
 await store.disconnectGoogleCalendar(id);assert.equal((await store.googleCalendarStatus(id)).connected,false);assert.equal(await sync.syncGoogleCalendar(id),'disconnected');
 const relogin=await call('sign-in/email',{email,password});assert.equal(relogin.status,200);mark('disconnect stops synchronization and preserves password login');
 const again=await store.beginGoogleCalendarOAuth(id);await store.completeGoogleCalendarOAuth(id,again.state,again.state,'synthetic-code');assert.equal(await sync.syncGoogleCalendar(id),'synced');
 assert.equal((await sql`select calendar_id from radar_google_calendar where user_id=${id}`)[0].calendar_id,retainedId);assert.equal(providerCalendars.size,1);mark('reconnection reuses the existing Calendar');
 refreshExpired=true;assert.equal(await sync.syncGoogleCalendar(id),'failed');assert.equal((await store.googleCalendarStatus(id)).error,'reconnect');refreshExpired=false;mark('expired provider credential requests reconnection');
 await store.disconnectGoogleCalendar(id);
 console.log(JSON.stringify({passed:true,checks,provider:'simulated',externalMessages:0}));
}finally{
 global.fetch=originalFetch;delete globalThis.__apogeeMembersAuth;
 for(const id of created)await sql`delete from "user" where id=${id} and email like 'calendar-%@radar.test'`;
 await sql.end();
}
