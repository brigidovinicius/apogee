import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { nativeCommunityDatabase } from "./helpers/community-native-db.mjs";
import { opportunityLoader } from "./helpers/load-opportunity-module.mjs";
import { migrateCommunityAccess } from "../scripts/community-access-migrate.mjs";
import { migrateMemberToolbox } from "../scripts/member-toolbox-migrate.mjs";

let db, sql, load, store, video, image, flow, current="paid", catalogueReads=0;
const invalidated=[];
const originalMode=process.env.STRIPE_MODE;
const form = values => { const data=new FormData();for(const [key,value] of Object.entries(values))if(value!==null&&value!==undefined)data.set(key,String(value));return data; };
const categoryForm = (values={}) => form({name:"Vídeo",description:"Criação e edição em vídeo.",status:"published",order:0,...values});
const toolForm = (values={}) => form({categoryId:video,name:"Google Flow",description:"Criação de vídeos com inteligência artificial.",url:"https://labs.google/fx/tools/flow",status:"published",order:0,reviewed:"on",...values});
async function member() {
  if(!current) throw Error("REDIRECT:/membros/entrar");
  const [row]=await sql`select id,role,blocked from "user" where id=${current}`;
  if(!row || row.blocked) throw Error("REDIRECT:/membros/entrar");
  return {id:row.id,role:row.role,name:"Pessoa Revisora",username:row.id,image:null,nameNeedsConfirmation:false};
}
async function admin() {const actor=await member();if(actor.role!=="admin")throw Error("REDIRECT:/admin/acesso-negado");return actor;}
async function invoice(user,{mode=false,status="paid",subscription="active",cancelled=false,fraud=false,start=-1,end=1}={}) {
  await sql`insert into community_subscription(id,user_id,customer_id,livemode,status,cancel_at_period_end) values(${'sub_'+user},${user},${'cus_'+user},${mode},${subscription},${cancelled})`;
  await sql`insert into community_invoice(id,subscription_id,amount,currency,period_start,period_end,status,fraud_review_required)
    values(${'in_'+user},${'sub_'+user},143880,'brl',${new Date(Date.now()+start*86400000).toISOString()},${new Date(Date.now()+end*86400000).toISOString()},${status},${fraud})`;
}
before(async()=>{
  process.env.STRIPE_MODE="test";
  db=await nativeCommunityDatabase();sql=db.sql;
  await migrateCommunityAccess(sql,{apply:true,expectedRole:"apogee_local"});
  for(const id of ["paid","cancelled","free","legacy","expired","refund","disputed","fraud","future","wrong-mode","unpaid","blocked","admin","former-admin","blocked-admin"]){
    await sql`insert into "user"(id,name,email,email_verified,created_at,updated_at,adult_declared,role,blocked)
      values(${id},'Pessoa Teste',${id+'@example.test'},true,now(),now(),true,${id==='admin'||id==='blocked-admin'?'admin':'member'},${id==='blocked'||id==='blocked-admin'})`;
  }
  await invoice("paid");await invoice("cancelled",{cancelled:true,subscription:"canceled"});
  await invoice("expired",{start:-3,end:-1});await invoice("refund",{status:"refunded"});await invoice("disputed",{status:"disputed"});
  await invoice("fraud",{fraud:true});await invoice("future",{start:1,end:2});await invoice("wrong-mode",{mode:true});await invoice("unpaid",{status:"unpaid"});await invoice("blocked");
  await sql`insert into radar_legacy_access(user_id) values('legacy')`;
  await sql`insert into radar_free_opportunity(user_id,opportunity_id) values('free','previous-choice')`;
  await sql`insert into radar_free_event(user_id,opportunity_id,slot) values('free','event-one',1),('free','event-two',2)`;
  const observedSql=new Proxy(sql,{apply(target,thisArg,args){if(Array.isArray(args[0])&&args[0].join('').includes("member_tool"))catalogueReads++;return Reflect.apply(target,thisArg,args);},get(target,key){return key==='begin'?target.begin.bind(target):Reflect.get(target,key);}});
  load=opportunityLoader({
    "@/lib/members/db":{getSql:()=>observedSql},
    "@/lib/members/dal":{requireMember:member,requireSignedInMember:member,getCurrentMember:member},
    "@/lib/admin/access":{requireAdmin:admin},
    "next/navigation":{redirect:path=>{throw Error('REDIRECT:'+path);},notFound:()=>{throw Error('NOT_FOUND');}},
    "next/cache":{revalidatePath:path=>invalidated.push(path)},
    "@/components/members/member-bar":{MemberBar:()=>null},
    "next/link":{__esModule:true,default:({children,...props})=>{const attrs={...props};delete attrs.prefetch;return React.createElement('a',attrs,children);}},
  });
  store=load("lib/toolbox/store.ts");
});
after(async()=>{if(originalMode===undefined)delete process.env.STRIPE_MODE;else process.env.STRIPE_MODE=originalMode;await db?.close();});

