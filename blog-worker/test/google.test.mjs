import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,mkdir,realpath,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {defaultPolicy,candidate,article} from './fixtures.mjs';
import {validatePolicy,validateSubscription,subscriptionUsage} from '../src/policy.mjs';
import {buildRequest} from '../src/editorial.mjs';
import {cleanEnvironment,googleSubscriptionProvider,readGeneratedImage,googlePrompt,parseArticleOutput} from '../src/google-provider.mjs';
import {decide} from '../src/google-hook.mjs';
const p={...defaultPolicy,google_account_email:"blog-owner@example.test",generation_enabled:true,automatic_image_generation_enabled:true};
const usage={input_tokens:1000,output_tokens:500,thinking_tokens:200,cache_read_tokens:100,total_tokens:1500};
const quota={code:0,stdout:JSON.stringify({status:'SUCCESS',num_turns:0,command:{name:'usage',data:{groups:[{name:'Gemini Models',buckets:[{remaining_fraction:1}]}]}}})};
test('Google policy enforces zero additional billing, own account and bounded workload',()=>{
  validatePolicy(p);
  for(const change of [{google_use_g1_credits:true},{gemini_api_enabled:true},{paid_balance_fallback_enabled:true},{google_daily_calls_cap:31},{per_topic_daily_cap:2},{google_account_email:'invalid'},{model_id:'claude-opus'},{daily_budget_micro_usd_cap:1}])assert.throws(()=>validatePolicy({...p,...change}));
  assert.equal(subscriptionUsage(usage),1800);
  assert.throws(()=>subscriptionUsage({input_tokens:1}),/missing/);
  assert.throws(()=>validateSubscription({account_email:p.google_account_email,plan:'google_ai_pro'}),/unverified/);
  assert.deepEqual(cleanEnvironment({PATH:'/bin',HOME:'/home/test',OPENAI_API_KEY:'secret',GEMINI_API_KEY:'secret',AGY_ADC_AUTH:'true',GOOGLE_APPLICATION_CREDENTIALS:'/key',DATABASE_URL:'secret'}),{PATH:'/bin',HOME:'/home/test'});
});
test('official CLI pins binary/settings, checks quota without generation and returns structured text once',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'google-fixture-')),binary=join(dir,'agy');await writeFile(binary,'fake');
  let calls=0;
  const provider=googleSubscriptionProvider({binary,sha256:createHash('sha256').update('fake').digest('hex'),runner:async(_,args,o)=>{
    calls++;const settings=JSON.parse(args[1]);assert.equal(settings.useG1Credits,false);assert.equal(settings.modelProvider,'');assert.ok(!o.env.OPENAI_API_KEY);
    if(args.at(-1)==='/usage')return quota;
    assert.equal(args.includes('--dangerously-skip-permissions'),false);assert.ok(args.includes(p.model_id));
    assert.equal(args[args.indexOf('--agent')+1],'apogee-editor');
    const hooks=JSON.parse(await readFile(join(o.cwd,'policy.json'),'utf8'));assert.equal(hooks.maxInvocations,1);
    assert.equal(o.timeoutMs,45000);assert.equal(await realpath(o.cwd),o.cwd);
    const definition=await readFile(join(o.cwd,'.agents/agents/apogee-editor.md'),'utf8');assert.match(definition,/excludeDefaultComponents: true/);assert.match(definition,/tools: \[\]/);
    await writeFile(join(o.cwd,'invocation-0.json'),'{}');
    assert.equal(args.includes('--json-schema'),false);
    return {code:0,stdout:JSON.stringify({status:'SUCCESS',response:JSON.stringify(article),usage})};
  }});
  await provider.preflight();const r={policy:p,body:buildRequest(candidate(),p),not_after:new Date(Date.now()+180000).toISOString()};
  assert.equal((await provider(r)).text,JSON.stringify(article));assert.equal(calls,2);
  await writeFile(binary,'changed');assert.equal((await provider(r)).reason,'google_client_changed');assert.equal(calls,2);
});
test('compact Google dossier removes bookkeeping without changing original evidence',()=>{
  const body=buildRequest(candidate(),p),before=JSON.stringify(body),prompt=googlePrompt({policy:p,body});
  assert.ok(Buffer.byteLength(prompt)<Buffer.byteLength(JSON.stringify(body)));
  assert.equal(prompt.includes('rights_reference'),false);assert.equal(prompt.includes('content_hash'),false);
  for(const e of JSON.parse(body.input).evidence)assert.ok(prompt.includes(e.text));
  assert.equal(JSON.stringify(body),before);assert.match(prompt,/acentuação correta/);
  assert.deepEqual(parseArticleOutput({response:'```json\n'+JSON.stringify(article)+'\n```'}),article);
  assert.throws(()=>parseArticleOutput({response:'Commentary\n'+JSON.stringify(article)}));
});
test('low quota preserves 20 percent headroom before any generation',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'google-low-quota-')),binary=join(dir,'agy');await writeFile(binary,'fake');
  let calls=0;const provider=googleSubscriptionProvider({binary,sha256:createHash('sha256').update('fake').digest('hex'),runner:async()=>{
    calls++;const q=JSON.parse(quota.stdout);q.command.data.groups[0].buckets[0].remaining_fraction=0.19;return {code:0,stdout:JSON.stringify(q)};
  }});
  await assert.rejects(()=>provider.preflight(),/google_quota_low/);assert.equal(calls,1);
});
test('quota exhaustion blocks before generating; timeout has no fallback or automatic retry',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'google-fixture-')),binary=join(dir,'agy');await writeFile(binary,'fake');
  let calls=0;const provider=googleSubscriptionProvider({binary,sha256:createHash('sha256').update('fake').digest('hex'),runner:async(_,args)=>{
    calls++;if(args.at(-1)==='/usage'){const q=JSON.parse(quota.stdout);q.command.data.groups[0].buckets[0].remaining_fraction=0;return {code:0,stdout:JSON.stringify(q)};}
    return {code:null,reason:'google_timeout',stdout:''};
  }});
  await assert.rejects(()=>provider.preflight(),/google_quota_exhausted/);assert.equal(calls,1);
  const r=await provider({policy:p,body:buildRequest(candidate(),p),not_after:new Date(Date.now()+180000).toISOString()});
  assert.equal(r.outcome,'unknown');assert.equal(r.reason,'google_timeout');assert.equal(calls,2);
});
test('image run selects one restricted main agent and never delegates parallel subagents',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'google-image-agent-')),binary=join(dir,'agy');await writeFile(binary,'fake');
  const conversationId='12345678-1234-1234-1234-123456789012';let calls=0;
  const provider=googleSubscriptionProvider({binary,sha256:createHash('sha256').update('fake').digest('hex'),imageReader:async()=>Buffer.from('decoded fixture'),runner:async(_,args,o)=>{
    calls++;assert.equal(args[args.indexOf('--agent')+1],'apogee-cover');
    const definition=await readFile(join(o.cwd,'.agents/agents/apogee-cover.md'),'utf8');
    assert.match(definition,/subagent: false/);assert.match(definition,/excludeDefaultComponents: true/);assert.match(definition,/tools:\n  - generate_image/);
    assert.equal(JSON.parse(await readFile(join(o.cwd,'policy.json'),'utf8')).maxInvocations,1);
    await writeFile(join(o.cwd,'apogee_cover_123456.jpg'),'fixture');
    await writeFile(join(o.cwd,'invocation-0.json'),'{}');await writeFile(join(o.cwd,'image-call.json'),JSON.stringify({conversationId,artifactDirectoryPath:o.cwd}));
    return {code:3,stdout:JSON.stringify({status:'ERROR',error:'Editorial invocation limit',conversation_id:conversationId,usage})};
  }});
  assert.equal((await provider({kind:'image',policy:p,body:{prompt:'Approved image'},not_after:new Date(Date.now()+180000).toISOString()})).outcome,'completed');assert.equal(calls,1);
});
test('hooks deny prompt-injected tools, cap model invocations and permit only one fixed image',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'google-hook-')),config={model:p.model_id,kind:'image',prompt:'Approved brief',maxInvocations:3};
  const payload={modelName:p.model_id,invocationNum:3};
  assert.equal((await decide('invocation',payload,config,dir)).terminationBehavior,'terminate');
  assert.equal((await decide('tool',{...payload,toolCall:{name:'run_command'}},config,dir)).decision,'deny');
  const image={...payload,toolCall:{name:'generate_image',args:{Prompt:'untrusted',ImagePaths:['/secret']}}};
  const allowed=await decide('tool',image,config,dir);assert.equal(allowed.decision,'auto_approve');assert.deepEqual(allowed.overwrite.ImagePaths,[]);assert.equal(allowed.overwrite.Prompt,'Approved brief');
  assert.equal((await decide('tool',image,config,dir)).decision,'deny');
  assert.equal((await decide('tool',{...payload,toolCall:{name:'finish',args:{image_path:'/result.png'}}},config,dir)).decision,'auto_approve');
  assert.equal((await decide('tool',{...payload,toolCall:{name:'finish',args:{CommandLine:'cat /secret'}}},config,dir)).decision,'deny');
});
test('generated image path cannot escape official artifacts or read credentials',async()=>{
  await assert.rejects(()=>readGeneratedImage({path:'/etc/passwd',conversationId:'bad'}),/google_image_path/);
});
test('real image artifact is decoded, normalized and symlink inputs remain denied',async()=>{
  const home=await realpath(await mkdtemp(join(tmpdir(),'google-artifact-'))),conversationId='12345678-1234-1234-1234-123456789012';
  const folder=join(home,'.gemini/antigravity-cli/brain',conversationId);await mkdir(folder,{recursive:true});
  const sharp=(await import('sharp')).default,path=join(folder,'cover.png');
  await sharp({create:{width:64,height:64,channels:3,background:'#123456'}}).png().toFile(path);
  const opts={path,conversationId,artifactDirectoryPath:folder,startedAt:Date.now()-1000,workdir:home,home};
  const bytes=await readGeneratedImage(opts),meta=await sharp(bytes).metadata();
  assert.equal(meta.format,'webp');assert.equal(meta.width,1536);assert.equal(meta.height,1024);
  const linked=join(folder,'linked.png');await symlink(path,linked);await assert.rejects(()=>readGeneratedImage({...opts,path:linked}),/google_image_path/);
});
test('automatic access diagnostic has zero model/tool permissions and reuses its fresh quota once',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'google-access-check-')),binary=join(dir,'agy');await writeFile(binary,'fake');
  let calls=0;const fingerprint=createHash('sha256').update('fake').digest('hex');
  const data={status:'SUCCESS',num_turns:0,usage:{input_tokens:0,output_tokens:0},command:{name:'usage',data:{groups:[{name:'Gemini Models',buckets:[
    {window:'weekly',remaining_fraction:0.9,reset_time:new Date(Date.now()+86400000).toISOString()},
    {window:'5h',remaining_fraction:0.8,reset_time:new Date(Date.now()+3600000).toISOString()}]}]}}};
  const provider=googleSubscriptionProvider({binary,sha256:fingerprint,runner:async(_,args,options)=>{
    calls++;assert.equal(args.at(-1),'/usage');assert.equal(JSON.parse(args[1]).useG1Credits,false);
    const guard=JSON.parse(await readFile(join(options.cwd,'policy.json'),'utf8'));assert.equal(guard.kind,'diagnostic');assert.equal(guard.maxInvocations,0);
    assert.equal((await decide('invocation',{modelName:'anything',invocationNum:0},guard,options.cwd)).terminationBehavior,'terminate');
    assert.equal((await decide('tool',{toolCall:{name:'finish',args:{}}},guard,options.cwd)).decision,'deny');
    return {code:0,stdout:JSON.stringify(data)};
  }});
  const receipt=await provider.verifyAccess();assert.equal(receipt.model_tokens,0);assert.equal(receipt.num_turns,0);assert.equal(receipt.client_sha256,fingerprint);
  await provider.preflight();assert.equal(calls,1,'hourly check supplies the immediate preflight');
  data.num_turns=1;await assert.rejects(()=>provider.verifyAccess(),/google_quota_unavailable/);
  data.num_turns=0;data.usage.input_tokens=1;await assert.rejects(()=>provider.verifyAccess(),/google_quota_unavailable/);
  data.usage.input_tokens=0;data.command.data.groups[0].buckets[1].window='unknown';await assert.rejects(()=>provider.verifyAccess(),/google_quota_unavailable/);
});
