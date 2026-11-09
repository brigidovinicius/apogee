import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {actualUsageCost,validatePolicy,validateGrant,selectPrice,cycleCap,usageCost,periodKeys,hash} from '../src/policy.mjs';
import {canonicalUrl,normalizeItem,validateArticle,cacheKey,buildRequest} from '../src/editorial.mjs';
import {publicIPv4,allowedUrl,getFeed,boundedJson,retryAfterSeconds} from '../src/http.mjs';
import {collect,tick,loadConfig} from '../src/worker.mjs';
import {openAIProvider} from '../src/provider.mjs';
import {defaultPolicy,policy,source,grant,price,candidate,article,reservation,identity} from './fixtures.mjs';

test('shipped configuration keeps every source, price and generation disabled',async()=>{
  const config=await loadConfig(new URL('../config/',import.meta.url));
  assert.equal(config.policy.generation_enabled,false);assert.equal(config.policy.model_id,'gemini-3.8-flash-low');
  assert.equal(config.sources.filter(s=>s.enabled).length,0);assert.equal(config.catalog.filter(p=>p.approved).length,0);
  const result=await tick({store:{recover:async()=>0,maintenance:async()=>({capture_allowed:true}),claimSource:()=>assert.fail('no collection'),reserve:()=>assert.fail('no reservation')},config,
    provider:()=>assert.fail('no provider')});
  assert.equal(result.generation.reason,'generation_disabled');
});
test('byte-bound excerpting preserves original evidence and complete opening sentences',()=>{
  const c=candidate(),original=('This is a complete institutional evidence sentence with a bounded factual claim. ').repeat(100).trim();
  c.evidence[0].text=original;c.evidence[0].content_hash=hash(original);c.evidence_hash=hash(c.evidence);
  const p={...policy,input_counting_mode:'local_byte_bound'},body=buildRequest(c,p),sent=JSON.parse(body.input).evidence[0];
  assert.ok(Buffer.byteLength(JSON.stringify(body))+1024<=p.input_tokens_cap_including_overhead);
  assert.equal(sent.excerpted,true);assert.ok(sent.text.endsWith('.'));assert.ok(original.startsWith(sent.text));
  assert.equal(sent.content_hash,hash(sent.text));assert.equal(c.evidence[0].text,original);
  assert.deepEqual(buildRequest(c,p),body);
});
test('policy rejects paid paths, Codex, model drift and increased ceilings',()=>{
  validatePolicy(defaultPolicy);
  for(const change of [{paid_balance_fallback_enabled:true},{codex_subscription_execution_enabled:true},{gemini_api_enabled:true},
    {automatic_image_generation_enabled:true,image_model_id:"unapproved"},{automatic_video_generation_enabled:true},{paid_web_search_enabled:true},
    {concurrency:2},{article_budget_micro_usd_cap_including_all_attempts:50001},{model_id:'gpt-codex-2026-11-01'},{model_id:'gpt-test'}])
    assert.throws(()=>validatePolicy({...policy,...change}));
});
test('integer costs round upward and cycle is min(5 dollars, 10 percent of actual grant)',()=>{
  assert.equal(cycleCap(policy,grant()),1600000);assert.equal(cycleCap(policy,{...grant(),amount_micro_usd:100000000}),5000000);
  assert.equal(usageCost({...price(),input_micro_usd_per_million:250000,output_micro_usd_per_million:2000000},1,1),3);
  assert.throws(()=>usageCost(price(),NaN,1));assert.throws(()=>usageCost(price(),1,-1));
});
test('offers, wrong scope, expired grants and paid billing never open a budget',()=>{
  const at=new Date();validateGrant(grant(at),at,identity);
  for(const change of [{state:'offered'},{project_id:'other'},{no_paid_balance:false},{no_auto_recharge:false},{no_paid_billing:false},
    {dedicated_project:false},{expires_at:at.toISOString()},{verified_at:new Date(+at-86400001).toISOString()}])
    assert.throws(()=>validateGrant({...grant(at),...change},at,identity));
  assert.throws(()=>selectPrice([],policy,at));assert.throws(()=>selectPrice([{...price(at),approved:false}],policy,at));
  assert.throws(()=>selectPrice([price(at)],defaultPolicy,at));
});
test('Brasilia day and Monday week boundaries are stable',()=>{
  assert.deepEqual(periodKeys(new Date('2026-11-09T02:59:59Z')),{day:'2026-11-08',week:'2026-11-02'});
  assert.deepEqual(periodKeys(new Date('2026-11-09T03:00:00Z')),{day:'2026-11-09',week:'2026-11-09'});
});
test('evidence hashes survive JSONB key order and cache changes only with context versions',()=>{
  assert.equal(hash({a:1,b:{c:2,d:3}}),hash({b:{d:3,c:2},a:1}));
  const c=candidate();assert.equal(cacheKey(c,policy),cacheKey(structuredClone(c),policy));
  assert.notEqual(cacheKey(c,policy),cacheKey(c,{...policy,policy_id:'changed'}));
});
test('canonical URL dedup removes tracking but keeps meaningful query parameters',()=>{
  assert.equal(canonicalUrl('https://example.org/a?utm_source=x&q=a#fragment',['example.org']),'https://example.org/a?q=a');
  assert.throws(()=>allowedUrl('https://example.org@127.0.0.1/a',['example.org']));
  assert.throws(()=>allowedUrl('http://example.org/a',['example.org']));
  assert.throws(()=>allowedUrl('https://example.org:8080/a',['example.org']));
});
test('SSRF blocks private, reserved, metadata and DNS rebinding destinations before request',async()=>{
  for(const ip of ['127.0.0.1','10.1.2.3','169.254.169.254','172.16.1.1','192.168.1.1','100.64.0.1','198.18.0.1','::1'])assert.equal(publicIPv4(ip),false);
  assert.equal(publicIPv4('8.8.8.8'),true);
  assert.equal(publicIPv4('192.0.66.108'),true); // WordPress VIP is public, unlike 192.0.0/24 and TEST-NET-1.
  assert.equal(publicIPv4('192.0.2.1'),false);
  assert.equal(publicIPv4('192.2.1.1'),true);
  await assert.rejects(()=>getFeed(source.url,source.article_hosts,{resolve:async()=>[{address:'127.0.0.1'}],request:()=>assert.fail('no request')}),/private_address/);
});
test('new feed items require recent dates, allowed URLs, matching filters and explicit evidence rights',()=>{
  const at=new Date(),item={title:'Useful research',link:'https://example.org/a',isoDate:at.toISOString(),contentSnippet:'x'.repeat(210)};
  assert.equal(normalizeItem({...item,isoDate:'bad'},source,at),null);
  assert.equal(normalizeItem({...item,link:'https://evil.test/a'},source,at),null);
  assert.equal(normalizeItem(item,{...source,keywords:['absent']},at),null);
  const c=normalizeItem(item,{...source,feed_content_approved:false},at);assert.equal(c.status,'discovered');assert.deepEqual(c.evidence,[]);
});
test('RSS collector parses, bounds, deduplicates and rejects XML declarations without any model',async()=>{
  const item=`<item><title>Research update</title><link>https://example.org/a?utm_source=rss</link><guid>one</guid><pubDate>${new Date().toUTCString()}</pubDate><description>${'Bounded research evidence. '.repeat(12)}</description></item>`;
  const xml=`<rss version="2.0"><channel><title>Test</title>${item}${item}</channel></rss>`;
  const seen=new Set(),states=[];
  const store={claimSource:async()=>({}),sourceResult:async(_,s)=>states.push(s),ingest:async c=>{if(seen.has(c.id))return 'duplicate';seen.add(c.id);return 'created';}};
  const result=await collect({store,sources:[source],download:async()=>({body:xml})});
  assert.deepEqual(result,{sources:1,created:1,duplicate:1,failed:0});
  assert.equal((await collect({store,sources:[source],download:async()=>({body:'<!DOCTYPE rss>'+xml})})).failed,1);
  assert.equal(states.at(-1),'feed_error');
});
test('structured drafts require evidence, reject copied text, unsupported numbers and active markup',()=>{
  validateArticle(article,candidate().evidence);
  assert.throws(()=>validateArticle({...article,title:'Invented result 9999'},candidate().evidence),/unsupported_numbers/);
  const bad=structuredClone(article);bad.paragraphs[0].sourceIds=['E9'];assert.throws(()=>validateArticle(bad,candidate().evidence),/invalid_references/);
  const copied=structuredClone(article);copied.paragraphs[0].text=candidate().evidence[0].text;assert.throws(()=>validateArticle(copied,candidate().evidence),/copied_passage/);
  assert.throws(()=>validateArticle({...article,title:'<script>alert(1)</script>'},candidate().evidence));
});
test('Brazilian decimal commas preserve sourced values in prose and SEO without accepting changed values',()=>{
  const evidence=structuredClone(candidate().evidence);
  evidence[0].text+=' The maximum potential award is $264.3 million and the secondary figure is 12.75.';
  const output=structuredClone(article);
  output.paragraphs[0].text='O valor potencial informado para o contrato chega a 264,3 milhões, enquanto a outra medida registrada corresponde a 12,75.';
  output.seoTitle='Contrato com valor potencial de 264,3 milhões';
  validateArticle(output,evidence);
  const changed=structuredClone(output);changed.paragraphs[0].text=changed.paragraphs[0].text.replace('264,3','264,4');
  assert.throws(()=>validateArticle(changed,evidence),/unsupported_numbers/);
  assert.throws(()=>validateArticle({...output,seoTitle:'Contrato com valor potencial de 264,4 milhões'},evidence),/unsupported_numbers/);
});
test('ambiguous three-digit separators and grouping are never equated automatically',()=>{
  const evidence=structuredClone(candidate().evidence);evidence[0].text+=' The recorded figure is 1.000.';
  const output=structuredClone(article);output.paragraphs[0].text='A medida registrada no documento corresponde a 1,000 e ainda depende de revisão editorial do contexto.';
  assert.throws(()=>validateArticle(output,evidence),/unsupported_numbers/);
});
const jsonResponse=data=>new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}});
const apiKey='sk-synthetic-not-a-real-key';
test('provider uses only Responses, counts full input and limits ALL output, including reasoning',async()=>{
  const calls=[];
  const provider=openAIProvider({apiKey,identity,fetcher:async(url,options)=>{
    calls.push({url,options});
    if(url.endsWith('/input_tokens'))return jsonResponse({input_tokens:7000});
    return jsonResponse({status:'completed',model:policy.model_id,service_tier:'default',usage:{input_tokens:7000,output_tokens:1900,total_tokens:8900,input_tokens_details:{cached_tokens:0,cache_write_tokens:0},output_tokens_details:{reasoning_tokens:500}},
      output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(article)}]}]});
  }});
  const output=await provider(reservation());assert.equal(output.outcome,'completed');assert.equal(calls.length,2);
  for(const call of calls){assert.ok(call.url.startsWith('https://api.openai.com/v1/responses'));assert.equal(call.options.redirect,'error');}
  const request=JSON.parse(calls[1].options.body);assert.equal(request.max_output_tokens,2000);assert.deepEqual(request.tools,[]);assert.equal(request.store,false);
  assert.equal(calls[1].options.headers['OpenAI-Project'],identity.project_id);
});
test('oversized counted input never reaches generation',async()=>{
  let calls=0;const provider=openAIProvider({apiKey,identity,fetcher:async()=>{calls++;return jsonResponse({input_tokens:8001});}});
  assert.deepEqual(await provider(reservation()),{outcome:'not_sent',reason:'input_limit'});assert.equal(calls,1);
});
test('timeouts and provider errors are uncertain and never retried',async()=>{
  let calls=0;const provider=openAIProvider({apiKey,identity,fetcher:async url=>{calls++;if(url.endsWith('input_tokens'))return jsonResponse({input_tokens:10});throw Error('secret body must not leak');}});
  assert.deepEqual(await provider(reservation()),{outcome:'unknown'});assert.equal(calls,2);
});
test('expired reservation cannot dispatch after process suspension',async()=>{
  const provider=openAIProvider({apiKey,identity,fetcher:()=>assert.fail('no HTTP')});
  assert.equal((await provider({...reservation(),not_after:new Date().toISOString()})).reason,'reservation_expired');
});
test('response readers reject oversized bodies',async()=>{
  await assert.rejects(()=>boundedJson(new Response('x'.repeat(100)),10),/response_size/);
});
test('source Retry-After is honored but cannot grow unbounded',()=>{
  assert.equal(retryAfterSeconds('3600'),3600);assert.equal(retryAfterSeconds('99999999999'),604800);assert.equal(retryAfterSeconds('invalid'),0);
  assert.equal(retryAfterSeconds('Fri, 06 Nov 2026 15:00:00 GMT',Date.parse('2026-11-06T14:00:00Z')),3600);
});
test('namespace storage cap pauses capture independently from generation',async()=>{
  const config={policy:defaultPolicy,sources:[source],catalog:[]};
  const store={recover:async()=>0,maintenance:async()=>({capture_allowed:false}),claimSource:()=>assert.fail('no capture')};
  assert.equal((await tick({store,config})).collection.reason,'storage_cap');
});
test('production image and default config contain no key or authenticated Codex command',async()=>{
  const docker=await readFile(new URL('../Dockerfile',import.meta.url),'utf8');assert.ok(!docker.includes('.env'));
  assert.equal(JSON.parse(await readFile(new URL('../config/prices.json',import.meta.url),'utf8')).filter(p=>p.approved).length,0);
});
test('cache writes are reserved at the highest input price and reconciled by usage class',()=>{
  const rates={...price(),input_micro_usd_per_million:100000,cached_input_micro_usd_per_million:10000,cache_write_micro_usd_per_million:125000,output_micro_usd_per_million:500000};
  assert.equal(usageCost(rates,8000,2000),2000);
  assert.equal(actualUsageCost(rates,{input_tokens:8000,output_tokens:2000,total_tokens:10000,input_tokens_details:{cached_tokens:0,cache_write_tokens:8000}}),2000);
  assert.equal(actualUsageCost(rates,{input_tokens:8000,output_tokens:2000,total_tokens:10000,input_tokens_details:{cached_tokens:8000,cache_write_tokens:0}}),1080);
  assert.throws(()=>actualUsageCost(rates,{input_tokens:8000,output_tokens:2000,total_tokens:10000}),/invalid_usage/);
  assert.throws(()=>actualUsageCost(rates,{input_tokens:1,output_tokens:0,total_tokens:1,input_tokens_details:{cached_tokens:1,cache_write_tokens:1}}),/invalid_usage/);
});
test('a changed response model or processing tier is treated as an unknown charge',async()=>{
  for(const changed of [{model:'unexpected'},{service_tier:'priority'}]){
    const provider=openAIProvider({apiKey,identity,fetcher:async url=>url.endsWith('input_tokens')?jsonResponse({input_tokens:10}):jsonResponse({model:policy.model_id,service_tier:'default',...changed})});
    assert.deepEqual(await provider(reservation()),{outcome:'unknown'});
  }
});