test("additive toolbox migration verifies history, applies once, preserves old rights and accepts the known newer journal",async()=>{
  const before=await sql`select user_id from radar_legacy_access order by user_id`;
  assert.deepEqual(await migrateMemberToolbox(sql,{expectedRole:"apogee_local"}),{changed:false,pending:true});
  await assert.rejects(migrateMemberToolbox(sql,{apply:true,expectedRole:"wrong_role"}),/Papel/);
  assert.deepEqual(await migrateMemberToolbox(sql,{apply:true,expectedRole:"apogee_local"}),{changed:true,pending:false});
  assert.deepEqual(await migrateMemberToolbox(sql,{apply:true,expectedRole:"apogee_local"}),{changed:false,pending:false});
  assert.equal((await migrateCommunityAccess(sql,{expectedRole:"apogee_local"})).pending,false);
  assert.deepEqual(await sql`select user_id from radar_legacy_access order by user_id`,before);
  assert.equal((await sql`select count(*)::integer as n from radar_free_event`)[0].n,2);
  assert.equal((await sql`select count(*)::integer as n from radar_free_opportunity`)[0].n,1);
});
test("curation creates a stable category and requires a real review before publication",async()=>{
  video=await store.writeToolboxCategory("admin",categoryForm());
  image=await store.writeToolboxCategory("admin",categoryForm({name:"Imagem",order:1}));
  await assert.rejects(store.writeToolboxTool("admin",toolForm({reviewed:""})),/conferência/);
  flow=await store.writeToolboxTool("admin",toolForm());
  const [row]=await sql`select status,reviewed_by,reviewed_at,version from member_tool where id=${flow}`;
  assert.equal(row.status,"published");assert.equal(row.reviewed_by,"admin");assert.ok(row.reviewed_at);assert.equal(row.version,1);
  await assert.rejects(store.writeToolboxTool("admin",toolForm()),error=>error.code==="23505");
});
test("only paid annual periods in the correct mode open the catalogue; legacy Radar does not",async()=>{
  for(const id of ["paid","cancelled"]){current=id;const view=await store.memberToolbox();assert.equal(view.access.allowed,true);assert.equal(view.access.source,"annual");assert.equal(view.tools[0].name,"Google Flow");}
  for(const id of ["free","legacy","expired","refund","disputed","fraud","future","wrong-mode","unpaid"]){
    current=id;const before=catalogueReads;const view=await store.memberToolbox("video");assert.equal(view.access.allowed,false,id);assert.deepEqual(view.tools,[]);assert.deepEqual(view.categories,[]);assert.equal(catalogueReads,before,"no catalogue SQL for "+id);
    assert.doesNotMatch(JSON.stringify(view),/labs\.google|Google Flow|Criação e edição/);
  }
  current="admin";assert.equal((await store.memberToolbox()).access.source,"admin");
  for(const id of [null,"blocked","blocked-admin"]){current=id;await assert.rejects(store.memberToolbox(),/REDIRECT:\/membros\/entrar/);}
});
test("member HTML never exposes links to free or legacy accounts and safe external links are explicit",async()=>{
  const Page=load("app/membros/ferramentas/page.tsx").default;
  for(const id of ["free","legacy"]){current=id;const html=renderToStaticMarkup(await Page({searchParams:Promise.resolve({})}));assert.match(html,/Conhecer a assinatura anual/);assert.match(html,/Caixa de ferramentas para assinantes anuais/);assert.match(html,/href="\/membros\/oportunidades"/);assert.doesNotMatch(html,/labs\.google|Google Flow|category-video/);}
  current="paid";const html=renderToStaticMarkup(await Page({searchParams:Promise.resolve({categoria:"video"})}));
  assert.match(html,/Google Flow/);assert.match(html,/target="_blank"/);assert.match(html,/rel="noopener noreferrer"/);assert.match(html,/referrerPolicy="no-referrer"/);assert.match(html,/abre em nova aba/);
  assert.doesNotMatch(html,/reviewed_by|reviewer_name|version=/);
  await assert.rejects(Page({searchParams:Promise.resolve({categoria:"missing"})}),/NOT_FOUND/);
});
test("draft, archived, empty and unpublished-parent categories remain hidden; filtering and ordering are deterministic",async()=>{
  const hidden=await store.writeToolboxCategory("admin",categoryForm({name:"Em revisão",status:"draft"}));
  await store.writeToolboxTool("admin",toolForm({name:"Ferramenta ainda em revisão",url:"https://example.org/review",categoryId:hidden}));
  await store.writeToolboxTool("admin",toolForm({name:"Rascunho privado",url:"https://example.org/draft",status:"draft",reviewed:""}));
  await store.writeToolboxTool("admin",toolForm({name:"Arquivado privado",url:"https://example.org/archived",status:"archived",reviewed:""}));
  await store.writeToolboxTool("admin",toolForm({name:"Segundo recurso",url:"https://example.org/second",order:5}));
  current="paid";let view=await store.memberToolbox();assert.deepEqual(view.categories.map(c=>c.slug),["video"]);assert.deepEqual(view.tools.map(t=>t.name),["Google Flow","Segundo recurso"]);
  assert.equal((await store.memberToolbox("imagem")).tools.length,0);
  await store.writeToolboxCategory("admin",categoryForm({id:video,version:1,name:"Vídeo e edição"}));
  assert.equal((await sql`select slug from member_tool_category where id=${video}`)[0].slug,"video");
  await store.writeToolboxCategory("admin",categoryForm({id:video,version:2,name:"Vídeo e edição",status:"archived"}));
  assert.deepEqual((await store.memberToolbox()).tools,[]);
  await store.writeToolboxCategory("admin",categoryForm({id:video,version:3,name:"Vídeo",status:"published"}));
  assert.equal((await store.memberToolbox()).tools.length,2);
});
test("concurrent edits cannot overwrite each other and content changes require a new review",async()=>{
  const outcomes=await Promise.allSettled([10,20].map(order=>store.writeToolboxCategory("admin",categoryForm({id:image,version:1,name:"Imagem",order}))));
  assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);assert.match(outcomes.find(r=>r.status==='rejected').reason.message,/outra edição/);
  const [before]=await sql`select reviewed_at from member_tool where id=${flow}`;
  await store.writeToolboxTool("admin",toolForm({id:flow,version:1,order:1,reviewed:""}));
  assert.equal(new Date((await sql`select reviewed_at from member_tool where id=${flow}`)[0].reviewed_at).toISOString(),new Date(before.reviewed_at).toISOString());
  await assert.rejects(store.writeToolboxTool("admin",toolForm({id:flow,version:2,name:"Google Flow revisado",reviewed:""})),/conferência/);
  await store.writeToolboxTool("admin",toolForm({id:flow,version:2,name:"Google Flow revisado",reviewed:"on"}));
  await assert.rejects(store.writeToolboxTool("admin",toolForm({id:flow,version:2})),/outra edição/);
});
test("administrative reads, Server Actions and the writer reject ordinary, revoked and blocked administrators",async()=>{
  for(const id of ["free","legacy","former-admin","blocked-admin"]){
    current=id;await assert.rejects(store.adminToolbox(),/REDIRECT/);
    await assert.rejects(store.writeToolboxCategory(id,categoryForm({name:"Não autorizado"})),/administrativa ativa/);
    await assert.rejects(store.writeToolboxTool(id,toolForm({url:"https://example.org/denied"})),/administrativa ativa/);
    const before=invalidated.length;
    await assert.rejects(load("app/admin/ferramentas/actions.ts").saveToolboxTool({error:""},new FormData()),/REDIRECT/);
    assert.equal(invalidated.length,before);
  }
  current="admin";assert.ok((await store.adminToolbox()).tools.some(t=>t.status==='draft'));
  await assert.rejects(load("app/admin/ferramentas/actions.ts").saveToolboxCategory({error:""},categoryForm({name:"Produtividade"})),/REDIRECT:\/admin\/ferramentas\?categoria=.*salvo=categoria/);
  assert.ok(invalidated.includes("/membros/ferramentas"));
});
test("unsafe URLs and invalid input are rejected before persistence and no prices are invented",async()=>{
  for(const url of ["javascript:alert(1)","data:text/html,test","http://example.org","https://user:pass@example.org","https://127.0.0.1","https://localhost","https://example.local","https://example.org:444/","https://example.org/?access_token=secret","https://example.org/?email=person@example.org","https://example.org/#access_token=secret","https://example.org/?contact=private","https://example.org\\@evil.com"]){
    await assert.rejects(store.writeToolboxTool("admin",toolForm({url})),undefined,url);
  }
  await assert.rejects(store.writeToolboxCategory("admin",categoryForm({name:"<script>"})),/texto simples/);
  await assert.rejects(store.writeToolboxCategory("admin",categoryForm({order:10000})),/Ordem/);
  await assert.rejects(store.writeToolboxTool("admin",toolForm({categoryId:"invalid"})),/Item inválido/);
  assert.equal((await sql`select conditions from member_tool where id=${flow}`)[0].conditions,null);
  assert.equal((await sql`select count(*)::integer as n from radar_free_event`)[0].n,2);
  assert.equal((await sql`select count(*)::integer as n from radar_legacy_access where user_id='legacy'`)[0].n,1);
});
test("migration detects schema and journal drift instead of accepting a partial release",async()=>{
  await sql`drop index member_tool_catalogue_idx`;
  try{await assert.rejects(migrateMemberToolbox(sql,{expectedRole:"apogee_local"}),/Índice/);}finally{await sql`create index member_tool_catalogue_idx on member_tool(category_id,status,sort_order,name)`;}
  const [last]=await sql`select id,hash from drizzle.__drizzle_migrations order by created_at desc limit 1`;
  await sql`update drizzle.__drizzle_migrations set hash='invalid' where id=${last.id}`;
  try{await assert.rejects(migrateMemberToolbox(sql,{expectedRole:"apogee_local"}),/Histórico/);}finally{await sql`update drizzle.__drizzle_migrations set hash=${last.hash} where id=${last.id}`;}
  assert.equal((await migrateMemberToolbox(sql,{expectedRole:"apogee_local"})).pending,false);
});
test("local review catalogue survives a controlled database restart without reseeding or deleting its data",async()=>{
  let fixture=await nativeCommunityDatabase({preserve:true});
  const directory=fixture.dir;
  await fixture.sql`create table local_persistence_probe(value text not null)`;
  await fixture.sql`insert into local_persistence_probe(value) values('curation-kept')`;
  await fixture.close();
  fixture=await nativeCommunityDatabase({directory});
  try{assert.equal(fixture.resumed,true);assert.equal((await fixture.sql`select value from local_persistence_probe`)[0].value,'curation-kept');}
  finally{await fixture.close();}
});

