import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRuntime, loadCredentials, publicStatus } from '../runtime.mjs';

const key='sk-synthetic_not_a_real_key_12345';
const env={RADAR_AI_ENABLED:'true',RADAR_AI_ORGANIZATION_ID:'org-synthetic123',RADAR_AI_PROJECT_ID:'proj_synthetic123',RADAR_AI_KEY_FILE:'/synthetic-key',RADAR_AI_DATABASE_URL_FILE:'/synthetic-db'};
const read=async path=>path===env.RADAR_AI_KEY_FILE?`OPENAI_API_KEY=${key}`:'postgresql://radar_ai_worker:synthetic@postgres/radar_test';

test('disabled worker reads no secrets, creates no database pool and cannot call the provider',async()=>{
  let calls=0;
  const runtime=await createRuntime({OPENAI_API_KEY:key},{readSecret:async()=>{calls++;throw Error();},pg:{Pool:class{constructor(){calls++;}}},fetchImpl:async()=>{calls++;}});
  assert.equal((await runtime.tick()).reason,'disabled');await runtime.close();assert.equal(calls,0);
});
test('dedicated files accept only one key and the restricted PostgreSQL role/host, with sanitized failures',async()=>{
  assert.equal((await loadCredentials(env,read)).projectId,env.RADAR_AI_PROJECT_ID);
  for(const bad of ['postgresql://postgres:secret@postgres/radar','postgresql://radar_ai_worker:secret@external/radar',
    'postgresql://radar_ai_worker:secret@postgres/radar?options=-csomething','postgresql://radar_ai_worker@postgres/radar']){
    await assert.rejects(loadCredentials(env,async p=>p===env.RADAR_AI_KEY_FILE?`OPENAI_API_KEY=${key}`:bad),e=>e.message==='credentials_unavailable');
  }
  for(const content of [`OPENAI_API_KEY=${key}\nOTHER=secret`,`OPENAI_API_KEY=${key}\nOPENAI_API_KEY=${key}`,'missing'])
    await assert.rejects(loadCredentials(env,async p=>p===env.RADAR_AI_KEY_FILE?content:await read(p)),/credentials_unavailable/);
});
test('secret reads reject symlinks and oversized files without exposing their contents',async()=>{
  const root=await mkdtemp(join(tmpdir(),'radar-ai-secret-test-'));
  const file=join(root,'key.env'),link=join(root,'link.env');
  await writeFile(file,`OPENAI_API_KEY=${key}`,{mode:0o600});await symlink(file,link);
  await assert.rejects(loadCredentials({...env,RADAR_AI_KEY_FILE:link}),/credentials_unavailable/);
  await writeFile(file,'x'.repeat(4097));
  await assert.rejects(loadCredentials({...env,RADAR_AI_KEY_FILE:file}),/credentials_unavailable/);
});
test('check never claims tasks or calls HTTP; a paused tick keeps all credentials out of health/log data',async()=>{
  const queries=[];let calls=0,ended=false;
  const pg={Pool:class{on(){} async query(sql){queries.push(sql);return {rows:[{result:sql.includes('recover')?0:sql.includes('claim_task')?{status:'blocked',reason:'operator_pause'}:{enabled:true,manual_paused:true}}]};}async end(){ended=true;}}};
  const runtime=await createRuntime(env,{readSecret:read,pg,fetchImpl:async()=>{calls++;}});
  assert.equal((await runtime.check()).reason,'operator_pause');assert.equal(queries.length,1);
  assert.equal((await runtime.tick()).reason,'operator_pause');assert.equal(calls,0);
  const status=publicStatus({mode:'BASE',reason:'operator_pause',apiKey:key,proposal:{text:key}});
  assert.doesNotMatch(JSON.stringify(status),/sk-|postgresql|proposal/);
  await runtime.close();assert.equal(ended,true);
});
