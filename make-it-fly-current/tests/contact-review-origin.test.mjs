import assert from 'node:assert/strict';
import {test} from 'node:test';
import {opportunityLoader} from './helpers/load-opportunity-module.mjs';

for(const route of ['app/api/comunidade/contatos/route.ts','app/api/loja/novidades/route.ts'])test(route+': explicit local origin never broadens production',async()=>{
  const saved={...process.env};
  const capture=async(_request,deps)=>Response.json(deps.allowedOrigins);
  const load=opportunityLoader({'@/lib/members/db':{getSql:()=>{throw Error('No database access in origin test.');}},'@/lib/members/rate-limit':{consumeRateLimit:async()=>true},'@/lib/community/contacts':{handleCommunityContact:capture},'@/lib/store/drop-signups':{handleDropSignup:capture}});
  const api=load(route),request=new Request('http://localhost:3472/api/test');
  const origins=async()=>await(await api.POST(request)).json();
  try{
    Object.assign(process.env,{NODE_ENV:'development',APOGEE_FUNCTIONAL_REVIEW:'1',APOGEE_STRIPE_SANDBOX_REVIEW:'0',STRIPE_MODE:'test',BETTER_AUTH_URL:'http://127.0.0.1:3472',DATABASE_URL:'postgres://synthetic@127.0.0.1:55439/postgres'});
    assert.ok((await origins()).includes('http://127.0.0.1:3472'));
    process.env.NODE_ENV='production';assert.deepEqual(await origins(),['https://www.apogee.community','https://apogee.community']);
    process.env.NODE_ENV='development';process.env.APOGEE_FUNCTIONAL_REVIEW='0';assert.ok(!(await origins()).includes('http://127.0.0.1:3472'));
    process.env.APOGEE_FUNCTIONAL_REVIEW='1';process.env.DATABASE_URL='postgres://synthetic@database.invalid/postgres';assert.ok(!(await origins()).includes('http://127.0.0.1:3472'));
  }finally{for(const key of Object.keys(process.env))if(!(key in saved))delete process.env[key];Object.assign(process.env,saved);}
});
