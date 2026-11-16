import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { readFileSync } from "node:fs";
import { nativeCommunityDatabase } from "./helpers/community-native-db.mjs";
import { opportunityLoader } from "./helpers/load-opportunity-module.mjs";
import { migrateCommunityAccess } from "../scripts/community-access-migrate.mjs";
import { migrateMemberToolbox } from "../scripts/member-toolbox-migrate.mjs";
import { importMemberToolbox, curationFingerprint, validateToolboxCuration } from "../scripts/member-toolbox-curate.mjs";

const toolboxCuration={id:"synthetic-curation",reviewMethod:"synthetic-test",reviewedAt:"2026-11-15T12:00:00.000Z",reviewedOn:"2026-11-15",
 categories:[{slug:"video",name:"Vídeo",description:"Categoria sintética.",order:0},{slug:"audio",name:"Áudio",description:"Categoria sintética.",order:1},{slug:"infraestrutura",name:"Infraestrutura",description:"Categoria sintética.",order:2}],
 tools:[{name:"Ferramenta A",categorySlug:"video",order:0},{name:"Ferramenta B",categorySlug:"video",order:1},{name:"Ferramenta C",categorySlug:"audio",order:0},{name:"Ferramenta D",categorySlug:"infraestrutura",order:0}].map((t,i)=>({...t,description:"Ficha sintética para ensaio; não é curadoria editorial.",url:`https://example.org/tool-${i}`,sourceUrl:`https://example.org/source-${i}`,conditions:null}))};
let db,sql,load,current="annual",mode=process.env.STRIPE_MODE;
const options={releaseSha:"a".repeat(40),expectedRole:"apogee_local",manifest:toolboxCuration,expectedSha256:curationFingerprint(toolboxCuration)};
const counts=async()=>{
  const [row]=await sql`select (select count(*)::integer from member_tool_category) as categories,(select count(*)::integer from member_tool) as tools`;
  return {categories:row.categories,tools:row.tools};
};
before(async()=>{
  process.env.STRIPE_MODE="test";
  db=await nativeCommunityDatabase();sql=db.sql;
  await migrateCommunityAccess(sql,{apply:true,expectedRole:"apogee_local"});
  await migrateMemberToolbox(sql,{apply:true,expectedRole:"apogee_local"});
  for(const id of ["curator","free","legacy","annual","blocked"]){
    await sql`insert into "user"(id,name,email,email_verified,adult_declared,role,blocked) values(${id},'Revisão sintética',${id+'@example.test'},true,true,${id==='curator'||id==='blocked'?'admin':'member'},${id==='blocked'})`;
  }
  await sql`insert into radar_legacy_access(user_id) values('legacy')`;
  await sql`insert into radar_free_event(user_id,opportunity_id,slot) values('free','existing-event',1)`;
  await sql`insert into community_subscription(id,user_id,customer_id,livemode,status) values('sub_Curation','annual','cus_Curation',false,'active')`;
  await sql`insert into community_invoice(id,subscription_id,amount,currency,period_start,period_end,status) values('in_Curation','sub_Curation',143880,'brl',now()-interval '1 day',now()+interval '1 year','paid')`;
  load=opportunityLoader({
    "@/lib/members/db":{getSql:()=>sql},
    "@/lib/members/dal":{requireMember:async()=>({id:current,role:current==='curator'?'admin':'member'})},
  });
});
after(async()=>{if(mode===undefined)delete process.env.STRIPE_MODE;else process.env.STRIPE_MODE=mode;await db?.close();});