test("GitHub has its own filters, private prompt with the canonical URL and an independent access gate", async () => {
  const categoryId = await store.writeToolboxCategory("admin", categoryForm({ name: "GitHub Vídeo" }));
  const project = toolForm({ categoryId, name: "Projeto de teste", description: "Use para legendar vídeos.", url: "https://github.com/example-integration/VideoTest",
    conditions: "No navegador. Leia a documentação. Licença: MIT." });
  await assert.rejects(store.writeToolboxTool("admin", toolForm({
    categoryId, url: "https://github.com/example-integration/VideoTest/releases",
  })), /endereço principal/);
  await store.writeToolboxTool("admin", project);
  const skills = await store.writeToolboxCategory("admin", categoryForm({ name: "Skills" }));
  await store.writeToolboxTool("admin", toolForm({ categoryId: skills, name: "Skill de teste", url: "https://example.org/skill-tool" }));
  await assert.rejects(store.writeToolboxTool("admin", toolForm({
    categoryId, url: "https://github.com/example-integration/videotest",
  })), /já está cadastrado/);

  const Page = load("app/membros/ferramentas/page.tsx").default;
  const render = async params => renderToStaticMarkup(await Page({ searchParams: Promise.resolve(params) }));
  current = "paid";
  const initial = await render({});
  assert.match(initial, /aria-current="page"[^>]*>Super Poder para sua IA<\/a>/);
  const tabs = initial.match(/<nav[^>]*aria-label="Seções da Caixa de ferramentas"[^>]*>([\s\S]*?)<\/nav>/)?.[1];
  assert.match(tabs, /Super Poder para sua IA<\/a>.*Skills<\/a>.*Aplicativos<\/a>/s);
  assert.match(initial, /data-repository-preview="frame"/);
  assert.match(initial, /Vídeo com legendas/);
  assert.match(initial, /Ilustrativo/);
  const apps = await render({ secao: "aplicativos" });
  assert.match(apps, /aria-current="page"[^>]*>Aplicativos<\/a>/);
  assert.match(apps, /Abrir aplicativo/);
  assert.doesNotMatch(apps, /Projeto de teste|VideoTest|Skill de teste|data-repository-preview/);
  const skillPage = await render({ categoria: "skills" });
  assert.match(skillPage, /aria-current="page"[^>]*>Skills<\/a>/);
  assert.match(skillPage, /Abrir skill/);
  assert.match(skillPage, /Skill de teste/);
  assert.doesNotMatch(skillPage, /Projeto de teste|VideoTest|data-repository-preview/);
  const html = await render({ secao: "github", categoria: "github-video", q: "legendar video", modo: "No navegador" });
  assert.match(html, /aria-current="page"[^>]*>Super Poder para sua IA<\/a>/);
  assert.match(html, /Usar na minha IA/);
  assert.match(html, /Repositório oficial no GitHub: https:\/\/github\.com\/example-integration\/VideoTest/);
  assert.match(html, /href="https:\/\/github\.com\/example-integration\/VideoTest"/);
  assert.match(html, /Leia a documentação\. Licença: MIT\./);
  assert.doesNotMatch(html, /labs\.google|Google Flow/);
  assert.doesNotMatch(await render({ secao: "github", modo: "Instalação local" }), /Projeto de teste/);
  for (const account of ["free", "legacy"]) {
    current = account;
    const locked = await render({ secao: "github" });
    assert.match(locked, /Caixa de ferramentas para assinantes anuais/);
    assert.doesNotMatch(locked, /Projeto de teste|VideoTest|Copiar prompt/);
  }
});
