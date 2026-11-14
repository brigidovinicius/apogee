// Own temporary PostgreSQL cluster only. Never reads DATABASE_URL, .env or an API key.
// Run via the global npm queue; BLOG_TEST_PG_BIN must point to existing native PostgreSQL tools.
import assert from 'node:assert/strict';
import {mkdtemp,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:net';
import {spawnSync} from 'node:child_process';
import postgres from 'postgres';
import {normalizeItem,cmsDraft} from '../src/editorial.mjs';
import {Store,migrate} from '../src/store.mjs';
import {tick} from '../src/worker.mjs';
import {openAIProvider} from '../src/provider.mjs';
import {loadCms} from './cms-harness.mjs';
import {dossierFixture} from './corroboration-fixture.mjs';
import {assessDossier,dossierHash} from '../src/corroboration.mjs';
import {hash,periodKeys} from '../src/policy.mjs';
import {TOPICS,topicKey} from '../src/automatic-research.mjs';
import {articleSource,referenceForUrl,ARTICLE_EXTRACTION_VERSION} from '../src/article-research.mjs';
import {explainerCatalog,explainerId} from '../src/explainers.mjs';
import {identity,policy,source,grant,price,candidate,completed,imagePolicy,imagePrice,imageUsage,webpFixture} from './fixtures.mjs';

const bin=process.env.BLOG_TEST_PG_BIN;if(!bin)throw Error('Set BLOG_TEST_PG_BIN to native PostgreSQL binaries; no existing DB is accepted.');
const directory=await mkdtemp(join(tmpdir(),'apogee-blog-test-'));
const data=join(directory,'data');
const free=createServer();await new Promise(resolve=>free.listen(0,'127.0.0.1',resolve));
const port=free.address().port;await new Promise(resolve=>free.close(resolve));
function pg(command,args){const result=spawnSync(join(bin,command),args,{encoding:'utf8',timeout:60000});if(result.status!==0)throw Error(command+' failed: '+result.stderr);}
pg('initdb',['-D',data,'-A','trust','-U','blog_test','--no-locale','-E','UTF8']);
let started=false,admin,runtime,other,cmsClient,editorClient,passed=0;
try{
  pg('pg_ctl',['-D',data,'-l',join(directory,'postgres.log'),'-o',`-h 127.0.0.1 -p ${port} -k ${directory} -c shared_buffers=16MB -c max_connections=12 -c fsync=off`,'-w','start']);started=true;
  const connection={host:'127.0.0.1',port,database:'postgres',username:'blog_test',ssl:false,max:2,prepare:false,onnotice:()=>{}};
  admin=postgres(connection);
  // Actual checked-in CMS DDL, only inside our newly-created temporary cluster.
  for(const file of ['0000_init.sql','0002_rapid_queen_noir.sql'])
    await admin.unsafe(await readFile(new URL('../../make-it-fly-current/drizzle/'+file,import.meta.url),'utf8'));
  // Drizzle customizes postgres-js type parsers. Keep the CMS client independent of worker/admin clients.
  cmsClient=postgres(connection);const cms=loadCms(cmsClient);
  await admin`insert into public."user"(id,name,email) values('test-editor','Synthetic Editor','editor@example.test')`;
  assert.equal(await migrate(admin),'applied');assert.equal(await migrate(admin),'already_applied');
  await admin.unsafe(`CREATE ROLE blog_runtime LOGIN;
    GRANT USAGE ON SCHEMA blog_worker TO blog_runtime;
    GRANT SELECT ON ALL TABLES IN SCHEMA blog_worker TO blog_runtime;
    GRANT INSERT,UPDATE ON blog_worker.candidate,blog_worker.attempt,blog_worker.source_state,blog_worker.control,blog_worker.image_job,blog_worker.source_catalog,blog_worker.command,blog_worker.captured_document,blog_worker.quota_observation TO blog_runtime;
    GRANT DELETE ON blog_worker.candidate,blog_worker.captured_document,blog_worker.quota_observation TO blog_runtime;
    GRANT USAGE ON SEQUENCE blog_worker.quota_observation_id_seq TO blog_runtime;
    GRANT EXECUTE ON FUNCTION blog_worker.claim_google_access(text,text),blog_worker.settle_google_access(uuid,jsonb),blog_worker.prepare_automatic_research(text,jsonb,text),blog_worker.record_assisted_comparison(text,uuid,jsonb,jsonb),blog_worker.import_draft(text,jsonb),blog_worker.queue_cover(text,text,text,text),blog_worker.import_cover(text,text) TO blog_runtime;`);
  await admin.unsafe(`CREATE ROLE blog_editor LOGIN;
    GRANT USAGE ON SCHEMA public,blog_worker TO blog_editor;
    GRANT SELECT ON ALL TABLES IN SCHEMA blog_worker TO blog_editor;
    GRANT SELECT ON public.blog_post,public.blog_media TO blog_editor;
    GRANT UPDATE ON public.blog_post TO blog_editor;
    GRANT INSERT ON blog_worker.dossier_version,blog_worker.post_review,blog_worker.operator_event,blog_worker.command,blog_worker.candidate TO blog_editor;
    GRANT UPDATE ON blog_worker.control,blog_worker.candidate TO blog_editor;
    GRANT USAGE ON SEQUENCE blog_worker.operator_event_id_seq,blog_worker.post_review_id_seq TO blog_editor;`);
  editorClient=postgres({...connection,username:'blog_editor'});
  runtime=postgres({...connection,username:'blog_runtime'});other=postgres({...connection,username:'blog_runtime'});
  const store=new Store(runtime),second=new Store(other),operator=new Store(admin);
  async function reset(){
    await admin.unsafe('TRUNCATE blog_worker.google_access,blog_worker.subscription,blog_worker.source_catalog,blog_worker.command,blog_worker.operator_event,blog_worker.attempt,blog_worker.candidate,blog_worker.benefit,blog_worker.source_state,public.blog_post_event,public.blog_post RESTART IDENTITY CASCADE');
    await admin`update blog_worker.control set paused=false,reason=null`;
  }
  async function setup({benefit=grant(),items=[candidate()]}={}){await reset();await operator.attestGrant(benefit,identity);for(const c of items)await store.ingest(c);}
  const options=(overrides={})=>({policy,catalog:[price()],identity,sources:[source],...overrides});
  async function check(name,run){await run();passed++;console.log('PASS '+name);}

  await check('new marketing and startup references are available to research without runtime registry-write privileges',async()=>{
    const rows=await runtime`select id,definition from blog_worker.research_reference where id in ('ARTICLE_REF45','ARTICLE_REF46','ARTICLE_REF47') order by id`;
    assert.deepEqual(rows.map(r=>r.id),['ARTICLE_REF45','ARTICLE_REF46','ARTICLE_REF47']);
    assert.ok(rows.every(r=>r.definition.enabled&&r.definition.content_approved&&r.definition.rights_reference.includes('sem reprodução integral')));
    const [privileges]=await runtime`select has_table_privilege(current_user,'blog_worker.research_reference','SELECT') as read,has_table_privilege(current_user,'blog_worker.research_reference','UPDATE') as write`;
    assert.deepEqual(privileges,{read:true,write:false});
    assert.equal((await admin`select max(version)::int as version from blog_worker.migration`)[0].version,12);
    assert.ok((await runtime`select definition from blog_worker.research_reference where id='ARTICLE_PRIMARY_MICROSOFT_EDUCATION'`)[0].definition.article_hosts.includes('support.microsoft.com'));
  });
  await check('runtime cannot alter benefits or publish directly',async()=>{
    await assert.rejects(()=>runtime`insert into blog_worker.benefit(id) values('forged')`,/permission denied/);
    await assert.rejects(()=>runtime`update public.blog_post set status='published'`,/permission denied/);
  });
  await check('disabled, ungranted, unpriced and unapproved source paths make zero requests',async()=>{
    await reset();await store.ingest(candidate());
    await assert.rejects(()=>store.reserve(options()),/benefit_unverified/);
    await operator.attestGrant(grant(),identity);
    await assert.rejects(()=>store.reserve(options({catalog:[]})),/price_missing/);
    await assert.rejects(()=>store.reserve(options({policy:{...policy,generation_enabled:false}})),/generation_disabled/);
    await assert.rejects(()=>store.reserve(options({sources:[{...source,enabled:false}]})),/no_approved_sources/);
    assert.equal((await admin`select count(*)::int as count from blog_worker.attempt`)[0].count,0);
  });
  await check('only one concurrent reservation and remaining grant cannot be double-spent',async()=>{
    await setup({benefit:{...grant(),remaining_micro_usd:16000},items:[candidate(1),candidate(2)]});
    const results=await Promise.allSettled([store.reserve(options()),second.reserve(options())]);
    assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
    assert.equal(results.filter(x=>x.status==='rejected').length,1);
    assert.equal((await admin`select sum(reserved_micro_usd)::int as amount from blog_worker.attempt`)[0].amount,16000);
  });
  await check('one private CMS draft, atomic settlement and idempotent recollection',async()=>{
    await setup();const r=await store.reserve(options()),done=await store.finish(r,completed);assert.equal(done.status,'draft');assert.equal(done.charged_micro_usd,3000);
    const [post]=await admin`select * from public.blog_post`;assert.equal(post.status,'draft');assert.equal(post.scheduled_at,null);assert.equal(post.published_at,null);assert.equal(post.seo_noindex,true);
    assert.ok(post.body.includes('https://example.org/research/1'));
    assert.equal(await store.ingest(candidate()),'duplicate');assert.equal((await store.reserve(options())).status,'idle');
    await assert.rejects(()=>store.finish(r,completed),/stale_completion/);
    assert.equal((await admin`select count(*)::int as count from public.blog_post`)[0].count,1);
    assert.equal((await admin`select count(*)::int as count from public.blog_post_event`)[0].count,1);
  });
  await check('unknown timeout holds money, pauses globally and refuses automatic retry',async()=>{
    await setup();const r=await store.reserve(options());assert.equal((await store.finish(r,{outcome:'unknown'})).status,'held');
    await assert.rejects(()=>second.reserve(options()),/paused/);
    await assert.rejects(()=>operator.resume(),/request_pending/);
    const [a]=await admin`select * from blog_worker.attempt`;assert.equal(a.state,'unknown');assert.equal(Number(a.reserved_micro_usd),16000);assert.equal(a.charged_micro_usd,null);
    await operator.reconcile({attempt_id:r.id,charged_micro_usd:16000,verification_reference:'fixture-provider-cost-record'});
    assert.equal((await store.summary()).control.paused,true);await operator.resume();
    assert.equal((await store.reserve(options())).status,'idle'); // held candidate is never auto-requeued
  });
  await check('cache classes settle the ledger using the price frozen in the reservation',async()=>{
    await setup();const tariff={...price(),cache_write_micro_usd_per_million:1250000};
    const r=await store.reserve(options({catalog:[tariff]}));
    assert.equal(Number((await admin`select reserved_micro_usd from blog_worker.attempt`)[0].reserved_micro_usd),18000);
    const result=await store.finish(r,{...completed,usage:{input_tokens:1000,output_tokens:500,total_tokens:1500,
      input_tokens_details:{cached_tokens:300,cache_write_tokens:300}}});
    assert.equal(result.status,'draft');assert.equal(result.charged_micro_usd,2805);
    assert.equal(Number((await admin`select charged_micro_usd from blog_worker.attempt`)[0].charged_micro_usd),2805);
  });
  await check('missing cache usage holds the full reservation and creates no draft',async()=>{
    await setup();const r=await store.reserve(options());const usage={...completed.usage};delete usage.input_tokens_details;
    assert.equal((await store.finish(r,{...completed,usage})).status,'held');
    const [a]=await admin`select * from blog_worker.attempt`;
    assert.equal(a.state,'unknown');assert.equal(a.charged_micro_usd,null);assert.equal(Number(a.reserved_micro_usd),16000);
    assert.equal((await admin`select count(*)::int as count from public.blog_post`)[0].count,0);
    await assert.rejects(()=>operator.resume(),/request_pending/);

  });
  await check('crash recovery fences late responses and retains the reservation across instances',async()=>{
    await setup();const r=await store.reserve(options());await admin`update blog_worker.attempt set created_at=now()-interval '6 minutes' where id=${r.id}`;
    assert.equal(await second.recover(),1);await assert.rejects(()=>store.finish(r,completed),/stale_completion/);
    assert.equal((await second.summary()).usage.held_micro_usd,'16000');
    assert.equal((await admin`select count(*)::int as count from public.blog_post`)[0].count,0);
  });
  await check('one syntax repair uses the same article budget and never creates a third attempt',async()=>{
    await setup();const invalid={...completed,text:'{'};
    const first=await store.reserve(options());assert.equal((await store.finish(first,invalid)).status,'repair_pending');
    const repair=await store.reserve(options());assert.ok(repair.body.instructions.includes('tentativa anterior'));
    assert.equal((await store.finish(repair,invalid)).status,'held');
    assert.equal((await store.reserve(options())).status,'idle');
    assert.equal((await admin`select count(*)::int as count from blog_worker.attempt`)[0].count,2);
  });
  await check('repair exceeding the shared article ceiling is refused before dispatch',async()=>{
    await setup();const limited={...policy,article_budget_micro_usd_cap_including_all_attempts:17000};
    const first=await store.reserve(options({policy:limited}));await store.finish(first,{...completed,text:'{'});
    await assert.rejects(()=>store.reserve(options({policy:limited})),/article_budget/);
    assert.equal((await admin`select count(*)::int as count from blog_worker.attempt`)[0].count,1);
  });
  await check('day and week frequencies count first reservations, including invalid outputs',async()=>{
    await setup({items:[candidate(1),candidate(2)]});const r=await store.reserve(options());await store.finish(r,{outcome:'not_sent',reason:'input_limit'});
    await assert.rejects(()=>store.reserve(options()),/draft_frequency/);
    await reset();await operator.attestGrant(grant(),identity);
    const {day,week}=periodKeys(new Date());
    for(let i=1;i<=5;i++){await store.ingest(candidate(i));await admin`update blog_worker.candidate set status='held',first_attempt_day=${day}::date-1,first_attempt_week=${week}::date where id=${candidate(i).id}`;}
    await store.ingest(candidate(6));await assert.rejects(()=>store.reserve(options()),/draft_frequency/);
  });
  await check('daily and cycle spend cannot be reset by retries or refreshed balance attestations',async()=>{
    const g=grant();await setup({benefit:g});const r=await store.reserve(options());await store.finish(r,{...completed,text:'{'});
    await assert.rejects(()=>store.reserve(options({policy:{...policy,daily_budget_micro_usd_cap:17000}})),/daily_budget/);
    await operator.attestGrant({...g,verified_at:new Date().toISOString()},identity);
    await assert.rejects(()=>store.reserve(options({policy:{...policy,cycle_budget_micro_usd_cap:17000}})),/cycle_budget/);
    await assert.rejects(()=>operator.attestGrant({...g,provider_grant_id:'another-grant'},identity),/overlapping_cycle/);
  });
  await check('expired and revoked benefits stop dispatch without touching balances',async()=>{
    await setup();await admin`update blog_worker.benefit set expires_at=now()-interval '1 minute'`;
    await assert.rejects(()=>store.reserve(options()),/benefit_unverified/);
    assert.equal((await admin`select count(*)::int as count from blog_worker.attempt`)[0].count,0);
    await setup();await admin`update blog_worker.benefit set revoked_at=now()`;await assert.rejects(()=>store.reserve(options()),/benefit_unverified/);
  });
  await check('usage outside reservation trips circuit and never imports',async()=>{
    await setup();const r=await store.reserve(options());const out={...completed,usage:{input_tokens:9000,output_tokens:2000,total_tokens:11000,input_tokens_details:{cached_tokens:0,cache_write_tokens:0}}};
    assert.equal((await store.finish(r,out)).reason,'usage_exceeded_reservation');await assert.rejects(()=>operator.resume(),/usage_exceeded_reservation/);
    assert.equal((await admin`select count(*)::int as count from public.blog_post`)[0].count,0);
  });
  await check('material source change after reservation holds the result for review',async()=>{
    await setup();const r=await store.reserve(options());const changed=candidate();changed.evidence[0].text+=' Updated evidence.';changed.evidence[0].content_hash=hash(changed.evidence[0].text);changed.evidence_hash=hash(changed.evidence);
    await store.ingest(changed);assert.equal((await store.finish(r,completed)).reason,'evidence_changed');
    assert.equal((await admin`select count(*)::int as count from public.blog_post`)[0].count,0);
  });
  await check('all five editorias receive fair initial selection',async()=>{
    const editorias=['ia','startups','ciencia-espaco','tecnologia','oportunidades'];
    await setup({items:editorias.map((e,i)=>candidate(i+1,e))});const selected=[];
    for(let i=0;i<5;i++){
      // Simulate distinct days while retaining the fair-selection history; no additional provider calls.
      await admin`update blog_worker.candidate set first_attempt_day=null,first_attempt_week=null where status='draft'`;
      const r=await store.reserve(options());selected.push(r.candidate.editoria);assert.equal((await store.finish(r,completed)).status,'draft');
    }
    assert.deepEqual(new Set(selected),new Set(editorias));
  });
  await check('full tick collects RSS without provider and exposes blocked generation honestly',async()=>{
    await reset();let calls=0;
    const config={policy:{...policy,generation_enabled:false},sources:[source],catalog:[]};
    const text=`<rss version="2.0"><channel><title>Fixture</title><item><title>Fresh research</title><link>https://example.org/full</link><pubDate>${new Date().toUTCString()}</pubDate><description>${candidate().evidence[0].text}</description></item></channel></rss>`;
    const result=await tick({store,config,identity,provider:()=>assert.fail('no generation'),download:async()=>{calls++;return {body:text};}});
    assert.equal(result.collection.created,1);assert.equal(result.generation.reason,'generation_disabled');
    await tick({store,config,identity,download:()=>assert.fail('source interval respected')});assert.equal(calls,1);
  });
  await check('source failures persist Retry-After and exponential backoff without blocking other sources',async()=>{
    await reset();await store.claimSource(source);await store.sourceResult(source.id,'feed_error',{retryAfter:7200});
    const [s]=await admin`select failures,next_due_at>now()+interval '119 minutes' as delayed from blog_worker.source_state`;
    assert.equal(s.failures,1);assert.equal(s.delayed,true);assert.equal(await second.claimSource(source),null);
    assert.ok(await second.claimSource({...source,id:'OTHER'}));
  });
  await check('retention clears only disposable evidence and preserves draft provenance',async()=>{
    await setup({items:[candidate(1),candidate(2),candidate(3)]});const r=await store.reserve(options());await store.finish(r,completed);
    const draft=r.candidate.id;
    await admin`update blog_worker.candidate set created_at=now()-interval '181 days' where id=${draft}`;
    const others=(await admin`select id from blog_worker.candidate where id<>${draft} order by id`).map(x=>x.id);
    await admin`update blog_worker.candidate set created_at=now()-interval '31 days' where id=${others[0]}`;
    await admin`update blog_worker.candidate set created_at=now()-interval '181 days' where id=${others[1]}`;
    assert.equal((await store.maintenance()).capture_allowed,true);
    const rows=await admin`select id,evidence from blog_worker.candidate`;
    assert.equal(rows.length,2);assert.equal(rows.find(x=>x.id===draft).evidence.length,1);assert.equal(rows.find(x=>x.id===others[0]).evidence.length,0);
  });
  const feedXml=()=>{
    const item=`<item><title>Synthetic research for complete flow</title><link>https://example.org/complete?utm_source=test</link><guid>complete-flow</guid><pubDate>${new Date().toUTCString()}</pubDate><description>${candidate().evidence[0].text}</description></item>`;
    return `<rss version="2.0"><channel><title>Synthetic feed</title>${item}${item}</channel></rss>`;
  };
  const response=body=>new Response(JSON.stringify(body),{headers:{'Content-Type':'application/json'}});
  const completion=(text=completed.text)=>({model:policy.model_id,service_tier:'default',status:'completed',usage:completed.usage,
    output:[{type:'message',content:[{type:'output_text',text}]}]});
  const fullConfig=()=>({policy,sources:[source],catalog:[price()]});
  await check('retention preserves full snapshots referenced by any immutable dossier version',async()=>{
    await reset();await store.ingest(candidate());await store.ingest(candidate(2));
    const rows=await admin`select id,candidate_id from blog_worker.captured_document order by candidate_id`;
    assert.equal(rows.length,2);const referenced=rows[0];const document=dossierFixture(1);document.documents[0].capture_id=referenced.id;
    await admin`insert into blog_worker.dossier_version(candidate_id,revision,document,document_hash,assessment,actor_id,source_hash,change_reason) values(${referenced.candidate_id},1,${admin.json(document)},${dossierHash(document)},${admin.json(assessDossier(document))},'test-editor','synthetic-snapshot-hash','Keep the original source supporting editorial history')`;
    await admin`update blog_worker.captured_document set captured_at=now()-interval '31 days'`;
    await store.maintenance();
    const remaining=await admin`select id from blog_worker.captured_document`;assert.deepEqual(remaining.map(r=>r.id),[referenced.id]);
  });
  await check('RSS to real adapter to durable private CMS draft, public queries and cached recollection',async()=>{
    await reset();await operator.attestGrant(grant(),identity);const calls=[];
    const provider=openAIProvider({apiKey:'sk-synthetic-not-a-real-key',identity,fetcher:async(url,request)=>{
      const [pending]=await admin`select state,reserved_micro_usd from blog_worker.attempt`;
      assert.equal(pending.state,'reserved');assert.equal(Number(pending.reserved_micro_usd),16000);
      const payload=JSON.parse(request.body);calls.push({url,payload});
      assert.equal(payload.model,policy.model_id);assert.deepEqual(payload.tools,[]);
      assert.equal(request.headers['OpenAI-Project'],identity.project_id);
      return response(url.endsWith('/input_tokens')?{input_tokens:1000}:completion());
    }});
    const config=fullConfig();
    const result=await tick({store,config,identity,provider,download:async()=>({body:feedXml(),etag:'"fixture-v1"'})});
    assert.deepEqual(result.collection,{sources:1,created:1,duplicate:1,failed:0});assert.equal(result.generation.status,'draft');
    assert.equal(calls.length,2);assert.ok(calls[0].url.endsWith('/input_tokens'));assert.ok(calls[1].url.endsWith('/responses'));
    const [c]=await admin`select * from blog_worker.candidate`;assert.equal(c.url,'https://example.org/complete');assert.equal(c.artifact.human_review_required,true);
    const post=await cms.getAdminPost(result.generation.post_id);
    assert.equal(post.status,'draft');assert.equal(post.seoNoIndex,true);assert.equal(post.revision,1);assert.equal(post.scheduledAt,null);assert.equal(post.publishedAt,null);
    assert.equal((await cms.listAdminPosts(1)).total,1);assert.equal(await cms.getPublicPost(post.slug),null);
    assert.equal((await cms.listPublicPosts(null,1)).total,0);assert.deepEqual(await cms.listPublicPostUrls(),[]);
    assert.equal((await cms.listPostEvents(post.id))[0].action,'automated_draft_requires_review');
    assert.equal((await store.summary()).usage.charged_micro_usd,'3000');
    await admin`update blog_worker.source_state set next_due_at=now()-interval '1 second'`;
    const replay=await tick({store,config,identity,provider:()=>assert.fail('draft must never regenerate'),download:async(_url,_hosts,headers)=>{
      assert.equal(headers.etag,'"fixture-v1"');return {notModified:true};
    }});
    assert.equal(replay.generation.status,'idle');assert.equal((await cms.listAdminPosts(1)).total,1);
  });
  await check('CMS review, media privacy, stale edit, scheduling, publication and withdrawal use actual data functions',async()=>{
    await setup();const done=await store.finish(await store.reserve(options()),completed);let post=await cms.getAdminPost(done.post_id);
    const media=Buffer.from([0,1,2,3]);
    await cms.createPostMedia({id:'synthetic-media',postId:post.id,alt:'Imagem sintética de teste',caption:'Fixture sem ativo externo',width:1,height:1,image:media});
    assert.equal(await cms.getPostMediaImage('synthetic-media',false),null);
    assert.deepEqual(await cms.getPostMediaImage('synthetic-media',true),media);
    const edit=(intent,extra={})=>({id:post.id,revision:post.revision,slug:post.slug,title:post.title,excerpt:post.excerpt,body:post.body,
      category:post.category,featured:false,seoTitle:post.seoTitle,seoDescription:post.seoDescription,focusKeyword:null,
      seoNoIndex:true,coverMediaId:'synthetic-media',videoUrl:null,intent,scheduledAt:null,actorId:'test-editor',actorName:'Synthetic Editor',...extra});
    const stale=edit('save');assert.notEqual(await cms.savePost(edit('save')),'conflict');
    assert.equal(await cms.savePost(stale),'conflict');post=await cms.getAdminPost(post.id);
    await cms.savePost(edit('schedule',{scheduledAt:new Date(Date.now()+3600000)}));post=await cms.getAdminPost(post.id);
    assert.equal(post.status,'scheduled');assert.equal(await cms.getPublicPost(post.slug),null);
    await cms.savePost(edit('publish',{seoNoIndex:false}));post=await cms.getAdminPost(post.id);
    assert.equal((await cms.getPublicPost(post.slug)).id,post.id);assert.equal((await cms.listPublicPosts(post.category,1)).total,1);
    assert.equal((await cms.listPublicPostUrls()).length,1);assert.deepEqual(await cms.getPostMediaImage('synthetic-media',false),media);
    await cms.savePost(edit('unpublish'));post=await cms.getAdminPost(post.id);
    assert.equal(await cms.getPublicPost(post.slug),null);assert.equal(await cms.getPostMediaImage('synthetic-media',false),null);
    assert.deepEqual(await cms.listPublicPostUrls(),[]);
    await cms.savePost(edit('archive'));assert.equal((await cms.getAdminPost(post.id)).status,'archived');
    assert.deepEqual((await cms.listPostEvents(post.id)).map(e=>e.action),['archive','unpublish','publish','schedule','editado','automated_draft_requires_review']);
    await assert.rejects(()=>runtime`update public.blog_post set status='published',published_at=now()`,/permission denied/);
  });
  await check('one invalid response is repaired through the adapter and charged within the same article',async()=>{
    await reset();await operator.attestGrant(grant(),identity);let generates=0,counts=0;
    const provider=openAIProvider({apiKey:'sk-synthetic-not-a-real-key',identity,fetcher:async(url,request)=>{
      if(url.endsWith('/input_tokens')){counts++;return response({input_tokens:1000});}
      generates++;if(generates===2)assert.ok(JSON.parse(request.body).instructions.includes('tentativa anterior'));
      return response(completion(generates===1?'{':completed.text));
    }});
    const config=fullConfig(),run=()=>tick({store,config,identity,provider,download:async()=>({body:feedXml()})});
    assert.equal((await run()).generation.status,'repair_pending');assert.equal((await run()).generation.status,'draft');
    assert.equal((await run()).generation.status,'idle');assert.equal(counts,2);assert.equal(generates,2);
    assert.equal((await store.summary()).usage.charged_micro_usd,'6000');assert.equal((await cms.listAdminPosts(1)).total,1);
  });
  await check('adapter timeout pauses subsequent ticks without releasing the charge or sending again',async()=>{
    await reset();await operator.attestGrant(grant(),identity);let calls=0;
    const provider=openAIProvider({apiKey:'sk-synthetic-not-a-real-key',identity,fetcher:async url=>{
      calls++;if(url.endsWith('/input_tokens'))return response({input_tokens:1000});throw Error('simulated timeout');
    }});
    const config=fullConfig(),run=()=>tick({store,config,identity,provider,download:async()=>({body:feedXml()})});
    assert.equal((await run()).generation.reason,'unknown_charge');assert.equal((await run()).generation.reason,'paused');
    assert.equal(calls,2);assert.equal((await store.summary()).usage.held_micro_usd,'16000');assert.equal((await cms.listAdminPosts(1)).total,0);
  });
  await check('CMS insert failure rolls back settlement and crash recovery does not regenerate',async()=>{
    await setup();const r=await store.reserve(options()),slug=cmsDraft(r.candidate,JSON.parse(completed.text)).slug;
    await admin`insert into public.blog_post(slug,title,excerpt,body,category,author_name) values(${slug},'Existing fixture','Fixture excerpt','Fixture body','estudos','Synthetic Editor')`;
    await assert.rejects(()=>store.finish(r,completed),e=>e.code==='23505');
    const [a]=await admin`select state,charged_micro_usd from blog_worker.attempt`;assert.equal(a.state,'reserved');assert.equal(a.charged_micro_usd,null);
    assert.equal((await admin`select post_id from blog_worker.candidate`)[0].post_id,null);
    await admin`update blog_worker.attempt set created_at=now()-interval '6 minutes'`;
    assert.equal(await store.recover(),1);await assert.rejects(()=>store.reserve(options()),/paused/);
  });
  const economical=()=>({...price(),input_micro_usd_per_million:100000,cached_input_micro_usd_per_million:10000,cache_write_micro_usd_per_million:125000,output_micro_usd_per_million:500000});
  const imageOptions=()=>options({policy:imagePolicy,catalog:[economical(),imagePrice()]});
  async function textThenImage(){await setup();const r=await store.reserve(imageOptions());await store.finish(r,completed);return store.reserveImage(imageOptions());}
  await check('image shares article ledger, attaches privately and never regenerates completed cover',async()=>{
    const r=await textThenImage();assert.equal(r.reserved_micro_usd,47120);
    const done=await store.finish(r,{outcome:'completed',image:webpFixture(),usage:imageUsage});assert.equal(done.status,'cover_ready');
    const post=await cms.getAdminPost(done.post_id);assert.equal(post.coverMediaId,done.media_id);assert.equal(post.revision,2);
    assert.equal((await store.summary()).usage.charged_micro_usd,'42260');
    assert.equal(await cms.getPostMediaImage(done.media_id,false),null);assert.ok(await cms.getPostMediaImage(done.media_id,true));
    assert.equal((await store.reserveImage(imageOptions())).status,'idle');assert.equal(await cms.getPublicPost(post.slug),null);
    await assert.rejects(()=>store.finish(r,{outcome:'unknown'}),/stale_completion/);
    const [{id}]=await admin`select blog_worker.import_cover(${r.candidate_id},'unused') as id`;assert.equal(id,done.media_id);
  });
  await check('standard price correction preserves previous charge in audit and is idempotent',async()=>{
    const r=await textThenImage();await store.finish(r,{outcome:'completed',image:webpFixture(),usage:imageUsage});
    const legacy={...imagePrice(),billing_mode:'batch',input_micro_usd_per_million:2500000,output_micro_usd_per_million:15000000};
    await admin`update blog_worker.attempt set price=${admin.json(legacy)},charged_micro_usd=20955 where id=${r.id}`;
    const record={attempt_id:r.id,price:imagePrice(),verification_reference:'Verified official standard rates; original usage retained'};
    assert.equal((await operator.correctImagePrice(record)).charged_micro_usd,41910);
    assert.equal((await operator.correctImagePrice(record)).status,'already_corrected');
    const events=await admin`select detail from blog_worker.operator_event where action='image_price_corrected'`;
    assert.equal(events.length,1);assert.equal(events[0].detail.previous_charged_micro_usd,20955);
    await assert.rejects(()=>operator.correctImagePrice({...record,price:legacy}),/image_price_unapproved/);
    await assert.rejects(()=>operator.correctImagePrice({...record,price:{...record.price,output_micro_usd_per_million:1000000}}),/cannot_reduce_charge/);
    await operator.correctImagePrice({...record,price:{...record.price,output_micro_usd_per_million:40000000}});
    assert.equal((await store.summary()).control.paused,true);
    await assert.rejects(()=>operator.resume(),/usage_exceeded_reservation/);
  });
  await check('image budget includes all text repairs and refuses dispatch when total cannot fit',async()=>{
    await setup();const o=imageOptions();o.policy={...imagePolicy,article_budget_micro_usd_cap_including_all_attempts:47400};
    const r=await store.reserve(o);await store.finish(r,completed);await assert.rejects(()=>store.reserveImage(o),/article_budget/);
    assert.equal((await store.summary()).usage.attempts,1);
  });
  await check('image timeout keeps full reservation and pauses without retry or losing the draft',async()=>{
    const r=await textThenImage();const done=await store.finish(r,{outcome:'unknown'});assert.equal(done.reason,'unknown_image_charge');
    assert.equal((await store.summary()).usage.held_micro_usd,'47120');assert.equal((await cms.listAdminPosts()).total,1);
    await assert.rejects(()=>store.reserveImage(imageOptions()),/paused/);await assert.rejects(()=>operator.resume(),/request_pending/);
  });
  await check('invalid image is charged once and cannot be attached or automatically retried',async()=>{
    const r=await textThenImage();const done=await store.finish(r,{outcome:'completed',image:Buffer.from('bad'),usage:imageUsage});
    assert.equal(done.reason,'invalid_image');assert.equal(done.charged_micro_usd,41910);
    assert.equal((await admin`select count(*)::int as n from public.blog_media`)[0].n,0);
    assert.equal((await store.reserveImage(imageOptions())).status,'idle');
  });
  await check('concurrent editing retains generated cover for explicit review and cannot overwrite published content',async()=>{
    const r=await textThenImage();await admin`update public.blog_post set title='Manual editor correction',revision=revision+1`;
    const done=await store.finish(r,{outcome:'completed',image:webpFixture(),usage:imageUsage});assert.equal(done.status,'cover_review');
    const [post]=await admin`select * from public.blog_post`;assert.equal(post.cover_media_id,null);assert.equal(post.title,'Manual editor correction');
    const pipeline=loadCms(cmsClient,'lib/blog/pipeline.ts');
    assert.equal(await pipeline.applyReviewedCover('test-editor',r.candidate_id,1),false);
    assert.equal(await pipeline.applyReviewedCover('test-editor',r.candidate_id,post.revision),true);
    assert.ok((await admin`select cover_media_id from public.blog_post`)[0].cover_media_id);
    assert.equal((await store.summary()).usage.attempts,2);
    await textThenImage();await admin`update public.blog_post set status='published',published_at=now()`;
    const [last]=await admin`select id from blog_worker.attempt where kind='image'`;
    const result=await store.finish({...r,id:last.id},{outcome:'completed',image:webpFixture(),usage:imageUsage});assert.equal(result.status,'cover_review');
    assert.equal(await pipeline.applyReviewedCover('test-editor',(await admin`select id from blog_worker.candidate`)[0].id,1),false);
  });
  await check('admin source changes persist, commands deduplicate and manual mode makes no unsolicited generation',async()=>{
    await setup();const pipeline=loadCms(cmsClient,'lib/blog/pipeline.ts');
    const config={policy:{...imagePolicy,operator_commands_only:true},sources:[source],catalog:[economical(),imagePrice()]};
    await store.syncPipeline(config,identity);
    assert.equal(await pipeline.savePipelineSource('test-editor',{...source,enabled:false},1),true);
    assert.equal(await pipeline.savePipelineSource('test-editor',source,1),false);
    assert.equal((await store.syncPipeline(config,identity))[0].enabled,false);
    assert.equal(await pipeline.savePipelineSource('test-editor',source,2),true);
    let requests=0;const provider=async r=>{requests++;return r.kind==='image'?{outcome:'completed',image:webpFixture(),usage:imageUsage}:completed;};
    const run=()=>tick({store,config,identity,provider,download:async()=>({notModified:true})});
    assert.equal((await run()).generation.reason,'waiting_for_editor');assert.equal(requests,0);
    assert.equal(await pipeline.enqueuePipeline('test-editor','generate',candidate().id),true);
    assert.equal(await pipeline.enqueuePipeline('test-editor','generate',candidate().id),false);
    assert.equal((await run()).image.status,'cover_ready');assert.equal(requests,2);
    const dash=await pipeline.getPipelineDashboard();assert.equal(dash.attempts.length,2);assert.equal(dash.commands[0].state,'completed');
    assert.equal(dash.candidates[0].image_state,'completed');assert.equal(dash.usage.charged,'42260');
    await run();assert.equal(requests,2);
    assert.equal(await pipeline.setPipelinePaused('test-editor',true),true);assert.equal((await store.summary()).control.paused,true);
  });
  const googlePolicy={...JSON.parse(await readFile(new URL('../config/policy.json',import.meta.url),'utf8')),google_account_email:'blog-owner@example.test',generation_enabled:true,automatic_image_generation_enabled:true};
  const subscription=()=>({account_email:'blog-owner@example.test',plan:'google_ai_pro',auth_method:'official_google_oauth',use_g1_credits:false,verified_at:new Date().toISOString(),valid_until:new Date(Date.now()+3600000).toISOString(),verification_reference:'Synthetic official account verification for integration tests'});
  const googleOptions=()=>options({policy:googlePolicy,catalog:[]});
  async function googleDossier(reviewed=true){
    const c=candidate(),document=dossierFixture(3),assessment=assessDossier(document,{comparisonVerified:reviewed});
    const [stored]=await admin`select evidence_hash from blog_worker.candidate where id=${c.id}`;
    await admin`insert into blog_worker.dossier_version(candidate_id,revision,document,document_hash,assessment,actor_id,reviewed_by,reviewed_at,source_hash,change_reason)
      values(${c.id},1,${admin.json(document)},${dossierHash(document)},${admin.json(assessment)},'test-editor',${reviewed?'test-editor':null},${reviewed?new Date():null},${stored.evidence_hash},'Synthetic fixture dossier')`;
  }
  const googleCompleted={...completed,text:JSON.stringify({...JSON.parse(completed.text),paragraphs:JSON.parse(completed.text).paragraphs.map(p=>({...p,claimIds:['C1']}))})};
  const googleUsage={input_tokens:10000,output_tokens:500,thinking_tokens:100,cache_read_tokens:10000,total_tokens:10500};
  await check('missing draft-wrapper permission blocks comparison and text before reserving or invoking a provider',async()=>{
    await reset();await operator.attestSubscription(subscription());await store.ingest(candidate());await googleDossier();
    await admin.unsafe('REVOKE EXECUTE ON FUNCTION blog_worker.import_draft(text,jsonb) FROM blog_runtime');
    try{
      await assert.rejects(()=>store.reserve(googleOptions()),/draft_import_unavailable/);
      await assert.rejects(()=>store.reserveComparison({...googleOptions(),candidateId:candidate().id}),/draft_import_unavailable/);
      assert.equal((await admin`select count(*)::int as n from blog_worker.attempt`)[0].n,0);
    }finally{await admin.unsafe('GRANT EXECUTE ON FUNCTION blog_worker.import_draft(text,jsonb) TO blog_runtime');}
    assert.equal(await runtime`select has_function_privilege(current_user,'blog_worker.import_draft_legacy(text,jsonb)','EXECUTE') permitted`.then(r=>r[0].permitted),false);
    assert.equal((await store.reserve(googleOptions())).status,'reserved');
  });
  await check('operator holds stay excluded from automatic comparison and explicit reservation',async()=>{
    await reset();await operator.attestSubscription(subscription());await store.ingest(candidate());await googleDossier(false);
    await admin`update blog_worker.candidate set status='held',reason='operator_hold' where id=${candidate().id}`;
    assert.equal(await store.nextAutomaticWork(googlePolicy),null);
    assert.equal((await store.reserveComparison({...googleOptions(),candidateId:candidate().id})).status,'idle');
    assert.equal((await admin`select count(*)::int as n from blog_worker.attempt`)[0].n,0);
  });
  await check('admin generation waits for a current eligible comparison and rejects stale evidence before enqueueing',async()=>{
    await reset();await store.ingest(candidate());await store.syncPipeline({policy:googlePolicy,sources:[source],catalog:[]},{});
    const pipeline=loadCms(cmsClient,'lib/blog/pipeline.ts'),editorial=loadCms(cmsClient,'lib/blog/dossier.ts');
    await admin`insert into public.blog_post(slug,title,excerpt,body,category,author_id,author_name) values('manual-admin-fixture','Manual draft fixture','Synthetic manual draft for admin coverage','Synthetic manual draft body for admin coverage. No article is published.','tecnologia','test-editor','Synthetic Editor')`;
    assert.equal((await pipeline.getPipelineDashboard()).totalPosts,1,'manual drafts count in CMS even without a worker candidate');
    assert.equal(await pipeline.enqueuePipeline('test-editor','generate',candidate().id),false,'one captured source is research, not a verified article');
    assert.equal((await pipeline.getPipelineDashboard()).candidates[0].generation_ready,false);
    await googleDossier(false);
    assert.equal(await pipeline.enqueuePipeline('test-editor','generate',candidate().id),false,'an unverified comparison cannot enter the generation queue');
    assert.equal(await editorial.reviewDossier('test-editor',candidate().id,1),true);
    assert.equal((await pipeline.getPipelineDashboard()).candidates[0].generation_ready,true);
    assert.equal(await pipeline.enqueuePipeline('test-editor','generate',candidate().id),true);
    await admin`update blog_worker.command set state='completed'`;
    await admin`update blog_worker.candidate set evidence_hash=${'f'.repeat(64)} where id=${candidate().id}`;
    assert.equal((await pipeline.getPipelineDashboard()).candidates[0].generation_ready,false);
    assert.equal(await pipeline.enqueuePipeline('test-editor','generate',candidate().id),false,'source changes invalidate readiness before another command is queued');
    assert.equal((await admin`select count(*)::int as n from blog_worker.attempt`)[0].n,0);
  });
  await check('Google subscription imports text and cover with zero API charge and distinct quota ledger',async()=>{
    await reset();await operator.attestSubscription(subscription());await store.ingest(candidate());await googleDossier();
    await assert.rejects(()=>runtime`update blog_worker.subscription set plan='google_ai_pro'`,/permission denied/);
    const r=await store.reserve(googleOptions());assert.equal(r.reserved_micro_usd,0);
    const done=await store.finish(r,{...googleCompleted,usage:googleUsage});assert.equal(done.status,'draft');
    const image=await store.reserveImage(googleOptions());assert.equal(image.reserved_micro_usd,0);
    const cover=await store.finish(image,{outcome:'completed',image:webpFixture(),usage:googleUsage});assert.equal(cover.status,'cover_ready');
    const attempts=await admin`select provider,benefit_id,charged_micro_usd,quota_used from blog_worker.attempt`;
    assert.equal(attempts.length,2);for(const a of attempts){assert.equal(a.provider,'google_subscription');assert.equal(a.benefit_id,null);assert.equal(Number(a.charged_micro_usd),0);assert.equal(Number(a.quota_used),20600);}
    assert.equal(await cms.getPostMediaImage(cover.media_id,false),null);
    const pipeline=loadCms(cmsClient,'lib/blog/pipeline.ts');await store.syncPipeline({policy:googlePolicy,sources:[source],catalog:[]},{});
    const dashboard=await pipeline.getPipelineDashboard();assert.equal(dashboard.quota.day_calls,2);assert.equal(dashboard.quota.day_tokens,'41200');assert.equal(dashboard.subscription.plan,'google_ai_pro');
  });
  await check('a second cover requires explicit authorization, preserves the original and cannot become an automatic retry',async()=>{
    await reset();await operator.attestSubscription(subscription());await store.ingest(candidate());await googleDossier();
    const r=await store.reserve(googleOptions());await store.finish(r,{...googleCompleted,usage:googleUsage});
    const first=await store.reserveImage(googleOptions());const old=await store.finish(first,{outcome:'completed',image:webpFixture(),usage:googleUsage});
    const [p]=await admin`select revision from public.blog_post where id=${old.post_id}`;
    await admin`update blog_worker.image_job set state='pending',media_id=null,image=null,expected_revision=${p.revision} where candidate_id=${candidate().id}`;
    await assert.rejects(()=>store.reserveImage(googleOptions()),/image_attempt_limit/);
    await assert.rejects(()=>runtime`insert into blog_worker.operator_event(actor_id,action,target) values('forged','image_revision_authorized',${candidate().id})`,/permission denied/);
    await admin`insert into blog_worker.operator_event(actor_id,action,target,detail) values('authorized-editor','image_revision_authorized',${candidate().id},${admin.json({previous_attempt_id:first.id,previous_media_id:old.media_id,expected_revision:p.revision})})`;
    const replacement=await store.reserveImage(googleOptions());assert.equal(replacement.status,'reserved');
    const fresh=await store.finish(replacement,{outcome:'completed',image:webpFixture(),usage:googleUsage});assert.equal(fresh.status,'cover_ready');assert.notEqual(fresh.media_id,old.media_id);
    assert.equal((await admin`select count(*)::int as n from public.blog_media where post_id=${old.post_id}`)[0].n,2);
    const receipts=await admin`select ordinal,state,charged_micro_usd from blog_worker.attempt where kind='image' order by ordinal`;assert.deepEqual(receipts.map(a=>a.ordinal),[1,2]);assert.ok(receipts.every(a=>a.state==='confirmed'&&Number(a.charged_micro_usd)===0));
    await admin`update blog_worker.image_job set state='pending',media_id=null,image=null where candidate_id=${candidate().id}`;
    await assert.rejects(()=>store.reserveImage(googleOptions()),/image_attempt_limit/);
  });
  const accessPolicy=()=>({...googlePolicy,google_automatic_access_validation_enabled:true});
  const accessReceipt=(fraction=1)=>({ok:true,command:'usage',num_turns:0,model_tokens:0,use_g1_credits:false,client_sha256:'a'.repeat(64),quota:{name:'Gemini Models',buckets:[{window:'weekly',remaining_fraction:fraction,reset_time:new Date(Date.now()+86400000).toISOString()},{window:'5h',remaining_fraction:fraction,reset_time:new Date(Date.now()+3600000).toISOString()}]}});
  const accessProvider=(inspect)=>({clientSha256:'a'.repeat(64),verifyAccess:inspect??(async()=>accessReceipt())});
  await check('automatic access renews operational proof without changing expired plan evidence or spending tokens',async()=>{
    await reset();await operator.attestSubscription(subscription());
    await admin`update blog_worker.subscription set verified_at=now()-interval '2 days',valid_until=now()-interval '1 day',attestation=attestation||jsonb_build_object('verified_at',now()-interval '2 days','valid_until',now()-interval '1 day')`;
    const [before]=await admin`select attestation from blog_worker.subscription`;
    let checks=0;const provider=accessProvider(async()=>{checks++;return accessReceipt();});
    await store.ingest(candidate());await googleDossier();
    await assert.rejects(()=>store.reserve({...googleOptions(),policy:accessPolicy()}),/google_access_unverified/);
    assert.equal((await store.revalidateGoogleAccess(accessPolicy(),provider)).status,'valid');assert.equal(checks,1);
    assert.equal((await store.revalidateGoogleAccess(accessPolicy(),provider)).status,'valid');assert.equal(checks,1,'hourly result reused without another diagnostic');
    await admin`update blog_worker.google_access set succeeded_at=now()-interval '7 hours',valid_until=now()-interval '1 hour',next_check_at=now()-interval '1 hour'`;
    await assert.rejects(()=>store.reserve({...googleOptions(),policy:accessPolicy()}),/google_access_unverified/);
    assert.equal((await store.revalidateGoogleAccess(accessPolicy(),provider)).status,'valid');assert.equal(checks,2,'expired operational lease is renewed by a fresh diagnostic');
    const [after]=await admin`select attestation from blog_worker.subscription`;assert.deepEqual(after.attestation,before.attestation);
    assert.equal((await admin`select count(*)::int as n from blog_worker.attempt`)[0].n,0,'diagnostics never enter the model ledger');
    assert.equal((await store.reserve({...googleOptions(),policy:accessPolicy()})).status,'reserved','manual 24h expiry no longer blocks a verified native profile');
    await assert.rejects(()=>runtime`update blog_worker.subscription set valid_until=now()+interval '1 year'`,/permission denied/);
    await assert.rejects(()=>runtime`update blog_worker.google_access set valid_until=now()+interval '1 year'`,/permission denied/);
  });
  await check('concurrent access checks deduplicate, reject stale bindings and reject model or credit receipts',async()=>{
    await reset();await operator.attestSubscription(subscription());
    const [first]=await runtime`select blog_worker.claim_google_access(${googlePolicy.google_account_email},${'a'.repeat(64)}) as result`;
    const [busy]=await other`select blog_worker.claim_google_access(${googlePolicy.google_account_email},${'a'.repeat(64)}) as result`;assert.equal(busy.result.reason,'google_access_check_in_progress');
    for(const change of [{num_turns:1},{model_tokens:1},{use_g1_credits:true},{client_sha256:'b'.repeat(64)}])await assert.rejects(()=>runtime`select blog_worker.settle_google_access(${first.result.claim_id},${runtime.json({...accessReceipt(),...change})})`,/invalid_access_receipt/);
    await admin`update blog_worker.subscription set attestation=attestation||'{"verification_reference":"New authorized profile observation invalidates old checks"}'::jsonb`;
    const [stale]=await runtime`select blog_worker.settle_google_access(${first.result.claim_id},${runtime.json(accessReceipt())}) as result`;assert.equal(stale.result.reason,'google_access_stale_check');
  });
  await check('failed checks block dispatch, back off and recover without clearing a paused circuit',async()=>{
    await reset();await operator.attestSubscription(subscription());await store.ingest(candidate());await googleDossier();
    let checks=0;const provider=accessProvider(async()=>{checks++;throw Object.assign(new Error('fixture'),{code:'google_auth_required'});});
    const result=await store.revalidateGoogleAccess(accessPolicy(),provider);assert.equal(result.reason,'google_auth_required');
    await store.revalidateGoogleAccess(accessPolicy(),provider);assert.equal(checks,1,'failure backoff prevents per-minute retries');
    await assert.rejects(()=>store.reserve({...googleOptions(),policy:accessPolicy()}),/google_access_unverified/);
    await admin`update blog_worker.google_access set next_check_at=now()-interval '1 second'`;await admin`update blog_worker.control set paused=true,reason='operator_hold'`;
    assert.equal((await store.revalidateGoogleAccess(accessPolicy(),accessProvider())).status,'valid');assert.equal((await store.summary()).control.paused,true);
  });
  await check('automatic idle worker revalidates access but never invokes a model',async()=>{
    await reset();await operator.attestSubscription(subscription());let checks=0,modelCalls=0;
    const provider=Object.assign(async()=>{modelCalls++;throw Error('unexpected model');},accessProvider(async()=>{checks++;return accessReceipt();}));
    const config={policy:{...accessPolicy(),operator_commands_only:false},sources:[],catalog:[]};
    const result=await tick({store,config,identity:{},provider});assert.equal(result.access.status,'valid');assert.equal(result.generation.reason,'waiting_for_evidence');assert.equal(checks,1);assert.equal(modelCalls,0);
    const pipeline=loadCms(cmsClient,'lib/blog/pipeline.ts');const dashboard=await pipeline.getPipelineDashboard();assert.equal(dashboard.googleAccess.valid,true);assert.equal(dashboard.quota.day_calls,0);
  });
  await check('Google requires current subscription and reserves quota atomically across instances',async()=>{
    await reset();await store.ingest(candidate());await googleDossier();await assert.rejects(()=>store.reserve(googleOptions()),/google_subscription_unverified/);
    await operator.attestSubscription({...subscription(),account_email:'another@example.test'});
    await assert.rejects(()=>store.reserve(googleOptions()),/google_subscription_unverified/);
    await operator.attestSubscription(subscription());
    const results=await Promise.allSettled([store.reserve(googleOptions()),second.reserve(googleOptions())]);
    assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected').length,1);
    await admin`update blog_worker.attempt set created_at=now()-interval '6 minutes'`;assert.equal(await store.recover(),1);
    const a=(await admin`select quota_reserved,quota_used from blog_worker.attempt`)[0];assert.equal(Number(a.quota_reserved),60000);assert.equal(a.quota_used,null);
    await assert.rejects(()=>operator.resume(),/request_pending/);
    const [pending]=await admin`select * from blog_worker.attempt`;
    await assert.rejects(()=>operator.reconcile({attempt_id:pending.id,charged_micro_usd:0,verification_reference:'missing Google usage'}),/google_usage_missing/);
    await assert.rejects(()=>operator.reconcile({attempt_id:pending.id,charged_micro_usd:1,usage:googleUsage,verification_reference:'Google cannot incur dollars'}),/invalid_reconciliation/);
    await operator.reconcile({attempt_id:pending.id,charged_micro_usd:0,usage:googleUsage,verification_reference:'Official client terminal result reviewed'});
    assert.equal((await admin`select quota_used from blog_worker.attempt`)[0].quota_used,'20600');
    await operator.resume();assert.equal((await store.reserve(googleOptions())).status,'idle');
  });
  await check('Google daily quota and over-reservation stop additional work without charging dollars',async()=>{
    await reset();await operator.attestSubscription(subscription());await store.ingest(candidate());await googleDossier();
    const tight=googleOptions();tight.policy={...googlePolicy,google_daily_tokens_cap:59999};await assert.rejects(()=>store.reserve(tight),/google_token_limit/);
    const r=await store.reserve(googleOptions());const done=await store.finish(r,{...googleCompleted,usage:{...googleUsage,input_tokens:80000,total_tokens:80500}});
    assert.equal(done.status,'held');assert.equal(done.charged_micro_usd,0);await assert.rejects(()=>operator.resume(),/usage_exceeded_reservation/);
  });
  await check('diagnostic consumption remains visible and cannot evade local quota',async()=>{
    await reset();await operator.attestSubscription(subscription());await store.ingest(candidate());await googleDossier();
    await admin`insert into blog_worker.operator_event(actor_id,action,detail) values('operator','google_diagnostic_usage','{"quota_used":1778}'::jsonb)`;
    const pipeline=loadCms(cmsClient,'lib/blog/pipeline.ts');await store.syncPipeline({policy:googlePolicy,sources:[source],catalog:[]},{});
    const dashboard=await pipeline.getPipelineDashboard();assert.equal(dashboard.quota.day_calls,1);assert.equal(dashboard.quota.day_tokens,'1778');
    await assert.rejects(()=>store.reserve({...googleOptions(),policy:{...googlePolicy,google_daily_calls_cap:1}}),/google_call_limit/);
    await assert.rejects(()=>store.reserve({...googleOptions(),policy:{...googlePolicy,google_daily_tokens_cap:60000}}),/google_token_limit/);
  });
  await check('mirrored pilot usage counts once only when the confirmed native receipt matches exactly',async()=>{
    await reset();await operator.attestSubscription(subscription());await store.ingest(candidate());await googleDossier();
    const r=await store.reserve(googleOptions());await store.finish(r,{...googleCompleted,usage:googleUsage});
    const detail={quota_used:20600,usage_known:true,usage:googleUsage,kind:'text',purpose:'Authorized real editorial batch; legacy-compatible usage accounting'};
    await admin`insert into blog_worker.operator_event(actor_id,action,target,detail) values('google_editorial_pilot','google_diagnostic_usage',${r.id},${admin.json(detail)})`;
    const pipeline=loadCms(cmsClient,'lib/blog/pipeline.ts');await store.syncPipeline({policy:googlePolicy,sources:[source],catalog:[]},{});
    let dash=await pipeline.getPipelineDashboard();assert.equal(dash.quota.day_calls,1);assert.equal(dash.quota.day_tokens,'20600');
    // A genuine extra diagnostic can reference the same attempt; it must still consume quota.
    await admin`insert into blog_worker.operator_event(actor_id,action,target,detail) values('operator','google_diagnostic_usage',${r.id},${admin.json({...detail,purpose:'Additional independent diagnostic',quota_used:100})})`;
    dash=await pipeline.getPipelineDashboard();assert.equal(dash.quota.day_calls,2);assert.equal(dash.quota.day_tokens,'20700');
    await assert.rejects(()=>store.reserveImage({...googleOptions(),policy:{...googlePolicy,google_daily_calls_cap:2}}),/google_call_limit/);
    assert.equal((await store.reserveImage({...googleOptions(),policy:{...googlePolicy,google_daily_calls_cap:3}})).status,'reserved');
    assert.equal((await admin`select count(*)::int as n from blog_worker.operator_event where action='google_diagnostic_usage'`)[0].n,2,'audit events retained');
  });
  await check('automatic research is bounded to captured approved sources and advances through metered comparison to a private draft',async()=>{
    await reset();await operator.attestSubscription(subscription());
    const approved=[{...source,id:'SRC01',url:'https://www.nasa.gov/news-release/feed/',article_hosts:['www.nasa.gov'],editoria:'ciencia-espaco'},
      {...source,id:'REF27',url:'https://www.space.com/feeds/all',article_hosts:['www.space.com'],editoria:'ciencia-espaco'}];
    const autoPolicy={...googlePolicy,operator_commands_only:false,automatic_image_generation_enabled:false};
    await store.syncPipeline({policy:autoPolicy,sources:approved,catalog:[]},{});
    const text='A equipe anunciou um experimento inicial. Trata-se de um teste sintético da integração, sem valor de notícia. O estudo sintético DOI 10.1234/fixture-automatic não comprova aplicações clínicas nem lançamento comercial.';
    const make=(src,title,url,content)=>normalizeItem({title,link:url,contentSnippet:content,isoDate:new Date().toISOString()},src,new Date());
    const a=make(approved[0],'Synthetic NASA test','https://www.nasa.gov/synthetic-auto-test/',text);
    const b=make(approved[1],'Synthetic independent test','https://www.space.com/synthetic-auto-test/','Análise própria de limitações metodológicas para um teste sintético. '+text);
    await store.ingest(a);await store.ingest(b);
    assert.deepEqual(await store.prepareAutomaticResearch(autoPolicy,{read:async()=>{throw Object.assign(Error('offline fixture'),{code:'research_source_unavailable'});}}),{prepared:1});
    const [v]=await admin`select * from blog_worker.dossier_version where candidate_id=${a.id}`;
    assert.equal(v.actor_id,'automatic_research');assert.equal(v.reviewed_by,null);assert.equal(v.assessment.comparison_verified,false);
    assert.equal((await store.prepareAutomaticResearch(autoPolicy,{read:async()=>{throw Object.assign(Error('fixture unavailable'),{code:'research_source_unavailable'});}})).prepared,0);
    const changed=structuredClone(v.document);changed.documents[0].text+=' invented';changed.documents[0].content_hash=dossierHash(changed.documents[0].text);
    // The narrow function cannot overwrite a dossier or manufacture an approval.
    assert.equal((await runtime`select blog_worker.prepare_automatic_research(${a.id},${runtime.json(changed)},${a.evidence_hash}) as prepared`)[0].prepared,false);
    const work=await store.nextAutomaticWork(autoPolicy);assert.equal(work.method,'reserveComparison');assert.equal(work.candidateId,a.id);
    const r=await store.reserveComparison({...googleOptions(),policy:autoPolicy,candidateId:a.id});
    const claim={id:'C1',text:'A equipe anunciou um experimento inicial.',critical:true,cells:v.document.documents.map(d=>({document_id:d.id,status:'supports',quote:'A equipe anunciou um experimento inicial.',note:'Synthetic fixture correspondence only'}))};
    assert.equal((await store.finish(r,{outcome:'completed',text:JSON.stringify({claims:[claim]}),usage:googleUsage})).status,'comparison_ready');
    assert.equal((await store.nextAutomaticWork(autoPolicy)).method,'reserve');
    const draftReservation=await store.reserve({...googleOptions(),policy:autoPolicy,candidateId:a.id});
    const result=await store.finish(draftReservation,{...googleCompleted,usage:googleUsage});assert.equal(result.status,'draft');
    assert.equal((await admin`select status from public.blog_post where id=${result.post_id}`)[0].status,'draft');
    await assert.rejects(()=>admin`update public.blog_post set status='published' where id=${result.post_id}`,/blog_factual_review_required/);
    assert.equal((await admin`select count(*)::int as n from blog_worker.attempt`)[0].n,2);
  });
  await check('short RSS sources are completed with public snapshots before the first metered comparison and keep the fresh source hash',async()=>{
    await reset();await operator.attestSubscription(subscription());
    const sources=[{...source,id:'SRC01',url:'https://www.nasa.gov/news-release/feed/',article_hosts:['www.nasa.gov'],editoria:'ciencia-espaco'},
      {...source,id:'REF27',url:'https://www.space.com/feeds/all',article_hosts:['www.space.com'],editoria:'ciencia-espaco'}];
    await store.syncPipeline({policy:googlePolicy,sources,catalog:[]},{});
    const at=new Date().toISOString(),short='Synthetic report with DOI 10.1234/complete-preview. This is a synthetic source for testing public research, never a real news article. Evidence and limitations must be checked before any draft or model invocation.';
    const a=normalizeItem({title:'Synthetic NASA preview',link:'https://www.nasa.gov/complete-preview/',isoDate:at,contentSnippet:short},sources[0],new Date());
    const b=normalizeItem({title:'Synthetic independent analysis',link:'https://www.space.com/complete-preview/',isoDate:at,contentSnippet:'Independent context. '+short},sources[1],new Date());
    await store.ingest(a);await store.ingest(b);let reads=0;
    const read=async(url,budget)=>{reads++;budget.used+=2;return {url,title:'Synthetic full public article',published_at:at,text:short.repeat(10),source_id:articleSource(referenceForUrl(url)).id,rights_reference:articleSource(referenceForUrl(url)).rights_reference,extraction_method:'public_article',extraction_version:ARTICLE_EXTRACTION_VERSION,evidence_scope:'public_article',related_urls:[]};};
    const r=await store.prepareAutomaticResearch(googlePolicy,{read});assert.equal(r.prepared,1);assert.equal(reads,2);assert.equal(r.requests,4);
    const [v]=await admin`select * from blog_worker.dossier_version where candidate_id=${a.id}`;
    const [c]=await admin`select * from blog_worker.candidate where id=${a.id}`;
    assert.notEqual(c.evidence_hash,a.evidence_hash);assert.equal(v.source_hash,c.evidence_hash);assert.equal(v.assessment.comparison_verified,false);
    assert.ok(v.document.documents.every(d=>d.text.length>short.length));assert.equal((await admin`select count(*)::int as n from blog_worker.attempt`)[0].n,0);
  });
  await check('network research rotates through all ten topics across restarts and backoff without model calls',async()=>{
    await reset();const items=[];
    for(let i=0;i<TOPICS.length;i++)for(let j=0;j<2;j++){
      const c=candidate(20+i*2+j);await store.ingest(c);items.push(c);
      await admin`update blog_worker.candidate set artifact=${admin.json({research:{topic:TOPICS[i]}})} where id=${c.id}`;
    }
    const calls=[],scopes=[];
    const read=async url=>{calls.push(url);throw Object.assign(Error('Synthetic inaccessible source'),{code:'research_source_unavailable'});};
    for(let i=0;i<TOPICS.length;i++){
      const fresh=new Store(runtime);assert.equal((await fresh.prepareAutomaticResearch(googlePolicy,{read})).prepared,0);
      const c=items.find(c=>c.url===calls.at(-1));const [row]=await admin`select artifact from blog_worker.candidate where id=${c.id}`;
      scopes.push(topicKey(row.artifact.research.topic));assert.ok(row.artifact.research.next_at>new Date().toISOString());
    }
    assert.equal(calls.length,10);assert.equal(new Set(calls).size,10);
    assert.deepEqual([...new Set(scopes)].sort(),TOPICS.map(topicKey).sort());
    assert.equal((await admin`select count(*)::int as n from blog_worker.attempt`)[0].n,0);
  });
  await check('public article enrichment captures approved snapshots, promotes the primary and preserves the dossier on RSS recollection',async()=>{
    await reset();await operator.attestSubscription(subscription());
    const src={...source,id:'REF27',url:'https://www.space.com/feeds/all',article_hosts:['www.space.com'],editoria:'ciencia-espaco'};
    await store.syncPipeline({policy:googlePolicy,sources:[src],catalog:[]},{});
    const date=new Date().toISOString(),url='https://www.space.com/research-enrichment-test/';
    const seed=normalizeItem({title:'Synthetic NASA experiment',link:url,isoDate:date,contentSnippet:'A partial RSS discovery; primary evidence and independent verification are still required. '.repeat(4)},src,new Date());await store.ingest(seed);
    const text='A equipe anunciou um experimento inicial. Este documento sintético descreve os limites do método de avaliação e não representa uma notícia real. '+('Dr. Silva mediu 3.14 unidades no teste?! O DOI 10.1234/fixture-enrichment exige novas medições. '.repeat(30));
    const read=async(url,budget)=>{budget.used++;return {source_id:url===seed.url?'ARTICLE_REF27':'ARTICLE_REF22',url,title:'Synthetic public research',published_at:date,text:(url===seed.url?'Análise independente de contexto. ':'')+text,rights_reference:'Public fixture excerpt for testing',content_hash:hash(text),extraction_method:'public_article',extraction_version:ARTICLE_EXTRACTION_VERSION,related_urls:url===seed.url?['https://www.nasa.gov/research-enrichment-test/']:[]};};
    assert.equal((await store.prepareAutomaticResearch({...googlePolicy,operator_commands_only:false},{read})).prepared,1);
    const [d]=await admin`select * from blog_worker.dossier_version`;assert.equal(d.document.documents.length,2);assert.equal(d.assessment.eligible,false);
    assert.equal(d.document.documents[0].url,'https://www.nasa.gov/research-enrichment-test/');assert.equal(d.reviewed_by,null);
    for(const doc of d.document.documents){const [snapshot]=await admin`select document from blog_worker.captured_document where id=${doc.capture_id}`;assert.equal(snapshot.document.text.slice(0,doc.text.length),doc.text);}
    assert.equal((await admin`select count(*)::int as n from blog_worker.captured_document`)[0].n>=3,true);
    await store.ingest(seed);assert.equal((await store.researchCandidate(seed.url)).evidence[0].extraction_method,'public_article');
    const changed=structuredClone(seed);changed.evidence[0].text+=' Material change recorded by the source.';changed.evidence[0].content_hash=hash(changed.evidence[0].text);changed.evidence_hash=hash(changed.evidence);await store.ingest(changed);
    assert.equal((await store.researchCandidate(seed.url)).evidence[0].extraction_method,'public_article');
    assert.equal((await admin`select reason from blog_worker.candidate where id=${d.candidate_id}`)[0].reason,'source_changed_after_reservation');
    assert.equal((await admin`select count(*)::int as n from blog_worker.dossier_version`)[0].n,1);
    assert.equal((await admin`select count(*)::int as n from blog_worker.attempt`)[0].n,0);
  });
  await check('multisource comparison is metered, advances automatically to a private draft, and protects final publication',async()=>{
    await reset();await operator.attestSubscription(subscription());await store.ingest(candidate());
    assert.equal((await store.reserve(googleOptions())).status,'idle');
    await assert.rejects(()=>store.reserve({...googleOptions(),candidateId:candidate().id}),/comparison_incomplete/);
    assert.equal((await admin`select count(*)::int as n from blog_worker.attempt`)[0].n,0);
    await googleDossier(false);
    await assert.rejects(()=>runtime`update blog_worker.dossier_version set reviewed_by='forged'`,/permission denied/);
    await assert.rejects(()=>editorClient`delete from blog_worker.dossier_version`,/permission denied/);
    await assert.rejects(()=>editorClient`insert into blog_worker.attempt(id) values('00000000-0000-0000-0000-000000000000')`,/permission denied/);
    await assert.rejects(()=>runtime`select blog_worker.import_draft_legacy(${candidate().id},'{}'::jsonb)`,/permission denied/);
    const editorial=loadCms(editorClient,'lib/blog/dossier.ts');
    const config={policy:{...googlePolicy,automatic_image_generation_enabled:false},sources:[source],catalog:[]};
    await store.syncPipeline(config,identity);
    assert.equal(await editorial.requestDossierComparison('test-editor',candidate().id,1),true);
    let requests=0;
    const run=()=>tick({store,config,identity,download:async()=>({notModified:true}),provider:async r=>{
      requests++;return r.kind==='comparison'?{outcome:'completed',text:JSON.stringify({claims:dossierFixture(3).claims}),usage:googleUsage}:{...googleCompleted,usage:googleUsage};
    }});
    assert.equal((await run()).generation.status,'comparison_ready');assert.equal(requests,1);
    assert.equal((await admin`select count(*)::int as n from public.blog_post`)[0].n,0);
    const [assisted]=await admin`select * from blog_worker.dossier_version where candidate_id=${candidate().id} order by revision desc limit 1`;
    assert.equal(assisted.revision,2);assert.equal(assisted.actor_id,'google_assisted');assert.equal(assisted.reviewed_by,null);assert.equal(assisted.assessment.eligible,true);
    assert.equal(await editorial.reviewDossier('test-editor',candidate().id,1),false,'stale editor version rejected');
    const pipeline=loadCms(cmsClient,'lib/blog/pipeline.ts');
    assert.equal(await pipeline.enqueuePipeline('test-editor','generate',candidate().id),true);
    const draft=(await run()).generation;assert.equal(draft.status,'draft');assert.equal(requests,2);
    const [p]=await admin`select * from public.blog_post where id=${draft.post_id}`;
    assert.equal(p.status,'draft');assert.equal(await cms.getPublicPost(p.slug),null);
    await assert.rejects(()=>admin`update public.blog_post set status='published',published_at=now() where id=${p.id}`,/blog_factual_review_required/);
    assert.equal(await editorial.reviewFinalArticle('test-editor',candidate().id,p.revision),true);
    await admin`insert into public.blog_media(id,post_id,alt,caption,width,height,image) values('test-factual-cover',${p.id},'Capa sintética de teste','Crédito sintético autorizado',1536,1024,${webpFixture()})`;
    await admin`update public.blog_post set cover_media_id='test-factual-cover' where id=${p.id}`;
    await assert.rejects(()=>admin`update public.blog_post set status='published',published_at=now() where id=${p.id}`,/blog_factual_review_required/);
    assert.equal(await editorial.reviewFinalArticle('test-editor',candidate().id,p.revision),true);
    const [ready]=await admin`select * from public.blog_post where id=${p.id}`;
    const saved=await cms.savePost({id:ready.id,revision:ready.revision,slug:ready.slug,title:ready.title,excerpt:ready.excerpt,
      body:ready.body.replace(/\n/g,'\r\n'),category:ready.category,featured:ready.featured,seoTitle:ready.seo_title,seoDescription:ready.seo_description,
      focusKeyword:ready.focus_keyword,seoNoIndex:false,coverMediaId:ready.cover_media_id,videoUrl:ready.video_url,intent:'publish',scheduledAt:null,actorId:'test-editor',actorName:'Synthetic Editor'});
    assert.notEqual(saved,'conflict','the actual editor round-trip accepts browser CRLF after review');
    assert.equal((await admin`select body from public.blog_post where id=${p.id}`)[0].body,ready.body,'canonical text remains unchanged');
    await assert.rejects(()=>admin`update public.blog_post set body=body||' changed' where id=${p.id}`,/blog_factual_review_required/);
    assert.ok(await cms.getPublicPost(p.slug));
    assert.equal((await admin`select count(*)::int as n from blog_worker.attempt`)[0].n,2);
    assert.equal((await store.reserveComparison({...googleOptions(),candidateId:candidate().id})).status,'idle');
  });
  await check('database independently verifies assisted scores and preserves the human-review boundary',async()=>{
    for(const [total,confirmed,criticalConflict] of [[10,9,false],[9,8,false],[10,10,true]]){
      await reset();await operator.attestSubscription(subscription());await store.ingest(candidate());await googleDossier(false);
      const reservation=await store.reserveComparison({...googleOptions(),candidateId:candidate().id});
      const document=dossierFixture(total,confirmed);if(criticalConflict)document.claims[0].cells[1].status='contradicts';
      const assessment=assessDossier(document,{comparisonVerified:true});
      await admin`update blog_worker.attempt set state='confirmed',charged_micro_usd=0 where id=${reservation.id}`;
      await assert.rejects(()=>runtime`select blog_worker.record_assisted_comparison(${candidate().id},${reservation.id},${runtime.json(document.claims)},${runtime.json({...assessment,hash:'0'.repeat(64)})})`,/invalid_assessment/);
      await runtime`select blog_worker.record_assisted_comparison(${candidate().id},${reservation.id},${runtime.json(document.claims)},${runtime.json(assessment)})`;
      const [version]=await admin`select * from blog_worker.dossier_version order by revision desc limit 1`;
      assert.equal(version.assessment.eligible,assessment.eligible);assert.equal(version.reviewed_by,null);assert.equal(version.actor_id,'google_assisted');
      assert.equal(version.document_hash,dossierHash(document));
      await assert.rejects(()=>runtime`insert into blog_worker.post_review(candidate_id) values(${candidate().id})`,/permission denied/);
      await assert.rejects(()=>runtime`select blog_worker.record_assisted_comparison(${candidate().id},${reservation.id},${runtime.json(document.claims)},${runtime.json(assessment)})`,/stale_comparison/);
    }
  });
  await check('dossier edited while comparison is in flight preserves charged usage and rejects stale result',async()=>{
    await reset();await operator.attestSubscription(subscription());await store.ingest(candidate());await googleDossier(false);
    const r=await store.reserveComparison({...googleOptions(),candidateId:candidate().id});const editorial=loadCms(editorClient,'lib/blog/dossier.ts');
    assert.equal(await editorial.saveDossierScope('test-editor',candidate().id,1,{event_key:'changed-fixture-event',category:'ciencia',subcategory:'aeroespacial'},'Scope changed during comparison'),true);
    const result=await store.finish(r,{outcome:'completed',text:JSON.stringify({claims:dossierFixture(3).claims}),usage:googleUsage});
    assert.equal(result.status,'held');assert.equal(result.reason,'evidence_changed');
    const [a]=await admin`select state,charged_micro_usd,quota_used from blog_worker.attempt`;assert.equal(a.state,'confirmed');assert.equal(a.charged_micro_usd,'0');assert.equal(a.quota_used,'20600');
  });
  await check('ten distinct topics complete comparison, text and credited cover as drafts; failed comparisons do not occupy production',async()=>{
    await reset();await operator.attestSubscription(subscription());
    const topics=[['ciencia',null],['ciencia','aeroespacial'],['ciencia','neurociencia'],['tecnologia',null],['tecnologia','ia'],['tecnologia','software-ferramentas'],['tecnologia','hardware-robotica'],['negocios',null],['negocios','marketing'],['negocios','empreendedorismo-startups']];
    const smallUsage={input_tokens:100,output_tokens:100,thinking_tokens:0,cache_read_tokens:0,total_tokens:200};
    const dossier=async(c,document)=>admin`insert into blog_worker.dossier_version(candidate_id,revision,document,document_hash,assessment,actor_id,source_hash,change_reason) values(${c.id},1,${admin.json(document)},${dossierHash(document)},${admin.json(assessDossier(document))},'test-editor',${c.evidence_hash},'Daily topic fixture')`;
    for(let i=0;i<topics.length;i++){
      const c=candidate(i+1);await store.ingest(c);const document={...dossierFixture(1),event_key:'daily-unique-event-'+i,category:topics[i][0],subcategory:topics[i][1]};
      document.documents=document.documents.map(d=>({...d,url:d.url+i,origin_url:d.origin_url+i}));
      await dossier(c,document);
      const r=await store.reserveComparison({...googleOptions(),candidateId:c.id});assert.equal(r.status,'reserved');
      assert.equal((await store.finish(r,{outcome:'completed',text:JSON.stringify({claims:document.claims}),usage:smallUsage})).status,'comparison_ready');
      if(i===0){const invalid=await store.reserve({...googleOptions(),candidateId:c.id});assert.equal((await store.finish(invalid,{outcome:'completed',text:'{}',usage:smallUsage})).status,'repair_pending');}
      const text=await store.reserve({...googleOptions(),candidateId:c.id});
      const result=await store.finish(text,{...googleCompleted,usage:smallUsage});assert.equal(result.status,'draft');
      assert.equal((await admin`select category from public.blog_post where id=${result.post_id}`)[0].category,{ciencia:'ciencias',tecnologia:'tecnologia',negocios:'empreendedorismo'}[topics[i][0]]);
      const image=await store.reserveImage({...googleOptions(),candidateId:c.id});assert.equal(image.status,'reserved');
      assert.equal((await store.finish(image,{outcome:'completed',image:webpFixture(),usage:smallUsage})).status,'cover_ready');
      if(i===0){
        const extra=candidate(50);await store.ingest(extra);await dossier(extra,{...document,event_key:'daily-extra-event',documents:document.documents.map(d=>({...d,url:d.url+'extra',origin_url:d.origin_url+'extra'}))});
        await assert.rejects(()=>store.reserveComparison({...googleOptions(),candidateId:extra.id}),/topic_frequency/);
      }
    }
    const dashboard=await loadCms(cmsClient,'lib/blog/pipeline.ts').getPipelineDashboard();
    assert.equal(dashboard.production.reduce((n,t)=>n+t.complete,0),10);
    assert.ok(dashboard.candidates.filter(c=>c.post_id).every(c=>c.topic_category&&c.topic_subcategory!==undefined));
    assert.equal((await admin`select count(*)::int as n from public.blog_post where status='draft' and published_at is null and scheduled_at is null`)[0].n,10);
    assert.equal((await admin`select count(*)::int as n from blog_worker.attempt where charged_micro_usd<>0`)[0].n,0);
    assert.equal((await admin`select count(*)::int as n from blog_worker.attempt`)[0].n,31);
    const usage=await store.productionUsage();assert.equal(usage.reduce((n,r)=>n+r.day,0),10,'a repaired article occupies only one daily slot');
    assert.equal(usage.reduce((n,r)=>n+r.week,0),10,'cost attempts do not become weekly articles');
    assert.equal((await admin`select count(*)::int as n from blog_worker.candidate where artifact->'seo'->>'guideline_id'='google-search-editorial-2026-11-13' and artifact->'seo'->>'prepared_in_same_call'='true'`)[0].n,10,'each new draft keeps the applied SEO guideline version without another call');
    const yesterday=new Date(Date.now()-86400000),old=periodKeys(yesterday);
    await admin`update blog_worker.attempt set day=${old.day}::date,week=${old.week}::date where reason='invalid_structure'`;
    assert.equal((await store.productionUsage()).reduce((n,r)=>n+r.day,0),10,'a failed attempt from yesterday does not move today’s completed article');
    assert.equal((await store.productionUsage(runtime,yesterday)).reduce((n,r)=>n+r.day,0),0,'a failed attempt is not a completed article on its original day');
    await assert.rejects(()=>runtime`update blog_worker.research_reference set definition='{}'::jsonb`,/permission denied/);
    await reset();await operator.attestSubscription(subscription());
    const failed=candidate(1);await store.ingest(failed);await dossier(failed,dossierFixture(1));
    const reservation=await store.reserveComparison({...googleOptions(),candidateId:failed.id});await store.finish(reservation,{outcome:'completed',text:'{}',usage:smallUsage});
    assert.equal((await store.productionUsage()).length,0);
    const replacement=candidate(2);await store.ingest(replacement);const replacementDoc={...dossierFixture(1),event_key:'different-event-replacement',documents:dossierFixture(1).documents.map(d=>({...d,url:d.url+'replacement',origin_url:d.origin_url+'replacement'}))};await dossier(replacement,replacementDoc);
    assert.equal((await store.reserveComparison({...googleOptions(),candidateId:replacement.id})).status,'reserved');
  });
  await check('ten topics run from captured feeds through automatic comparison, text and credited covers without publishing',async()=>{
    await reset();await operator.attestSubscription(subscription());
    const auto={...googlePolicy,operator_commands_only:false,google_automatic_access_validation_enabled:false};
    const def=(id,url,host,editoria)=>({...source,id,url,article_hosts:[host],editoria});
    const sources=[def('SRC01','https://www.nasa.gov/news-release/feed/','www.nasa.gov','ciencia-espaco'),def('SRC04','https://news.mit.edu/rss/research','news.mit.edu','ciencia-espaco'),def('SRC06','https://openai.com/news/rss.xml','openai.com','tecnologia'),def('PRIMARY_GOOGLE_BLOG','https://blog.google/rss/','blog.google','tecnologia'),def('REF27','https://www.space.com/feeds/all','www.space.com','ciencia-espaco'),def('REF15','https://neurosciencenews.com/feed/','neurosciencenews.com','ciencia-espaco'),def('REF33','https://www.sciencedaily.com/rss/all.xml','www.sciencedaily.com','ciencia-espaco'),def('REF05','https://tecnoblog.net/feed/','tecnoblog.net','tecnologia'),def('REF45','https://www.meioemensagem.com.br/feed','www.meioemensagem.com.br','startups'),def('REF47','https://startups.com.br/feed/','startups.com.br','startups'),def('REF43','https://exame.com/feed/','exame.com','startups')];
    await store.syncPipeline({policy:auto,sources,catalog:[]},{});
    const items=[['NASA spacecraft synthetic launch','SRC01','REF27'],['Brain research synthetic experiment','SRC04','REF15'],['Pesquisa científica experimental sintética','SRC04','REF33'],['Artificial intelligence synthetic research','PRIMARY_GOOGLE_BLOG','REF05'],['Software experimental synthetic research','PRIMARY_GOOGLE_BLOG','REF05'],['Hardware robot synthetic research','PRIMARY_GOOGLE_BLOG','REF05'],['Pesquisa computacional experimental sintética','SRC06','REF05'],['Marketing campanha experimental sintética','PRIMARY_GOOGLE_BLOG','REF45'],['Startup empreendedor experimental sintético','PRIMARY_GOOGLE_BLOG','REF47'],['Negócios mercado experimental sintético','PRIMARY_GOOGLE_BLOG','REF43']];
    const sentence='A equipe anunciou um experimento inicial.',at=new Date().toISOString();
    for(let i=0;i<items.length;i++)for(let side=1;side<=2;side++){
      const item=items[i],src=sources.find(v=>v.id===item[side]),url='https://'+src.article_hosts[0]+'/synthetic-ten-topic-'+i+'/';
      const text=(side===2?'Análise jornalística independente sobre métodos e limitações. ':'')+sentence+' DOI 10.1234/synthetic-ten-topic-'+i+'. '+('Este texto é inteiramente sintético para testar a produção e não apresenta resultados reais. '.repeat(20));
      await store.ingest(normalizeItem({title:item[0],link:url,isoDate:at,contentSnippet:text},src,new Date()));
    }
    const usage={input_tokens:100,output_tokens:100,thinking_tokens:0,cache_read_tokens:0,total_tokens:200};let invocations=0,networkReads=0;
    const simulationStore=new Store(runtime);simulationStore.prepareAutomaticResearch=policy=>Store.prototype.prepareAutomaticResearch.call(simulationStore,policy,{read:async()=>{networkReads++;throw Error('synthetic network disabled');}});
    const provider=async r=>{invocations++;if(r.kind==='image')return {outcome:'completed',image:webpFixture(),usage};if(r.kind==='comparison'){const docs=JSON.parse(r.body.input).documents;return {outcome:'completed',text:JSON.stringify({claims:[{id:'C1',text:sentence,critical:true,cells:docs.map(d=>({document_id:d.id,status:'supports',quote:sentence,note:'Synthetic fixture correspondence, never a real editorial validation.'}))}]}),usage};}return {...googleCompleted,usage};};
    // Only synthetic HTTP and provider adapters; no external request is possible.
    for(let cycle=0;cycle<40;cycle++){
      const result=await tick({store:simulationStore,config:{policy:auto,sources,catalog:[]},identity,provider,download:async()=>({notModified:true})});
      const [{complete}]=await admin`select count(*)::int as complete from blog_worker.image_job where state='completed'`;
      if(complete===10)break;
      assert.notEqual(result.generation?.reason,'internal_error');
    }
    const dashboard=await loadCms(cmsClient,'lib/blog/pipeline.ts').getPipelineDashboard();
    assert.equal(dashboard.production.filter(t=>t.complete===1).length,10);assert.equal(invocations,30);assert.equal(networkReads,0);
    assert.equal((await admin`select count(*)::int as count from public.blog_post where status='draft' and scheduled_at is null and published_at is null`)[0].count,10);
    assert.equal((await admin`select count(*)::int as count from blog_worker.attempt where charged_micro_usd<>0`)[0].count,0);
    await assert.rejects(()=>admin`update public.blog_post set status='published'`,/blog_factual_review_required/);
  });
  await check('a shared supporting article cannot produce another story under an alternative primary URL or topic',async()=>{
    await reset();await operator.attestSubscription(subscription());await store.ingest(candidate());await googleDossier(true);
    const first=await store.reserve(googleOptions());await store.finish(first,{...googleCompleted,usage:googleUsage});
    const next=candidate(2);await store.ingest(next);const doc={...dossierFixture(3),event_key:'alternate-primary-same-news',category:'tecnologia',subcategory:null};
    doc.documents[0]={...doc.documents[0],url:doc.documents[0].url+'alternate',origin_url:doc.documents[0].origin_url+'alternate'};
    await admin`insert into blog_worker.dossier_version(candidate_id,revision,document,document_hash,assessment,actor_id,source_hash,change_reason) values(${next.id},1,${admin.json(doc)},${dossierHash(doc)},${admin.json(assessDossier(doc))},'test-editor',${next.evidence_hash},'Synthetic alternate primary citation')`;
    await assert.rejects(()=>store.reserveComparison({...googleOptions(),candidateId:next.id}),/duplicate_research_event/);
    assert.equal((await admin`select count(*)::int as count from blog_worker.attempt`)[0].count,1);
    assert.equal((await admin`select count(*)::int as count from public.blog_post`)[0].count,1);
  });
  await check('dashboard keeps a general dossier separate from an earlier subtopic and reports evidence blockers',async()=>{
    await reset();await operator.attestSubscription(subscription());await store.ingest(candidate());await googleDossier(true);
    await admin`update blog_worker.dossier_version set document=jsonb_set(jsonb_set(document,'{category}','"tecnologia"'::jsonb),'{subcategory}','null'::jsonb)`;
    await admin`update blog_worker.candidate set artifact=${admin.json({research:{topic:{category:'tecnologia',subcategory:'ia'},stage:'research_primary_missing'}})}`;
    const dash=await loadCms(cmsClient,'lib/blog/pipeline.ts').getPipelineDashboard();
    const general=dash.production.find(t=>t.category==='tecnologia'&&t.subcategory===null);assert.ok(general);assert.equal(general.compared,1);assert.equal(general.primary_pending,1);
    assert.ok(!dash.production.some(t=>t.category==='tecnologia'&&t.subcategory==='ia'&&t.compared));
    await admin`update blog_worker.candidate set status='held',reason='operator_hold'`;
    const held=await loadCms(cmsClient,'lib/blog/pipeline.ts').getPipelineDashboard();
    const retained=held.production.find(t=>t.category==='tecnologia'&&t.subcategory===null);
    assert.equal(retained.compared,0,'A retained duplicate cannot be advertised as waiting for automatic writing');
    assert.equal(retained.review_held,1);
    await admin`update blog_worker.candidate set status='ready',reason=null,evidence_hash=${'f'.repeat(64)}`;
    const changed=await loadCms(cmsClient,'lib/blog/pipeline.ts').getPipelineDashboard();
    assert.equal(changed.production.find(t=>t.category==='tecnologia'&&t.subcategory===null).compared,0,'A comparison cannot approve changed source evidence');
  });
  await check('one bounded format repair can write text without repeating factual rejections or losing receipts',async()=>{
    await reset();await operator.attestSubscription(subscription());await store.ingest(candidate());await googleDossier(false);
    const auto={...googlePolicy,operator_commands_only:false,automatic_image_generation_enabled:false};
    const first=await store.reserveComparison({...googleOptions(),policy:auto,candidateId:candidate().id});
    await store.finish(first,{outcome:'completed',text:'{}',usage:googleUsage});
    assert.equal((await store.nextAutomaticWork(auto)).method,'reserveComparison','one format repair is allowed under the same prompt');
    assert.equal((await store.nextAutomaticWork(auto)).method,'reserveComparison');
    const second=await store.reserveComparison({...googleOptions(),policy:auto,candidateId:candidate().id});
    assert.match(second.body.instructions,/Única reparação de formato/);
    assert.equal((await store.finish(second,{outcome:'completed',text:JSON.stringify({claims:dossierFixture(3).claims}),usage:googleUsage})).status,'comparison_ready');
    const text=await store.reserve({...googleOptions(),policy:auto,candidateId:candidate().id});
    assert.equal((await store.finish(text,{...googleCompleted,usage:googleUsage})).status,'draft');
    const receipts=await admin`select kind,ordinal,state,charged_micro_usd from blog_worker.attempt order by created_at`;
    assert.deepEqual(receipts.map(a=>[a.kind,a.ordinal]),[['comparison',1],['comparison',2],['text',1]]);
    assert.ok(receipts.every(a=>a.state==='confirmed'&&Number(a.charged_micro_usd)===0));
    assert.equal((await admin`select status from public.blog_post`)[0].status,'draft');
  });
  await check('factual rejections and a second invalid comparison never trigger another automatic call',async()=>{
    const auto={...googlePolicy,operator_commands_only:false,automatic_image_generation_enabled:false};
    for(const malformed of [false,true]){
      await reset();await operator.attestSubscription(subscription());await store.ingest(candidate());await googleDossier(false);
      const first=await store.reserveComparison({...googleOptions(),policy:auto,candidateId:candidate().id});
      const document=dossierFixture(3);document.claims[0].cells[1].status='contradicts';
      await store.finish(first,{outcome:'completed',text:malformed?'{}':JSON.stringify({claims:document.claims}),usage:googleUsage});
      if(malformed){const second=await store.reserveComparison({...googleOptions(),policy:auto,candidateId:candidate().id});await store.finish(second,{outcome:'completed',text:'{}',usage:googleUsage});}
      await admin`update blog_worker.attempt set policy=policy-'comparison_prompt_version'`;
      assert.equal(await store.nextAutomaticWork(auto),null);
    }
  });
  await check('new cached corroboration wakes a candidate in network backoff without making a page request',async()=>{
    await reset();await operator.attestSubscription(subscription());
    const approved=[{...source,id:'SRC01',url:'https://www.nasa.gov/news-release/feed/',article_hosts:['www.nasa.gov'],editoria:'ciencia-espaco'}, {...source,id:'REF27',url:'https://www.space.com/feeds/all',article_hosts:['www.space.com'],editoria:'ciencia-espaco'}];
    const auto={...googlePolicy,operator_commands_only:false};await store.syncPipeline({policy:auto,sources:approved,catalog:[]},{});
    const at=new Date().toISOString(),text='A equipe anunciou um experimento inicial. DOI 10.1234/fresh-cache-test. '+('Evidência sintética, com contexto e limitações para teste. '.repeat(5));
    const make=(s,url,prefix)=>normalizeItem({title:'Synthetic NASA report',link:url,isoDate:at,contentSnippet:prefix+text},s,new Date());
    const primary=make(approved[0],'https://www.nasa.gov/fresh-cache-test/',''),other=make(approved[1],'https://www.space.com/fresh-cache-test/','Análise independente. ');
    await store.ingest(primary);let prematureReads=0;
    await store.researchProgress(primary.id,{stage:'research_independent_missing',topic:{category:'ciencia',subcategory:'aeroespacial'},tries:1,next_at:new Date(Date.now()+3600000).toISOString()});
    assert.equal((await store.prepareAutomaticResearch(auto,{read:async()=>{prematureReads++;throw Error('backoff');}})).prepared,0);assert.equal(prematureReads,0);
    await store.researchProgress(primary.id,{stage:'research_independent_missing',topic:{category:'ciencia',subcategory:'aeroespacial'},tries:3,next_at:new Date(Date.now()+3600000).toISOString()});
    await admin`update blog_worker.captured_document set captured_at=now()-interval '1 minute' where candidate_id=${primary.id}`;
    await admin`update blog_worker.candidate set artifact=jsonb_set(artifact,'{research,at}',to_jsonb((now()-interval '10 seconds')::text)) where id=${primary.id}`;
    await store.ingest(other);let reads=0;
    const result=await store.prepareAutomaticResearch(auto,{read:async()=>{reads++;throw Error('must not fetch in backoff');}});
    assert.equal(result.prepared,1);assert.equal(reads,0);
    const [d]=await admin`select assessment from blog_worker.dossier_version where candidate_id=${primary.id}`;assert.equal(d.assessment.comparison_verified,false);
  });
  await check('editors can correct a compared topic before writing, requiring a new comparison and preserving the later lock',async()=>{
    await reset();await operator.attestSubscription(subscription());await store.ingest(candidate());await googleDossier(false);
    const first=await store.reserveComparison({...googleOptions(),candidateId:candidate().id});
    await store.finish(first,{outcome:'completed',text:JSON.stringify({claims:dossierFixture(3).claims}),usage:googleUsage});
    const editorial=loadCms(editorClient,'lib/blog/dossier.ts');
    const [v]=await admin`select * from blog_worker.dossier_version order by revision desc limit 1`;
    const category=v.document.category==='ciencia'?'tecnologia':'ciencia';
    assert.equal(await editorial.saveDossierScope('test-editor',candidate().id,v.revision,{event_key:v.document.event_key,category,subcategory:null},'Correct headline focus before writing'),true);
    const [fresh]=await admin`select * from blog_worker.dossier_version order by revision desc limit 1`;
    assert.equal(fresh.document.claims.length,0);assert.equal(fresh.reviewed_by,null);
    assert.equal((await store.reserve({...googleOptions(),candidateId:candidate().id})).status,'idle');
    const second=await store.reserveComparison({...googleOptions(),candidateId:candidate().id});
    await store.finish(second,{outcome:'completed',text:JSON.stringify({claims:dossierFixture(3).claims}),usage:googleUsage});
    const writing=await store.reserve({...googleOptions(),candidateId:candidate().id});
    const result=await store.finish(writing,{...googleCompleted,usage:googleUsage});assert.equal(result.status,'draft');
    const [last]=await admin`select * from blog_worker.dossier_version order by revision desc limit 1`;
    await assert.rejects(()=>editorial.saveDossierScope('test-editor',candidate().id,last.revision,{event_key:last.document.event_key,category:v.document.category,subcategory:v.document.subcategory},'Cannot change a written article topic'),/topic_locked_after_start/);
    assert.equal((await admin`select count(*)::int as n from blog_worker.post_review`)[0].n,0);
  });
  const hybridPolicy={...googlePolicy,automatic_explainers_enabled:true,explainer_after_local_hour:10,operator_commands_only:false};
  const hybridOptions=()=>({...googleOptions(),policy:hybridPolicy});
  const hybridAt=()=>{const at=new Date();if(at.getUTCHours()<13)at.setUTCHours(15,0,0,0);return at;};
  await check('already researched topics reach their hybrid fallback before another short news pair can starve them',async()=>{
    await reset();await operator.attestSubscription(subscription());
    const sources=[{...source,id:'SRC01',url:'https://www.nasa.gov/news-release/feed/',article_hosts:['www.nasa.gov'],editoria:'ciencia-espaco'},
      {...source,id:'REF27',url:'https://www.space.com/feeds/all',article_hosts:['www.space.com'],editoria:'ciencia-espaco'}];
    await store.syncPipeline({policy:hybridPolicy,sources,catalog:[]},{});
    const date=new Date().toISOString(),short='Synthetic NASA report DOI 10.1234/hybrid-priority. This synthetic space source tests context completion and does not describe a real event. Primary evidence and independent coverage need checking before any generation.';
    const a=normalizeItem({title:'Synthetic NASA hybrid priority',link:'https://www.nasa.gov/hybrid-priority/',isoDate:date,contentSnippet:short},sources[0],new Date());
    const b=normalizeItem({title:'Synthetic independent hybrid coverage',link:'https://www.space.com/hybrid-priority/',isoDate:date,contentSnippet:'Independent context. '+short},sources[1],new Date());
    await store.ingest(a);await store.ingest(b);await store.researchProgress(a.id,{stage:'research_independent_missing',topic:{category:'ciencia',subcategory:'aeroespacial'},tries:1,next_at:new Date(Date.now()+3600000).toISOString()});
    const fresh=new Store(runtime);let fallback=0,reads=0;
    fresh.prepareAutomaticExplainer=async(_,options)=>{fallback++;assert.ok(options.plans.some(p=>p.subcategory==='aeroespacial'));return {prepared:1,kind:'explainer'};};
    const result=await fresh.prepareAutomaticResearch(hybridPolicy,{at:hybridAt(),read:async()=>{reads++;throw Error('News must not preempt the approved fallback');}});
    assert.deepEqual(result,{prepared:1,kind:'explainer'});assert.equal(fallback,1);assert.equal(reads,0);
    assert.equal((await admin`select count(*)::int as n from blog_worker.attempt`)[0].n,0);
  });
  const smallHybridUsage={input_tokens:100,output_tokens:100,thinking_tokens:0,cache_read_tokens:0,total_tokens:200};
  function guide(plan,url){
    const r=referenceForUrl(url),src=articleSource(r),text='🛰️ Guia sintético de '+r.publisher+'. '+('Contexto inicial sem relação com a seção seguinte. '.repeat(80))
      +'O mecanismo sintético '+plan.key+' organiza dados em uma estrutura documentada. '
      +'O método tem limites explícitos e depende do contexto. '+('Este é material sintético de teste, sem afirmações reais. '.repeat(20));
    return {source_id:src.id,url,title:'Guia público sintético de '+r.publisher,text,published_at:'2015-03-01T12:00:00Z',content_hash:hash(text),rights_reference:src.rights_reference,extraction_method:'public_article',extraction_version:ARTICLE_EXTRACTION_VERSION,checked_at:new Date().toISOString()};
  }
  const fakeGuideReader=plan=>async(url,budget)=>{budget.used+=1;return guide(plan,url);};
  function hybridClaims(d){
    const quote=d.documents[0].text.match(/O mecanismo sintético [^.]+\./)?.[0]??'O método tem limites explícitos e depende do contexto.';
    if(d.previous_critical_claims?.length)return d.previous_critical_claims.map(c=>({...c,critical:true,cells:d.documents.map(x=>({document_id:x.id,status:'supports',quote:c.id==='C2'?'O método tem limites explícitos e depende do contexto.':quote,note:'Material sintético para reavaliar todos os fatos críticos anteriores.'}))}));
    return [{id:'C1',text:'O mecanismo do conceito está documentado nas duas referências sintéticas.',critical:true,cells:d.documents.map(x=>({document_id:x.id,status:'supports',quote,note:'Material sintético para verificar o fluxo.'}))}];
  }
  async function compareHybrid(id){
    const [v]=await admin`select document from blog_worker.dossier_version where candidate_id=${id} order by revision desc limit 1`;
    const r=await store.reserveComparison({...hybridOptions(),candidateId:id});assert.equal(r.status,'reserved');
    return store.finish(r,{outcome:'completed',text:JSON.stringify({claims:hybridClaims(v.document)}),usage:smallHybridUsage});
  }
  const hybridText={title:'Como funciona o conceito documentado nas referências',excerpt:'Este explicativo apresenta um mecanismo e seus limites a partir de duas referências independentes.',seoTitle:'Entenda um mecanismo documentado',seoDescription:'Conheça o mecanismo explicado em referências independentes e os limites que precisam acompanhar sua interpretação.',paragraphs:[
    {text:'O conceito descreve uma maneira de organizar informações em uma estrutura cujo funcionamento é documentado pelas referências.',sourceIds:['E1','E2'],claimIds:['C1']},
    {text:'A explicação deve ser interpretada dentro do contexto apresentado pelos autores e exige atenção às limitações do método.',sourceIds:['E1','E2'],claimIds:['C1']} ]};
  async function writeHybrid(id){const r=await store.reserve({...hybridOptions(),candidateId:id});assert.equal(r.status,'reserved');return store.finish(r,{outcome:'completed',text:JSON.stringify(hybridText),usage:smallHybridUsage});}
  await check('hybrid window and pause prevent source reads before planning; the shipped policy remains disabled',async()=>{
    await reset();let reads=0;const read=async()=>{reads++;throw Error('must not read');};
    const before=new Date('2026-11-12T12:59:59Z');assert.equal(await store.prepareAutomaticExplainer(hybridPolicy,{read,at:before}),null);
    await admin`update blog_worker.control set paused=true`;assert.equal(await store.prepareAutomaticExplainer(hybridPolicy,{read,at:hybridAt()}),null);
    assert.equal(reads,0);assert.equal((await admin`select count(*)::int as n from blog_worker.candidate`)[0].n,0);
  });
  await check('explanatory guides keep original dates, enforce a genuine shared subject and attach a credited private cover',async()=>{
    await reset();await operator.attestSubscription(subscription());const plan={...explainerCatalog[0],terms:['mecanismo','limites']};
    const result=await store.prepareAutomaticExplainer(hybridPolicy,{plans:[plan],read:fakeGuideReader(plan),at:hybridAt()});assert.equal(result.prepared,1);
    const id=explainerId(plan),[v]=await admin`select document from blog_worker.dossier_version where candidate_id=${id}`;
    assert.ok(v.document.documents.every(d=>!d.same_event&&d.same_subject&&d.published_at.startsWith('2015')&&d.excerpt_offset>0));
    assert.equal((await compareHybrid(id)).status,'comparison_ready');const written=await writeHybrid(id);assert.equal(written.status,'draft');
    const image=await store.reserveImage({...hybridOptions(),candidateId:id});assert.equal((await store.finish(image,{outcome:'completed',image:webpFixture(),usage:smallHybridUsage})).status,'cover_ready');
    const post=await cms.getAdminPost(written.post_id);assert.match(post.body,/Artigo explicativo/);assert.match(post.body,/2015-03-01/);assert.match(post.body,/consulta em/);assert.equal(post.status,'draft');assert.equal(await cms.getPublicPost(post.slug),null);
    assert.equal((await store.prepareAutomaticExplainer(hybridPolicy,{plans:[plan],read:async()=>assert.fail('topic already filled'),at:hybridAt()})),null);
    const dashboard=await loadCms(cmsClient,'lib/blog/pipeline.ts').getPipelineDashboard();assert.equal(dashboard.production.reduce((n,t)=>n+t.explainers,0),1);assert.equal(dashboard.production.reduce((n,t)=>n+t.complete,0),1);
  });
  await check('fresh context recovers one factual rejection without resetting receipts, attempt caps or publication review',async()=>{
    await reset();await operator.attestSubscription(subscription());const plan={...explainerCatalog[0],terms:['mecanismo','limites']},id=explainerId(plan);
    await store.prepareAutomaticExplainer(hybridPolicy,{plans:[plan],read:fakeGuideReader(plan),at:hybridAt()});
    const [v]=await admin`select document from blog_worker.dossier_version where candidate_id=${id}`;
    const claims=hybridClaims(v.document);claims.push({id:'C2',text:'O método sintético depende do contexto e tem limites explícitos.',critical:true,cells:v.document.documents.map(d=>({document_id:d.id,status:'supports',quote:'O método tem limites explícitos e depende do contexto.',note:'Limites sintéticos do método.'}))});
    claims[1].cells[1]={...claims[1].cells[1],status:'not_mentioned',quote:''};
    const first=await store.reserveComparison({...hybridOptions(),candidateId:id});
    const rejected=await store.finish(first,{outcome:'completed',text:JSON.stringify({claims}),usage:smallHybridUsage});
    assert.equal(rejected.status,'comparison_ready');assert.equal(rejected.reason,'critical_fact_unresolved');
    assert.equal(await store.nextAutomaticWork(hybridPolicy),null);
    const [rejectedVersion]=await admin`select * from blog_worker.dossier_version where candidate_id=${id} order by revision desc limit 1`;
    const metadataOnly=structuredClone(rejectedVersion.document);metadataOnly.claims=[];metadataOnly.documents[0].capture_id='different-capture';metadataOnly.documents[0].consulted_at=new Date().toISOString();
    assert.equal((await runtime`select blog_worker.prepare_automatic_research(${id},${runtime.json(metadataOnly)},${rejectedVersion.source_hash}) as prepared`)[0].prepared,false);
    const unchanged=await store.prepareAutomaticExplainer(hybridPolicy,{plans:[plan],read:async()=>assert.fail('fresh cache is sufficient'),at:hybridAt()});
    assert.equal(unchanged.reason,'research_evidence_unchanged');
    assert.equal((await admin`select count(*)::int as n from blog_worker.dossier_version where candidate_id=${id}`)[0].n,2);
    await admin`update blog_worker.candidate set artifact=null where id=${id}`;
    const updated={...plan,urls:plan.urls.map(url=>url+'?expanded=1')};
    const result=await store.prepareAutomaticExplainer(hybridPolicy,{plans:[updated],read:async(url,budget)=>{budget.used++;const doc=guide(updated,url);doc.text+=' Novo contexto sintético com limitações documentadas.';doc.content_hash=hash(doc.text);return doc;},at:hybridAt()});
    assert.equal(result.prepared,1,JSON.stringify(result));assert.equal((await store.nextAutomaticWork(hybridPolicy)).method,'reserveComparison');
    const [latest]=await admin`select * from blog_worker.dossier_version where candidate_id=${id} order by revision desc limit 1`;
    assert.equal(latest.revision,3);assert.equal(latest.actor_id,'automatic_research_recovery');assert.equal(latest.reviewed_by,null);
    const repeated=await store.reserveComparison({...hybridOptions(),candidateId:id});
    const completeClaims=hybridClaims(latest.document),omittedClaims=completeClaims.slice(0,1);
    const forgedAssessment=assessDossier({...latest.document,claims:omittedClaims},{comparisonVerified:true});
    await assert.rejects(()=>admin.begin(async tx=>{
      await tx`update blog_worker.attempt set state='confirmed' where id=${repeated.id}`;
      await tx`select blog_worker.record_assisted_comparison(${id},${repeated.id},${tx.json(omittedClaims)},${tx.json(forgedAssessment)})`;
    }),/critical_fact_omitted/);
    assert.equal((await store.finish(repeated,{outcome:'completed',text:JSON.stringify({claims:completeClaims}),usage:smallHybridUsage})).status,'comparison_ready');
    const written=await writeHybrid(id);assert.equal(written.status,'draft');
    assert.equal((await admin`select count(*)::int as n from blog_worker.attempt where candidate_id=${id}`)[0].n,3);
    assert.equal((await admin`select count(*)::int as n from blog_worker.post_review`)[0].n,0);
    await assert.rejects(()=>admin`update public.blog_post set status='published',published_at=now() where id=${written.post_id}`,/blog_factual_review_required/);
    assert.equal((await store.summary()).usage.charged_micro_usd,'0');
  });
  await check('one real guide URL can back distinct questions while news URL uniqueness and repeated critical-content holds survive',async()=>{
    await reset();await operator.attestSubscription(subscription());const first={...explainerCatalog[0],terms:['mecanismo','limites']};
    assert.equal((await store.prepareAutomaticExplainer(hybridPolicy,{plans:[first],read:fakeGuideReader(first),at:hybridAt()})).prepared,1);
    assert.equal((await compareHybrid(explainerId(first))).status,'comparison_ready');assert.equal((await writeHybrid(explainerId(first))).status,'draft');
    const cover=await store.reserveImage({...hybridOptions(),candidateId:explainerId(first)});await store.finish(cover,{outcome:'completed',image:webpFixture(),usage:smallHybridUsage});
    const next={...first,key:first.key+'-different',subcategory:'neurociencia',question:'Como uma outra pergunta sintética aborda o mecanismo já utilizado?'};
    assert.equal((await store.prepareAutomaticExplainer(hybridPolicy,{plans:[next],read:async()=>assert.fail('reuse a fresh captured guide'),at:hybridAt()})).prepared,1);
    assert.equal((await compareHybrid(explainerId(next))).reason,'explainer_overlap');assert.equal(await store.nextAutomaticWork(hybridPolicy),null);
    assert.equal((await admin`select count(*)::int as n from public.blog_post`)[0].n,1);
    const primaryUrl=first.urls[0];let news={...candidate(66),url:primaryUrl,id:hash(primaryUrl),guid:hash(primaryUrl)};await store.ingest(news);
    assert.equal((await store.researchCandidate(primaryUrl)).id,news.id);
    assert.equal((await admin`select count(*)::int as n from blog_worker.candidate where url=${primaryUrl}`)[0].n,3);
    await assert.rejects(()=>admin`insert into blog_worker.candidate(id,source_id,guid,url,event_key,title,editoria,score,published_at,evidence,evidence_hash,status) select ${'c'.repeat(64)},source_id,${'d'.repeat(64)},url,${'e'.repeat(64)},title,editoria,score,published_at,evidence,evidence_hash,status from blog_worker.candidate where id=${news.id}`,e=>e.code==='23505');
  });
  await check('database checks explanatory excerpts, subject flags and source dates independently of the caller',async()=>{
    await reset();await operator.attestSubscription(subscription());const plan={...explainerCatalog[0],terms:['mecanismo','limites']};
    await store.prepareAutomaticExplainer(hybridPolicy,{plans:[plan],read:fakeGuideReader(plan),at:hybridAt()});const id=explainerId(plan);
    const [original]=await admin`select document,source_hash from blog_worker.dossier_version where candidate_id=${id}`;
    // Only this disposable test dossier in our newly-created temporary cluster.
    await admin`delete from blog_worker.dossier_version where candidate_id=${id}`;
    for(const mutation of [d=>{d.documents[0].excerpt_offset++;},d=>{d.documents[0].same_subject=false;},d=>{d.documents[0].published_at='2026-11-12T12:00:00Z';},d=>{d.documents[0].consulted_at=new Date(Date.now()-172800000).toISOString();}]){
      const d=structuredClone(original.document);mutation(d);
      await assert.rejects(()=>runtime`select blog_worker.prepare_automatic_research(${id},${runtime.json(d)},${original.source_hash})`,/unapproved_research_snapshot/);
    }
    const [result]=await runtime`select blog_worker.prepare_automatic_research(${id},${runtime.json(original.document)},${original.source_hash}) as prepared`;assert.equal(result.prepared,true);
    assert.equal((await admin`select count(*)::int as n from blog_worker.attempt`)[0].n,0);
  });
  await check('hybrid comparison and text share the same hard call cap and never publish without final review',async()=>{
    await reset();await operator.attestSubscription(subscription());const plan={...explainerCatalog[0],terms:['mecanismo','limites']};
    await store.prepareAutomaticExplainer(hybridPolicy,{plans:[plan],read:fakeGuideReader(plan),at:hybridAt()});const id=explainerId(plan);
    await compareHybrid(id);await assert.rejects(()=>store.reserve({...hybridOptions(),policy:{...hybridPolicy,google_daily_calls_cap:1},candidateId:id}),/google_call_limit/);
    const result=await writeHybrid(id);assert.equal(result.status,'draft');await assert.rejects(()=>admin`update public.blog_post set status='published',published_at=now() where id=${result.post_id}`,/blog_factual_review_required/);
    assert.equal((await store.summary()).usage.charged_micro_usd,'0');
  });
  await check('four news stories and six explainers fill ten distinct daily slots with credited covers and zero provider charges',async()=>{
    await reset();await operator.attestSubscription(subscription());let invocations=0;
    const newsKeys=new Set(['ciencia/geral','ciencia/aeroespacial','tecnologia/ia','tecnologia/software-ferramentas']);
    for(const [i,original] of explainerCatalog.slice(0,10).entries()){
      const plan={...original,terms:['mecanismo','limites']};let id;
      if(newsKeys.has(topicKey(plan))){
        const c=candidate(100+i);id=c.id;await store.ingest(c);
        const document={...dossierFixture(1),event_key:'mixed-news-'+i,category:plan.category,subcategory:plan.subcategory};document.documents=document.documents.map(d=>({...d,url:d.url+i,origin_url:d.origin_url+i}));
        await admin`insert into blog_worker.dossier_version(candidate_id,revision,document,document_hash,assessment,actor_id,source_hash,change_reason) values(${id},1,${admin.json(document)},${dossierHash(document)},${admin.json(assessDossier(document))},'test-editor',${c.evidence_hash},'Synthetic mixed editorial fixture')`;
        const r=await store.reserveComparison({...hybridOptions(),candidateId:id});await store.finish(r,{outcome:'completed',text:JSON.stringify({claims:document.claims}),usage:smallHybridUsage});
        const text=await store.reserve({...hybridOptions(),candidateId:id});assert.equal((await store.finish(text,{...googleCompleted,usage:smallHybridUsage})).status,'draft');
      }else{
        assert.equal((await store.prepareAutomaticExplainer(hybridPolicy,{plans:[plan],read:fakeGuideReader(plan),at:hybridAt()})).prepared,1);id=explainerId(plan);
        assert.equal((await compareHybrid(id)).status,'comparison_ready');assert.equal((await writeHybrid(id)).status,'draft');
      }
      const image=await store.reserveImage({...hybridOptions(),candidateId:id});assert.equal((await store.finish(image,{outcome:'completed',image:webpFixture(),usage:smallHybridUsage})).status,'cover_ready');invocations+=3;
    }
    const dashboard=await loadCms(cmsClient,'lib/blog/pipeline.ts').getPipelineDashboard();
    assert.equal(dashboard.production.reduce((n,t)=>n+t.complete,0),10);assert.equal(dashboard.production.reduce((n,t)=>n+t.news,0),4);assert.equal(dashboard.production.reduce((n,t)=>n+t.explainers,0),6);
    assert.ok(dashboard.production.every(t=>t.drafts===1&&t.complete===1));assert.equal(invocations,30);assert.equal((await store.summary()).usage.charged_micro_usd,'0');
    assert.equal((await admin`select count(*)::int as n from public.blog_post where status<>'draft' or not seo_noindex`)[0].n,0);
  });
  await check('dated allowance completes six missing topics after 34 calls while retaining ten private drafts and real reservations',async()=>{
    await reset();await operator.attestSubscription(subscription());
    for(const index of [2,5,7,9]){
      const plan={...explainerCatalog[index],terms:['mecanismo','limites']};
      assert.equal((await store.prepareAutomaticExplainer(hybridPolicy,{plans:[plan],read:fakeGuideReader(plan),at:hybridAt()})).prepared,1);
      const id=explainerId(plan);await compareHybrid(id);await writeHybrid(id);
      const image=await store.reserveImage({...hybridOptions(),candidateId:id});await store.finish(image,{outcome:'completed',image:webpFixture(),usage:smallHybridUsage});
    }
    for(let i=0;i<22;i++)await admin`insert into blog_worker.operator_event(actor_id,action,target,detail) values('test-completion','google_diagnostic_usage',${String(i)},${admin.json({quota_used:i===0?4276:4228})})`;
    const completionPolicy={...hybridPolicy,google_daily_completion:{day:periodKeys(new Date()).day,calls_cap:60,tokens_reserved_per_call:30000,authorization_reference:'Explicit synthetic allowance to complete todays batch'}};
    for(const [i,original] of explainerCatalog.slice(30,36).entries()){
      const plan={...original,terms:['mecanismo','limites']};
      assert.equal((await store.prepareAutomaticExplainer(completionPolicy,{plans:[plan],read:fakeGuideReader(plan),at:hybridAt()})).prepared,1);
      const id=explainerId(plan),options={...hybridOptions(),policy:completionPolicy,candidateId:id};
      if(i===2)await assert.rejects(()=>store.reserveComparison({...options,policy:hybridPolicy}),/google_call_limit/);
      const [v]=await admin`select document from blog_worker.dossier_version where candidate_id=${id} order by revision desc limit 1`;
      const comparison=await store.reserveComparison(options);assert.equal((await store.finish(comparison,{outcome:'completed',text:JSON.stringify({claims:hybridClaims(v.document)}),usage:smallHybridUsage})).status,'comparison_ready');
      const writing=await store.reserve(options);assert.equal((await store.finish(writing,{outcome:'completed',text:JSON.stringify(hybridText),usage:smallHybridUsage})).status,'draft');
      const image=await store.reserveImage(options);assert.equal((await store.finish(image,{outcome:'completed',image:webpFixture(),usage:smallHybridUsage})).status,'cover_ready');
    }
    const [usage]=await admin`select count(*)::int as calls,count(*) filter(where quota_reserved=30000)::int as completion_calls from blog_worker.attempt`;
    assert.deepEqual(usage,{calls:30,completion_calls:18});
    const [posts]=await admin`select count(*)::int as drafts,count(*) filter(where status<>'draft' or not seo_noindex or scheduled_at is not null)::int as unsafe from public.blog_post`;
    assert.deepEqual(posts,{drafts:10,unsafe:0});
    const dashboard=await loadCms(cmsClient,'lib/blog/pipeline.ts').getPipelineDashboard();assert.ok(dashboard.production.every(t=>t.drafts===1&&t.complete===1));
    assert.equal((await store.summary()).usage.charged_micro_usd,'0');
  });
  await check('optimized dated reservation completes text and cover near the daily ceiling but cannot exceed it',async()=>{
    await reset();await operator.attestSubscription(subscription());
    const plan={...explainerCatalog[0],terms:['mecanismo','limites']};
    await store.prepareAutomaticExplainer(hybridPolicy,{plans:[plan],read:fakeGuideReader(plan),at:hybridAt()});
    const id=explainerId(plan);await compareHybrid(id);
    await admin`insert into blog_worker.operator_event(actor_id,action,target,detail) values('test-completion','google_diagnostic_usage','near-limit',${admin.json({quota_used:163800})})`;
    const completion={day:periodKeys(new Date()).day,calls_cap:80,tokens_reserved_per_call:30000,authorization_reference:'Explicit synthetic allowance with unchanged daily and weekly ceilings'};
    const options={...hybridOptions(),candidateId:id,policy:{...hybridPolicy,google_daily_completion:completion}};
    await assert.rejects(()=>store.reserve(options),/google_token_limit/);
    options.policy.google_daily_completion={...completion,tokens_reserved_per_call:15000};
    const writing=await store.reserve(options);assert.equal(writing.status,'reserved');
    assert.equal((await store.finish(writing,{outcome:'completed',text:JSON.stringify(hybridText),usage:smallHybridUsage})).status,'draft');
    const image=await store.reserveImage(options);assert.equal(image.status,'reserved');
    assert.equal((await store.finish(image,{outcome:'completed',image:webpFixture(),usage:smallHybridUsage})).status,'cover_ready');
    await admin`insert into blog_worker.operator_event(actor_id,action,target,detail) values('test-completion','google_diagnostic_usage','hard-limit',${admin.json({quota_used:1000})})`;
    await assert.rejects(()=>store.checkResearchBudget(options.policy),/google_token_limit/);
    const [ledger]=await admin`select count(*)::int as n from blog_worker.attempt where quota_reserved=15000`;
    assert.equal(ledger.n,2);
    const [post]=await admin`select status,seo_noindex,scheduled_at from public.blog_post`;
    assert.deepEqual(post,{status:'draft',seo_noindex:true,scheduled_at:null});
  });
  await check('CLI once, status and healthcheck use only the isolated DB with shipped generation off',async()=>{
    await reset();const health=join(directory,'health.json');
    const env={PATH:process.env.PATH,TMPDIR:directory,BLOG_LOCAL_TEST:'1',BLOG_DATABASE_URL:`postgres://blog_runtime@127.0.0.1:${port}/postgres`,BLOG_HEALTH_FILE:health};
    const cli=(...args)=>spawnSync(process.execPath,['src/cli.mjs',...args],{cwd:new URL('../',import.meta.url),env,encoding:'utf8',timeout:10000});
    const once=cli('once');assert.equal(once.status,0);const state=JSON.parse(once.stdout);
    assert.equal(state.alive,true);assert.equal(state.generation.reason,'generation_disabled');assert.equal(state.collection.sources,0);
    assert.equal(JSON.parse(await readFile(health,'utf8')).generation.reason,'generation_disabled');assert.equal(cli('healthcheck').status,0);
    assert.equal(JSON.parse(cli('status').stdout).usage.attempts,0);
    const migration=cli('migrate');assert.equal(migration.status,1);assert.equal(JSON.parse(migration.stderr).reason,'explicit_execution_required');
  });
  console.log(JSON.stringify({status:'passed',integration_checks:passed,database:'isolated_native_postgresql',provider_calls:0}));
}catch(error){
  // Fixtures only. Still avoid dumping full SQL/connection objects.
  console.error(error.stack??error.message);process.exitCode=1;
}finally{
  for(const sql of [editorClient,cmsClient,other,runtime,admin])if(sql)await sql.end({timeout:5});
  if(started)pg('pg_ctl',['-D',data,'-m','fast','-w','stop']);
}