test("manifest validates public HTTPS links and rejects duplicate or unverified conditions",()=>{
  assert.equal(validateToolboxCuration(toolboxCuration),toolboxCuration);
  assert.equal(toolboxCuration.categories.length,3);assert.equal(toolboxCuration.tools.length,4);
  assert.ok(toolboxCuration.tools.every(t=>t.conditions===null));
  for(const change of [m=>{m.tools[0].url='https://example.org/?token=private';},m=>{m.tools[0].sourceUrl='http://example.org/';},m=>{m.tools[0].conditions='Créditos incluídos';},m=>{m.tools.push({...m.tools[0]});}]){
    const invalid=structuredClone(toolboxCuration);change(invalid);assert.throws(()=>validateToolboxCuration(invalid));
  }
});
test("preflight does not import; apply requires the exact manifest, release and database role",async()=>{
  const plan=await importMemberToolbox(sql,options);
  assert.equal(plan.apply,false);assert.equal(plan.newCategories.length,3);assert.equal(plan.newTools.length,4);assert.deepEqual(plan.conflicts,[]);
  assert.deepEqual(await counts(),{categories:0,tools:0});
  await assert.rejects(importMemberToolbox(sql,{...options,apply:true,expectedSha256:"incorrect"}),/SHA-256/);
  for(const releaseSha of [undefined,"local","b".repeat(39)])await assert.rejects(importMemberToolbox(sql,{...options,releaseSha,apply:true}),/SHA exato do release/);
  await assert.rejects(importMemberToolbox(sql,{...options,expectedRole:"wrong_role",apply:true}),/Papel/);
  assert.deepEqual(await counts(),{categories:0,tools:0});
});
test("a failed row rolls back categories and earlier tools together",async()=>{
  await sql.unsafe(`create function reject_curation_test() returns trigger language plpgsql as $$ begin if NEW.name='Ferramenta B' then raise exception 'synthetic_import_failure'; end if; return NEW; end $$; create trigger reject_curation_test before insert on member_tool for each row execute function reject_curation_test()`);
  await assert.rejects(importMemberToolbox(sql,{...options,apply:true}),/synthetic_import_failure/);
  assert.deepEqual(await counts(),{categories:0,tools:0});
  await sql.unsafe('drop trigger reject_curation_test on member_tool; drop function reject_curation_test()');
});
test("apply and concurrent repetition insert each reviewed link once without touching Radar or annual rights",async()=>{
  const rights=await sql`select (select count(*)::integer from radar_legacy_access) legacy,(select count(*)::integer from radar_free_event) events,(select count(*)::integer from community_invoice) invoices`;
  const results=await Promise.all([importMemberToolbox(sql,{...options,apply:true}),importMemberToolbox(sql,{...options,apply:true})]);
  assert.equal(results.reduce((n,r)=>n+r.insertedCategories,0),3);assert.equal(results.reduce((n,r)=>n+r.insertedTools,0),4);
  assert.deepEqual(await counts(),{categories:3,tools:4});
  assert.deepEqual(await sql`select (select count(*)::integer from radar_legacy_access) legacy,(select count(*)::integer from radar_free_event) events,(select count(*)::integer from community_invoice) invoices`,rights);
  const [audit]=await sql`select count(*)::integer as n from member_tool where reviewed_by is null and updated_by is null and reviewed_at=${toolboxCuration.reviewedAt}::timestamptz and conditions is null`;
  assert.equal(audit.n,4);
});
test("manual edits and archives are preserved, while conflicting names and unpublished categories fail closed",async()=>{
  const [flow]=await sql`select * from member_tool where name='Ferramenta A'`;
  await sql`update member_tool set description='Descrição editorial existente.',status='archived',version=version+1 where id=${flow.id}`;
  const [edited]=await sql`select * from member_tool where id=${flow.id}`;
  const repeat=await importMemberToolbox(sql,{...options,apply:true});assert.equal(repeat.insertedTools,0);
  assert.deepEqual((await sql`select * from member_tool where id=${flow.id}`)[0],edited);
  const collision=structuredClone(toolboxCuration);collision.tools[0].url='https://example.org/another-official-address';
  assert.equal((await importMemberToolbox(sql,{...options,manifest:collision})).conflicts[0].reason,'existing_name_with_another_url');
  await assert.rejects(importMemberToolbox(sql,{...options,manifest:collision,expectedSha256:curationFingerprint(collision),apply:true}),/Conflito/);
  await sql`update member_tool_category set status='draft' where slug='infraestrutura'`;
  await assert.rejects(importMemberToolbox(sql,{...options,apply:true}),/Conflito/);
  assert.deepEqual(await counts(),{categories:3,tools:4});
  await sql`update member_tool_category set status='published' where slug='infraestrutura'`;
});
test("expanded catalogue stays annual-only and category filters use the same private store",async()=>{
  const store=load('lib/toolbox/store.ts');
  current='annual';const all=await store.memberToolbox();assert.equal(all.access.allowed,true);assert.equal(all.tools.length,3);
  assert.equal(all.categories.length,3);const infra=await store.memberToolbox('infraestrutura');assert.equal(infra.tools.length,1);assert.ok(infra.tools.some(t=>t.name==='Ferramenta D'));
  for(const account of ['free','legacy']){current=account;const denied=await store.memberToolbox();assert.equal(denied.access.allowed,false);assert.deepEqual(denied.tools,[]);assert.deepEqual(denied.categories,[]);assert.doesNotMatch(JSON.stringify(denied),/example\.org|Ferramenta [A-D]/);}
  assert.equal((await sql`select count(*)::integer n from radar_free_event where user_id='free'`)[0].n,1);
});

// The paid catalogue is never committed to the public repository or shipped to CI.
test("private reviewed catalogue imports, repeats and stays behind annual access",{skip:!process.env.APOGEE_PRIVATE_TOOLBOX_MANIFEST},async()=>{
  const manifest=JSON.parse(readFileSync(process.env.APOGEE_PRIVATE_TOOLBOX_MANIFEST,"utf8"));
  validateToolboxCuration(manifest);
  assert.equal(manifest.categories.length,8);assert.equal(manifest.tools.length,26);
  assert.ok(manifest.tools.every(t=>!/(?:kooko|kimi|^imi$)/i.test(t.name)));
  const parameters={...options,manifest,expectedSha256:curationFingerprint(manifest)};
  const imported=await importMemberToolbox(sql,{...parameters,apply:true});assert.equal(imported.insertedTools,26);
  assert.equal((await importMemberToolbox(sql,{...parameters,apply:true})).insertedTools,0);
  const store=load('lib/toolbox/store.ts');current='annual';const visible=await store.memberToolbox();
  const urls=new Set(manifest.tools.map(t=>t.url));assert.equal(visible.tools.filter(t=>urls.has(t.url)).length,26);
  for(const account of ['free','legacy']){current=account;const denied=await store.memberToolbox();assert.deepEqual(denied.tools,[]);assert.deepEqual(denied.categories,[]);}
});
