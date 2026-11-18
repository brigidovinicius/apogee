import test from 'node:test';
import assert from 'node:assert/strict';
import {opportunityLoader} from './helpers/load-opportunity-module.mjs';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';

test('pipeline page and every action require administrator before database access',async()=>{
  let writes=0;
  const load=opportunityLoader({'@/lib/admin/access':{requireAdmin:async()=>{throw Error('forbidden');}},
    '@/lib/blog/pipeline':new Proxy({}, {get:()=>()=>{writes++;throw Error('database must not run');}}),
    'next/cache':{revalidatePath:()=>{}},'next/navigation':{redirect:()=>{}}});
  const action=load('app/admin/posts/pipeline/actions.ts').managePipeline;
  for(const intent of ['collect','generate','source','pause','resume','hold','release','cover','apply_cover']){
    const f=new FormData();f.set('intent',intent);await assert.rejects(()=>action(f),/forbidden/);
  }
  await assert.rejects(()=>load('app/admin/posts/pipeline/page.tsx').default({searchParams:Promise.resolve({})}),/forbidden/);
  assert.equal(writes,0);
});

test('admin consumption explains free-credit caps, scope and Google fallback without claiming a live balance',async()=>{
  const now=new Date(),snapshot={provider:'google_subscription',generation_enabled:true,images_enabled:true,operator_commands_only:false,
    daily_calls_cap:40,weekly_calls_cap:280,daily_tokens_cap:180000,weekly_tokens_cap:900000,per_day:10,per_week:70,
    model:'gemini-3.8-flash-low',image_model:'antigravity_generate_image',account_email:'synthetic@example.test',
    renewable_explainers:true,automatic_publication:{enabled:true,starts_on:'2026-11-17',first_hour:10,last_hour:19,catch_up_enabled:true},
    operation:{at:now.toISOString(),generation:{status:'idle',reason:'waiting_for_evidence'},research:{reason:'reference_captured'},publication:{status:'idle'}},
    openai:{enabled:true,eligible:false,reason:'openai_circuit_open',cycle_cap:5000000,daily_cap:250000,model:'gpt-6-luna'}};
  const data={control:{paused:false,reason:null,snapshot,heartbeat_at:now,alive:true},total:0,totalPosts:0,production:[],sources:[],candidates:[],commands:[],attempts:[],counts:[],explainers:[],
    research_ready:true,multisource_ready:true,topicUsage:[],quotaObservations:[],googleAccess:{valid:true,state:'valid',succeeded_at:now,valid_until:now,next_check_at:now},
    subscription:{account_email:'synthetic@example.test',plan:'google_ai_pro',valid:true,verified_at:now,valid_until:now},
    quota:{day_calls:20,week_calls:20,day_tokens:'1000',week_tokens:'1000',held:'0'},usage:{charged:'350',held:'2500',day:'2850',cycle:'2850'},
    benefit:{amount:'100000000',remaining:'100000000',expires_at:now,verified_at:now,shared:true,hard_limit:'10000000',margin:'20000000'}};
  const load=opportunityLoader({'@/lib/admin/access':{requireAdmin:async()=>({id:'test-editor'})},
    '@/lib/blog/pipeline':{getPipelineDashboard:async()=>data},
    'next/link':{__esModule:true,default:({href,children,...props})=>createElement('a',{href,...props},children)}});
  const markup=renderToStaticMarkup(await load('app/admin/posts/pipeline/page.tsx').default({searchParams:Promise.resolve({})}));
  assert.match(markup,/Recuperação de atraso autorizada/);assert.match(markup,/intervalo mínimo passa a 15 minutos/);
  assert.match(markup,/Última execução/);assert.match(markup,/Nova referência pública capturada/);assert.match(markup,/reposição automática descobre novos assuntos/);
  assert.match(markup,/OpenAI e retorno automático ao Google/);assert.match(markup,/inclusive o Radar/);
  assert.match(markup,/não a uma consulta ao vivo/);assert.match(markup,/Consumido ou reservado no ciclo/);
  assert.match(markup,/a redação volta ao Google/);assert.match(markup,/API retida; o Google continua/);
  assert.match(markup,/validação mínima é de 90%/);assert.doesNotMatch(markup,/Novas chamadas de API estão desativadas/);
  if(process.env.BLOG_UI_PREVIEW_DIR){
    const start=markup.indexOf('<section id="consumo"'),end=markup.indexOf('</section>',start)+10;
    assert.ok(start>0&&end>start);
    const css=readFileSync(new URL('../app/admin/posts/pipeline/pipeline.module.css',import.meta.url),'utf8').replace(/:global\(([^)]+)\)/g,'$1');
    mkdirSync(process.env.BLOG_UI_PREVIEW_DIR,{recursive:true});
    writeFileSync(process.env.BLOG_UI_PREVIEW_DIR+'/consumo.html',`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Consumo do blog — teste isolado</title><style>body{font:16px system-ui;margin:0;padding:16px;background:#071018;color:#f3f5fa}main{max-width:1100px;margin:auto}a{color:#92cafa}*{box-sizing:border-box}${css}</style><main><p>Prévia privada com dados sintéticos.</p>${markup.slice(start,end)}</main></html>`);
  }
});
test('action ignores forged actor and budgets, validates candidate and only enqueues creation',async()=>{
  const calls=[];
  const load=opportunityLoader({'@/lib/admin/access':{requireAdmin:async()=>({id:'real-admin'})},
    '@/lib/blog/pipeline':{enqueuePipeline:async(...args)=>{calls.push(args);return true;}},
    'next/cache':{revalidatePath:()=>{}},'next/navigation':{redirect:path=>{throw Error(path);}}});
  const action=load('app/admin/posts/pipeline/actions.ts').managePipeline;
  const f=new FormData();f.set('intent','generate');f.set('candidate_id','a'.repeat(64));f.set('actor','forged');f.set('budget','99999');
  await assert.rejects(()=>action(f),/message=queued/);assert.deepEqual(calls,[['real-admin','generate','a'.repeat(64)]]);
  f.set('candidate_id','invalid');await assert.rejects(()=>action(f),/message=invalid/);assert.equal(calls.length,1);
});
test('source approval, HTTPS allowlist, editorial category and prompt byte limit are validated',()=>{
  const {sourceSchema,coverSchema}=opportunityLoader()('lib/blog/pipeline-validation.ts');
  const s={id:'NASA',name:'NASA',editoria:'tecnologia',url:'https://www.nasa.gov/feed/',article_hosts:['www.nasa.gov'],interval_minutes:60,keywords:[],enabled:true,feed_content_approved:true,collection_approval_reference:'editorial-approval',rights_reference:'editorial-license'};
  assert.equal(sourceSchema.safeParse(s).success,true);
  for(const bad of [{url:'http://www.nasa.gov/feed'},{url:'https://evil.test/feed'},{url:'https://name:pass@www.nasa.gov/feed'},{interval_minutes:1},{collection_approval_reference:''},{rights_reference:''}])assert.equal(sourceSchema.safeParse({...s,...bad}).success,false);
  assert.equal(coverSchema.safeParse({candidate_id:'a'.repeat(64),prompt:'é'.repeat(800),alt:'Imagem',caption:'Ilustração gerada por IA.'}).success,false);
});
test('private pending cover returns 401/403 without querying database, admin gets no-store image',async()=>{
  let calls=0,member=null;
  const load=opportunityLoader({'@/lib/members/dal':{getCurrentMember:async()=>member},'@/lib/members/db':{getSql:()=>async()=>{calls++;return [{image:Buffer.from('fixture')}];}}});
  const get=load('app/admin/posts/pipeline/cover/[id]/route.ts').GET;
  const ctx={params:Promise.resolve({id:'a'.repeat(64)})};
  assert.equal((await get(new Request('https://example.test'),ctx)).status,401);
  member={role:'member'};assert.equal((await get(new Request('https://example.test'),ctx)).status,403);assert.equal(calls,0);
  member={role:'admin'};const response=await get(new Request('https://example.test'),ctx);assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal(calls,1);
});
test('SEO/GEO review accepts generated references and rejects unsafe or absent citations',()=>{
  const {sourceReferences,editorialChecks}=opportunityLoader()('lib/blog/editorial-review.ts');
  const body='Texto com referência. [1]\n\nFontes:\n[1] NASA test — https://www.nasa.gov/article/ (2026-11-04)';
  assert.deepEqual(sourceReferences(body),[{title:'NASA test',url:'https://www.nasa.gov/article/'}]);
  assert.deepEqual(sourceReferences(body.replaceAll('\n','\r\n')),sourceReferences(body),'Saving the HTML editor preserves citation recognition');
  assert.deepEqual(sourceReferences(body.replaceAll('\n','\r')),sourceReferences(body));
  for(const url of ['http://nasa.gov/article','javascript:alert(1)','https://user:secret@nasa.gov/article'])assert.equal(sourceReferences(body.replace('https://www.nasa.gov/article/',url)).length,0);
  assert.equal(sourceReferences('Texto sem fontes').length,0);
  for(const suffix of [' (2015-03-01) · consulta em 13/11/2026',' (data de publicação não informada) · consulta em 13/11/2026']){
    assert.deepEqual(sourceReferences(body.replace(' (2026-11-04)',suffix)),[{title:'NASA test',url:'https://www.nasa.gov/article/'}]);
  }
  const checks=editorialChecks({title:'Título informativo',body,seoTitle:'Título de busca',seoDescription:'Descrição de busca',hasCover:true,noIndex:true});
  assert.equal(checks.every(c=>c.ok),true);assert.match(checks.at(-1).label,/bloqueada/);
});
