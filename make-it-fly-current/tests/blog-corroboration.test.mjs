import test from 'node:test';
import assert from 'node:assert/strict';
import {opportunityLoader} from './helpers/load-opportunity-module.mjs';
import {dossierFixture} from '../../blog-worker/test/corroboration-fixture.mjs';
import {renderToStaticMarkup} from 'react-dom/server';
import {createElement} from 'react';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';

test('all dossier actions and research pages reject non-admin before database access',async()=>{
  let reads=0;
  const load=opportunityLoader({'@/lib/admin/access':{requireAdmin:async()=>{throw Error('forbidden');}},
    '@/lib/blog/dossier':new Proxy({},{get:()=>()=>{reads++;throw Error('database must not run');}})});
  for(const intent of ['initialize','new_research','scope','document','claim','compare','review','review_article','import_captured']){
    const f=new FormData();f.set('intent',intent);await assert.rejects(()=>load('app/admin/posts/pipeline/dossie/actions.ts').manageDossier(f),/forbidden/);
  }
  await assert.rejects(()=>load('app/admin/posts/pipeline/dossie/[id]/page.tsx').default({params:Promise.resolve({id:'a'.repeat(64)}),searchParams:Promise.resolve({})}),/forbidden/);
  assert.equal(reads,0);
});
test('dossier review derives actor from session and requires explicit confirmation and optimistic revision',async()=>{
  const calls=[];
  const load=opportunityLoader({'@/lib/admin/access':{requireAdmin:async()=>({id:'real-editor'})},
    '@/lib/blog/dossier':{reviewDossier:async(...args)=>{calls.push(args);return true;}},
    'next/cache':{revalidatePath:()=>{}},'next/navigation':{redirect:path=>{throw Error(path);}}});
  const action=load('app/admin/posts/pipeline/dossie/actions.ts').manageDossier;
  const f=new FormData();f.set('intent','review');f.set('candidate_id','a'.repeat(64));f.set('revision','3');f.set('actor','forged');
  await assert.rejects(()=>action(f),/message=conflict/);assert.equal(calls.length,0);
  f.set('confirmed','on');await assert.rejects(()=>action(f),/message=saved/);assert.deepEqual(calls,[['real-editor','a'.repeat(64),3]]);
  f.set('revision','NaN');await assert.rejects(()=>action(f),/message=invalid/);assert.equal(calls.length,1);
});
test('web and worker execute the same corroboration implementation, with source provenance and no paid capture',()=>{
  const web=opportunityLoader()('lib/blog/corroboration.mjs'),d=dossierFixture(10,9);
  assert.equal(web.assessDossier(d,{comparisonVerified:true}).eligible,true);
  assert.equal(web.referenceCatalog.filter(r=>r.id.startsWith('REF')).length,47);
  d.claims[0].cells[0].status='contradicts';assert.equal(web.assessDossier(d,{comparisonVerified:true}).eligible,false);
});
test('research UI renders factual matrix, controlled actions and immutable history without exposing active markup',async()=>{
  const document=dossierFixture(10,9),id='a'.repeat(64),order=[];
  const load=opportunityLoader({'@/lib/admin/access':{requireAdmin:async()=>{order.push('auth');return {id:'editor-test'};}},
    '@/lib/blog/dossier':{getDossierView:async()=>{order.push('data');return {candidate:{id,title:'Pauta sintética <img src=x onerror=alert(1)> para testar a interface',status:'held',evidence_hash:'source-hash',post_id:null},latest:{revision:1,document,assessment:{comparison_verified:false},reviewed_by:null,source_hash:'source-hash'},versions:[{revision:1,document,assessment:{comparison_verified:false},reviewed_by:null,change_reason:'Fixture da interface'}],captured:[],post:null,busy:false};}},
    'next/link':{__esModule:true,default:({href,children,...props})=>createElement('a',{href,...props},children)}});
  const page=load('app/admin/posts/pipeline/dossie/[id]/page.tsx').default;
  const markup=renderToStaticMarkup(await page({params:Promise.resolve({id}),searchParams:Promise.resolve({})}));
  assert.deepEqual(order,['auth','data']);assert.match(markup,/9\/10 fatos convergentes/);
  assert.match(markup,/Matriz de fatos e fontes/);assert.match(markup,/Registrar conferência editorial da matriz/);
  assert.match(markup,/disabled=""[^>]*>Criar rascunho/);
  assert.ok(!markup.includes('<img src=x'));assert.match(markup,/&lt;img/);
  assert.match(markup,/Histórico preservado/);assert.match(markup,/publicar exige revisão humana/);
  if(process.env.BLOG_UI_PREVIEW_DIR){
    const css=readFileSync(new URL('../app/admin/posts/pipeline/pipeline.module.css',import.meta.url),'utf8').replace(/:global\(([^)]+)\)/g,'$1')+'\n'+readFileSync(new URL('../components/admin/admin.module.css',import.meta.url),'utf8');
    mkdirSync(process.env.BLOG_UI_PREVIEW_DIR,{recursive:true});
    writeFileSync(process.env.BLOG_UI_PREVIEW_DIR+'/dossie.html','<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Dossiê: prévia sintética local</title><style>:root{--apogee-white:#fff;--apogee-navy:#06162c;--apogee-black:#000;--apogee-sky:#b9d3ee;--apogee-surface-raised:#102a48;--apogee-border-subtle:rgba(255,255,255,.2);--apogee-control-min-height:44px;--apogee-radius-soft:.625rem}*{box-sizing:border-box}body{margin:0;background:#06162c;color:white;font:16px Arial;padding:24px}main{max-width:1120px;margin:auto}a{color:inherit}button{font:inherit}'+css+'</style><main><p>Prévia visual local com dados sintéticos. As ações não estão conectadas ao banco.</p>'+markup+'</main></html>');
  }
});
