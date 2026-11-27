// Real Better Auth and a new, owned PostgreSQL. All outbound email is intercepted.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {drizzle} from 'drizzle-orm/postgres-js';
import * as betterAuthPackage from 'better-auth';
import {drizzleAdapter} from 'better-auth/adapters/drizzle';
import {username} from 'better-auth/plugins';
import {nativeCommunityDatabase} from './helpers/community-native-db.mjs';
import {opportunityLoader} from './helpers/load-opportunity-module.mjs';

test('isolated signup, email verification, recovery, session revocation and logout',async t=>{
  const db=await nativeCommunityDatabase(),originalFetch=globalThis.fetch,emails=[],pending=[];
  const origin='http://127.0.0.1:35439';
  Object.assign(process.env,{BETTER_AUTH_URL:origin,BETTER_AUTH_SECRET:'synthetic-auth-journey-secret-at-least-32',MEMBERS_EMAIL_ENABLED:'true',MEMBERS_RESEND_DOMAIN_VERIFIED:'true',MEMBERS_RESEND_API_KEY:'re_synthetic_no_network_key',MEMBERS_RESEND_FROM:'contato@apogee.community',MEMBERS_SUPERVISED_REGISTRATION_ENABLED:'true',RADAR_BILLING_ENABLED:'false',MCP_ENABLED:'false'});
  globalThis.fetch=async(url,options)=>{
    assert.equal(url,'https://api.resend.com/emails','No network is allowed in this test.');
    const mail=JSON.parse(options.body);assert.deepEqual(mail.to,['authjourney@example.test']);
    emails.push(mail);return Response.json({id:'intercepted-'+emails.length});
  };
  try{
    let orm;
    const load=opportunityLoader({'./db':{getSql:()=>db.sql,getDb:()=>orm},'@/lib/members/db':{getSql:()=>db.sql,getDb:()=>orm},'better-auth':betterAuthPackage,'better-auth/adapters/drizzle':{drizzleAdapter},'better-auth/plugins':{username},'better-auth/next-js':{nextCookies:()=>({id:'test-no-next-cookies'})},'next/server':{after:fn=>pending.push(fn)}});
    const schema=load('lib/members/schema.ts');orm=drizzle(db.sql,{schema});
    const auth=load('lib/members/auth.ts').getAuth();
    const headers=cookie=>({Origin:origin,'Content-Type':'application/json',...(cookie?{cookie}:{})});
    const call=(path,body,cookie)=>auth.handler(new Request(origin+'/api/auth/'+path,{method:'POST',headers:headers(cookie),body:JSON.stringify(body)}));
    const drain=async()=>{while(pending.length)await pending.shift()();};
    const signup={email:'authjourney@example.test',name:'Pessoa Sintética',username:'authjourney',password:'SyntheticInitial2026!',role:'admin',emailVerified:true};
    let cookie,userId,unknownAcknowledgement;
    await t.test('real registration without an age declaration and no client promotion',async()=>{
      const r=await call('sign-up/email',signup);assert.equal(r.status,200);userId=(await r.json()).user.id;cookie=r.headers.get('set-cookie').split(';')[0];
      const [row]=await db.sql`select role,email_verified,adult_declared from "user" where id=${userId}`;
      assert.equal(row.role,'member');assert.equal(row.email_verified,false);assert.equal(row.adult_declared,false);assert.equal(emails.length,0);
    });
    await t.test('verification uses the trusted origin, correct recipient and no privilege change',async()=>{
      const summary = '/membros/assinatura?next=' + encodeURIComponent('/membros/ferramentas?categoria=video');
      const callback = origin + '/membros/protecao?next=' + encodeURIComponent(summary);
      assert.equal((await call('send-verification-email',{email:signup.email,callbackURL:callback},cookie)).status,200);
      assert.match(emails.at(-1).subject,/Confirme/);
      const link=new URL(emails.at(-1).text.match(/http:\/\/\S+/)[0]);assert.equal(link.origin,origin);
      const r=await auth.handler(new Request(link,{headers:{cookie}}));assert.equal(r.status,302);
      assert.equal(new URL(r.headers.get('location'),origin).href,callback);
      const [row]=await db.sql`select role,email_verified from "user" where id=${userId}`;assert.equal(row.role,'member');assert.equal(row.email_verified,true);
    });
    await t.test('recovery rejects foreign destinations and gives unknown accounts the same acknowledgement',async()=>{
      assert.equal((await call('request-password-reset',{email:signup.email,redirectTo:'https://example.org/membros/redefinir-senha'})).status,403);
      const count=emails.length;
      const r=await call('request-password-reset',{email:'unknown@example.test',redirectTo:origin+'/membros/redefinir-senha'});assert.equal(r.status,200);unknownAcknowledgement=await r.json();await drain();assert.equal(emails.length,count);
    });
    async function resetToken(){
      const r=await call('request-password-reset',{email:signup.email,redirectTo:origin+'/membros/redefinir-senha?next=%2Fmembros%2Fbeneficios'});assert.equal(r.status,200);assert.deepEqual(await r.json(),unknownAcknowledgement);await drain();
      assert.match(emails.at(-1).subject,/Redefina/);
      const link=new URL(emails.at(-1).text.match(/http:\/\/\S+/)[0]);assert.equal(link.origin,origin);
      const response=await auth.handler(new Request(link));assert.equal(response.status,302);
      const target=new URL(response.headers.get('location'));assert.equal(target.origin,origin);assert.equal(target.pathname,'/membros/redefinir-senha');assert.equal(target.searchParams.get('next'),'/membros/beneficios');
      const token=target.searchParams.get('token');assert.ok(token);
      const rows=await db.sql`select identifier,value from verification`;assert.ok(!JSON.stringify(rows).includes(token),'Reset token is hashed at rest.');return token;
    }
    await t.test('expired reset is rejected without changing the password',async()=>{
      const token=await resetToken();await db.sql`update verification set expires_at=now()-interval '1 minute'`;
      assert.notEqual((await call('reset-password',{token,newPassword:'SyntheticUpdated2026!'})).status,200);
    });
    await t.test('successful reset revokes old sessions and token replay; new login and logout persist',async()=>{
      const token=await resetToken();assert.equal((await call('reset-password',{token,newPassword:'SyntheticUpdated2026!'})).status,200);
      assert.notEqual((await call('reset-password',{token,newPassword:'SyntheticReplay2026!'})).status,200);
      const oldSession=await auth.handler(new Request(origin+'/api/auth/get-session',{headers:{cookie}}));assert.equal(await oldSession.json(),null);
      assert.notEqual((await call('sign-in/email',{email:signup.email,password:signup.password})).status,200);
      const login=await call('sign-in/email',{email:signup.email,password:'SyntheticUpdated2026!'});assert.equal(login.status,200);const fresh=login.headers.get('set-cookie').split(';')[0];
      assert.equal((await call('sign-out',{},fresh)).status,200);
      const ended=await auth.handler(new Request(origin+'/api/auth/get-session',{headers:{cookie:fresh}}));assert.equal(await ended.json(),null);
    });
  }finally{globalThis.fetch=originalFetch;await db.close();}
});
