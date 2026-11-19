import assert from 'node:assert/strict';
import { before,after,test } from 'node:test';
import { nativeCommunityDatabase } from './helpers/community-native-db.mjs';
import { opportunityLoader } from './helpers/load-opportunity-module.mjs';
import { migrateCommunityAccess } from '../scripts/community-access-migrate.mjs';
import { migrateMemberToolbox } from '../scripts/member-toolbox-migrate.mjs';
import { migrateMemberDeliverables } from '../scripts/member-deliverables-migrate.mjs';
import { migrateMemberBenefits } from '../scripts/member-benefits-migrate.mjs';
import { syntheticOfferCheck } from './helpers/synthetic-benefit-check.mjs';
import { importApprovedBenefitOffers, publishAutomaticOffer } from '../scripts/import-benefit-offers.mjs';
import { duplicateMatcher } from '../scripts/automatic-benefit-review.mjs';
import { checkPublishedBenefits } from '../scripts/member-benefits-monitor.mjs';
let db,sql,store,editor,actor='admin',categoryId,videoId,firstId,secondId,draftId,expiredId;
const fixture={name:'Oferta de automação',partner:'Ferramenta sintética',description:'Automatize uma tarefa com dados fictícios.',evidenceUrl:'https://example.org/PRIVATE_AGREEMENT',eligibility:'Somente fixture local.',availability:'Uma solicitação por conta.',startsAt:'2026-01-01',endsAt:'2099-01-01',redemption:'PRIVATE_MEMBER_INSTRUCTIONS: confira o resultado no parceiro.',redemptionUrl:'https://example.org/redeem',status:'published',sortOrder:0};
const users=['admin','free','paid','cancelled','expired','refunded','legacy','blocked','blocked-admin','revoked-admin','other'];
before(async()=>{
  db=await nativeCommunityDatabase();sql=db.sql;
  for(const migrate of [migrateCommunityAccess,migrateMemberToolbox,migrateMemberDeliverables]) await migrate(sql,{apply:true,expectedRole:'apogee_local'});
  for(const id of users) await sql`insert into "user"(id,name,email,email_verified,role,adult_declared,blocked) values(${id},'Pessoa sintética',${id+'@example.test'},true,${['admin','blocked-admin'].includes(id)?'admin':'member'},true,${['blocked','blocked-admin'].includes(id)})`;
  for(const id of ['paid','cancelled','expired','refunded','other']) {
    await sql`insert into community_subscription(id,user_id,customer_id,livemode,status,cancel_at_period_end) values(${'sub_'+id},${id},${'cus_'+id},false,'active',${id==='cancelled'})`;
    await sql`insert into community_invoice(id,subscription_id,amount,currency,period_start,period_end,status) values(${'in_'+id},${'sub_'+id},143880,'brl',now()-interval '1 year',${new Date(Date.now()+(id==='expired'?-1:1)*86400000)},${id==='refunded'?'refunded':'paid'})`;
  }
  await sql`insert into radar_legacy_access(user_id) values('legacy')`;
  process.env.STRIPE_MODE='test';
  process.env.MEMBERS_SUPERVISED_REGISTRATION_ENABLED='false';
  const signed=async()=>{if(!actor)throw Error('AUTH');const [u]=await sql`select id,role,blocked from "user" where id=${actor}`;if(!u||u.blocked)throw Error('AUTH');return {id:u.id,role:u.role,name:'Pessoa sintética',username:actor,image:null};};
  const load=opportunityLoader({'@/lib/members/db':{getSql:()=>sql},'@/lib/members/dal':{requireSignedInMember:signed,requireMember:signed,requireAdmin:async()=>{const u=await signed();if(u.role!=='admin')throw Error('ADMIN');return u;}}});
  store=load('lib/benefits/store.ts');editor=load('lib/deliverables/store.ts');
});
after(async()=>{await db?.close();});

test('benefits migration is additive, preflights, repeats and rejects schema/role drift',async()=>{
  assert.equal((await migrateMemberBenefits(sql,{expectedRole:'apogee_local'})).pending,true);
  assert.equal((await migrateMemberBenefits(sql,{apply:true,expectedRole:'apogee_local'})).changed,true);
  assert.equal((await migrateMemberBenefits(sql,{apply:true,expectedRole:'apogee_local'})).changed,false);
  await assert.rejects(migrateMemberBenefits(sql,{expectedRole:'apogee_app'}),/Papel/);
  await sql`alter table member_benefit_saved add column unexpected text`;
  await assert.rejects(migrateMemberBenefits(sql,{expectedRole:'apogee_local'}),/divergente/);
  await sql`alter table member_benefit_saved drop column unexpected`;
  assert.equal((await migrateMemberDeliverables(sql,{expectedRole:'apogee_local'})).changed,false);
  assert.equal((await sql`select count(*)::int as n from radar_legacy_access`)[0].n,1);
});

test('editorial categories and offer variants persist without publishing research drafts',async()=>{
  actor='admin';
  for(const [name,status] of [['Automação','published'],['Vídeo','published'],['CATEGORIA_PRIVADA','draft']]) await store.saveBenefitCategory({name,description:'Fixture',status,sortOrder:0});
  const categories=(await store.adminBenefitWorkspace()).categories;
  categoryId=categories.find(c=>c.name==='Automação').id;videoId=categories.find(c=>c.name==='Vídeo').id;
  const organization={categoryId,providerLabel:'Distribuidor sintético',providerAccess:'included',sourceUrl:'https://example.org/offer'};
  firstId=(await editor.saveDeliverable('benefit',{...fixture,...organization})).id;
  secondId=(await editor.saveDeliverable('benefit',{...fixture,...organization,name:'Oferta de vídeo',description:'Criação de vídeo.',categoryId:videoId,audience:'estudantes'})).id;
  draftId=(await editor.saveDeliverable('benefit',{...fixture,...organization,name:'PRIVATE_RESEARCH_DRAFT',status:'draft',categoryId:categories.find(c=>c.status==='draft').id})).id;
  expiredId=(await editor.saveDeliverable('benefit',{...fixture,...organization,name:'PRIVATE_EXPIRED_OFFER',startsAt:'2020-01-01',endsAt:'2021-01-01'})).id;
  for (const id of [firstId, secondId, expiredId]) await syntheticOfferCheck(sql, id);
  assert.equal((await sql`select status from member_benefit where id=${draftId}`)[0].status,'draft');
  const row=(await editor.adminDeliverables()).benefits.find(b=>b.id===firstId);
  await assert.rejects(editor.saveDeliverable('benefit',{...fixture,...organization,id:firstId,revision:row.revision,categoryId:'missing-category'}));
  assert.equal((await sql`select category_id from member_benefit_organization where benefit_id=${firstId}`)[0].category_id,categoryId);
  const category=(await store.adminBenefitWorkspace()).categories.find(c=>c.id===categoryId);
  await store.saveBenefitCategory({id:category.id,version:category.version,name:category.name,description:'Categoria revisada',status:'published',sortOrder:1});
  await assert.rejects(store.saveBenefitCategory({id:category.id,version:category.version,name:'Edição antiga',description:'',status:'published',sortOrder:1}),/mudou/);
});

test('free, legacy and expired accounts cannot read catalogue, detail, saves or history',async()=>{
  for(actor of ['free','legacy','expired','refunded','revoked-admin']) {
    for(const view of ['catalogue','saved','history']) {
      const state=await store.memberBenefitWorkspace(view);assert.equal(state.access.allowed,false,actor);assert.deepEqual(state.benefits,[]);assert.deepEqual(state.categories,[]);assert.deepEqual(state.history,[]);
      assert.doesNotMatch(JSON.stringify(state),/PRIVATE_|Distribuidor sintético|Ferramenta sintética/);
    }
    assert.equal((await store.memberBenefitDetail(firstId)).benefit,null);
    await assert.rejects(store.setSavedBenefit({benefitId:firstId,saved:true}),/anual/);
    await assert.rejects(store.startBenefitRedemption({benefitId:firstId}),/anual/);
    await assert.rejects(store.adminBenefitWorkspace(),/ADMIN/);
  }
  actor=null;await assert.rejects(store.memberBenefitWorkspace(),/AUTH/);
  for(actor of ['blocked','blocked-admin']) await assert.rejects(store.memberBenefitWorkspace(),/AUTH/);
});

test('active annual, cancelled renewal and admin can search accents and filter only available offers',async()=>{
  for(actor of ['paid','cancelled','admin']) {
    const state=await store.memberBenefitWorkspace();assert.equal(state.access.allowed,true);assert.equal(state.benefits.length,2);
    assert.equal(state.categories.length,2);assert.doesNotMatch(JSON.stringify(state),/PRIVATE_AGREEMENT|evidence_url|PRIVATE_RESEARCH_DRAFT|PRIVATE_EXPIRED_OFFER|CATEGORIA_PRIVADA/);
  }
  actor='paid';
  assert.equal((await store.memberBenefitWorkspace('catalogue',{query:'automacao'})).benefits[0].id,firstId);
  assert.equal((await store.memberBenefitWorkspace('catalogue',{query:'VÍDEO'})).benefits[0].id,secondId);
  assert.equal((await store.memberBenefitWorkspace('catalogue',{query:'%'})).benefits.length,0);
  assert.equal((await store.memberBenefitWorkspace('catalogue',{query:"' OR 1=1 --"})).benefits.length,0);
  assert.equal((await store.memberBenefitWorkspace('catalogue',{category:'video'})).benefits[0].id,secondId);
  assert.equal((await store.memberBenefitWorkspace('catalogue',{category:'not-found'})).benefits.length,0);
  assert.equal((await store.memberBenefitWorkspace('catalogue',{query:'video',category:'video',audience:'estudantes'})).benefits[0].id,secondId);
  assert.equal((await store.memberBenefitWorkspace('catalogue',{query:'video',category:'video',audience:'startups'})).benefits.length,0);
  assert.equal((await store.memberBenefitDetail(draftId)).benefit,null);assert.equal((await store.memberBenefitDetail(expiredId)).benefit,null);
  assert.ok((await store.memberBenefitDetail(firstId)).benefit.starts_at instanceof Date);
});

test('saved offers are account-bound, survive reads and are idempotent under concurrent requests',async()=>{
  actor='paid';
  await Promise.all(Array.from({length:6},()=>store.setSavedBenefit({benefitId:firstId,saved:true})));
  assert.equal((await sql`select count(*)::int as n from member_benefit_saved where user_id='paid'`)[0].n,1);
  assert.equal((await store.memberBenefitWorkspace('saved')).benefits[0].id,firstId);
  actor='other';assert.equal((await store.memberBenefitWorkspace('saved')).benefits.length,0);
  await store.setSavedBenefit({benefitId:firstId,saved:false});
  actor='paid';assert.equal((await store.memberBenefitWorkspace('saved')).benefits.length,1);
  await assert.rejects(store.setSavedBenefit({benefitId:firstId,saved:true,userId:'other'}));
  await assert.rejects(store.setSavedBenefit({benefitId:draftId,saved:true}),/não está disponível/);
});

test('starting a redemption records intent once and never claims a discount was applied',async()=>{
  actor='paid';
  const [before]=await sql`select count(*)::int as n from radar_free_event`;
  const results=await Promise.all(Array.from({length:6},()=>store.startBenefitRedemption({benefitId:firstId})));
  assert.ok(results.every(r=>r.destination==='https://example.org/redeem'));
  const history=(await store.memberBenefitWorkspace('history')).history;
  assert.equal(history.length,1);assert.equal(history[0].status,'started');assert.equal(history[0].reviewed_at,null);
  assert.doesNotMatch(JSON.stringify(history),/user_id|evidence_reference|terms_revision|PRIVATE_AGREEMENT/);
  actor='other';assert.equal((await store.memberBenefitWorkspace('history')).history.length,0);
  actor='paid';await assert.rejects(store.startBenefitRedemption({benefitId:firstId,status:'confirmed'}));
  await assert.rejects(store.startBenefitRedemption({benefitId:draftId}),/não está disponível/);
  await assert.rejects(store.startBenefitRedemption({benefitId:expiredId}),/não está disponível/);
  assert.equal((await sql`select count(*)::int as n from radar_free_event`)[0].n,before.n);
});

test('manual confirmation requires administration, fresh revision and private evidence',async()=>{
  actor='admin';const claim=(await store.adminBenefitWorkspace()).redemptions[0];
  await assert.rejects(store.reviewBenefitRedemption({id:claim.id,revision:claim.revision,status:'confirmed',evidenceReference:''}));
  actor='paid';await assert.rejects(store.reviewBenefitRedemption({id:claim.id,revision:claim.revision,status:'confirmed',evidenceReference:'PRIVATE_PROOF_TICKET'}),/ADMIN/);
  actor='admin';await store.reviewBenefitRedemption({id:claim.id,revision:claim.revision,status:'confirmed',evidenceReference:'PRIVATE_PROOF_TICKET'});
  await assert.rejects(store.reviewBenefitRedemption({id:claim.id,revision:claim.revision,status:'rejected',evidenceReference:'PRIVATE_PROOF_TICKET'}),/mudou/);
  actor='paid';const history=(await store.memberBenefitWorkspace('history')).history;assert.equal(history[0].status,'confirmed');assert.ok(history[0].reviewed_at instanceof Date);assert.doesNotMatch(JSON.stringify(history),/PRIVATE_PROOF_TICKET|reviewed_by/);
  assert.equal((await store.memberBenefitDetail(firstId)).redemptionStatus,'confirmed');
  assert.equal((await store.startBenefitRedemption({benefitId:firstId})).status,'confirmed');
  assert.equal((await store.memberBenefitWorkspace('history')).history.length,1);
});

test('transaction rechecks reject stale role, blocked account and revoked annual access',async()=>{
  for(const id of ['revoked-admin','blocked-admin']) {
    const stale=opportunityLoader({'@/lib/members/db':{getSql:()=>sql},'@/lib/deliverables/store':{deliverableMember:async()=>({member:{id,role:'admin'},access:{allowed:true}})}})('lib/benefits/store.ts');
    await assert.rejects(stale.setSavedBenefit({benefitId:firstId,saved:true}),/anual|indisponível/);
    await assert.rejects(stale.startBenefitRedemption({benefitId:firstId}),/anual|indisponível/);
  }
  await sql`update community_invoice set status='refunded' where id='in_other'`;
  const stale=opportunityLoader({'@/lib/members/db':{getSql:()=>sql},'@/lib/deliverables/store':{deliverableMember:async()=>({member:{id:'other',role:'member'},access:{allowed:true}})}})('lib/benefits/store.ts');
  await assert.rejects(stale.startBenefitRedemption({benefitId:firstId}),/anual/);
  assert.equal((await sql`select count(*)::int as n from member_benefit_redemption where user_id='other'`)[0].n,0);
});

test('protection approval is rechecked in the transaction even with stale render authorization',async()=>{
  process.env.MEMBERS_SUPERVISED_REGISTRATION_ENABLED='true';
  actor='paid';
  await sql`insert into member_adult_review(user_id,status,reviewed_at,evidence_reference) values('paid','approved',now(),'synthetic-protection-review') on conflict(user_id) do update set status='approved',reviewed_at=now()`;
  try {
    await store.setSavedBenefit({benefitId:secondId,saved:true});
    await sql`update member_adult_review set status='rejected' where user_id='paid'`;
    await assert.rejects(store.startBenefitRedemption({benefitId:secondId}),/verificação/);
    await assert.rejects(store.setSavedBenefit({benefitId:secondId,saved:false}),/verificação/);
    assert.equal((await sql`select count(*)::int as n from member_benefit_redemption where user_id='paid' and benefit_id=${secondId}`)[0].n,0);
  } finally {process.env.MEMBERS_SUPERVISED_REGISTRATION_ENABLED='false';}
});

test('history keeps the original public snapshot when an offer is archived or turned into a private draft',async()=>{
  await sql`update member_benefit set status='draft',name='PRIVATE_NEW_DRAFT_NAME',redemption='PRIVATE_DRAFT_INSTRUCTIONS' where id=${firstId}`;
  actor='paid';assert.equal((await store.memberBenefitDetail(firstId)).benefit,null);
  assert.equal((await store.memberBenefitWorkspace('saved')).benefits.some(b=>b.id===firstId),false);
  const history=(await store.memberBenefitWorkspace('history')).history;assert.equal(history[0].benefit_name,fixture.name);assert.equal(history[0].available,false);
  assert.doesNotMatch(JSON.stringify(history),/PRIVATE_NEW_DRAFT_NAME|PRIVATE_DRAFT_INSTRUCTIONS/);
  await assert.rejects(store.startBenefitRedemption({benefitId:firstId}),/não está disponível/);
  await store.setSavedBenefit({benefitId:firstId,saved:false});
  assert.equal((await sql`select count(*)::int as n from member_benefit_saved where user_id='paid' and benefit_id=${firstId}`)[0].n,0);
});

test('directly tampered destinations are refused without recording a new redemption',async()=>{
  actor='cancelled';await sql`update member_benefit set redemption_url='javascript:alert(1)' where id=${secondId}`;
  await syntheticOfferCheck(sql, secondId);
  await assert.rejects(store.startBenefitRedemption({benefitId:secondId}),/não está disponível/);
  assert.equal((await sql`select count(*)::int as n from member_benefit_redemption where user_id='cancelled'`)[0].n,0);
});

test('server-rendered blocked views expose neither forms nor private offer/history data',async()=>{
  const {renderToStaticMarkup}=await import('react-dom/server');
  const load=opportunityLoader({'next/link':{__esModule:true,default:'a'},'@/lib/benefits/store':store,'@/components/members/member-bar':{MemberBar:()=>null},'./member-forms':{BenefitSaveButton:()=>null}});
  const Workspace=load('components/benefits/workspace.tsx').BenefitsWorkspace;
  actor='free';for(const view of ['catalogue','saved','history']) {
    const html=renderToStaticMarkup(await Workspace({view}));assert.match(html,/Assinatura anual|assinatura anual/);assert.doesNotMatch(html,/<form|PRIVATE_|Ferramenta sintética|Oferta de vídeo/);
  }
});

test('continuous offers require recent verification and expire across member entry points', async () => {
  actor = 'admin';
  const dateAgo = days => new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const offer = { ...fixture, name: 'Oferta contínua', categoryId, startsAt: '', endsAt: '', verifiedOn: dateAgo(0) };
  for (const invalid of [{ verifiedOn: dateAgo(-1) }, { verifiedOn: dateAgo(7) }, { endsAt: '2099-01-01' }, { redemptionUrl: '' }, { evidenceUrl: '' }]) {
    await assert.rejects(editor.saveDeliverable('benefit', { ...offer, ...invalid }));
  }
  const { id } = await editor.saveDeliverable('benefit', offer);
  assert.equal((await store.memberBenefitDetail(id)).benefit, null);
  await syntheticOfferCheck(sql, id);
  actor = 'paid';
  const result = await store.memberBenefitWorkspace('catalogue', { query: 'continua' });
  assert.equal(result.benefits.length, 1);
  assert.equal(result.benefits[0].id, id);
  assert.ok(result.benefits[0].verified_at instanceof Date);
  assert.equal(result.benefits[0].ends_at, null);
  assert.equal((await store.memberBenefitDetail(id)).benefit.id, id);
  await store.setSavedBenefit({ benefitId: id, saved: true });
  await store.startBenefitRedemption({ benefitId: id });
  await sql`update member_benefit_monitor set last_success_at=now()-interval '24 hours' where benefit_id=${id}`;
  assert.ok(!(await store.memberBenefitWorkspace('catalogue')).benefits.some(b => b.id === id));
  assert.ok(!(await store.memberBenefitWorkspace('saved')).benefits.some(b => b.id === id));
  assert.equal((await store.memberBenefitDetail(id)).benefit, null);
  assert.equal((await store.memberBenefitWorkspace('history')).history.find(r => r.benefit_id === id).available, false);
  await assert.rejects(store.startBenefitRedemption({ benefitId: id }), /não está disponível/);
  const [edge] = await sql`select public.member_benefit_is_current(null,null,now()-interval '168 hours') as expired,
    public.member_benefit_is_current(null,null,now()-interval '168 hours'+interval '1 second') as inside,
    public.member_benefit_is_current(null,null,now()+interval '1 second') as future`;
  assert.deepEqual({ ...edge }, { expired: false, inside: true, future: false });
  actor = 'admin';
  const row = (await editor.adminDeliverables()).benefits.find(b => b.id === id);
  await editor.saveDeliverable('benefit', { ...offer, id, revision: row.revision });
  assert.equal((await store.memberBenefitDetail(id)).benefit, null);
  await syntheticOfferCheck(sql, id);
  assert.equal((await store.memberBenefitDetail(id)).benefit.id, id);
  await syntheticOfferCheck(sql, id, 'unavailable');
  await syntheticOfferCheck(sql, id);
  assert.equal((await store.memberBenefitDetail(id)).benefit, null);
});
test('a verified catalog imports 100 distinct offers exactly once and enforces the combined filters', async () => {
  const earlierCheck = new Date(Date.now()-1000).toISOString();
  const packDestination = "https://education.github.com/pack#namecheap";
  const sample = Array.from({ length: 100 }, (_, index) => ({
    id: `batch-${index}`,
    partner: "Parceiro de teste",
    condition: `Licença de colaboração ${index}`,
    category: "produtividade",
    audience: index % 2 ? "estudantes" : "startups",
    source: `https://example.org/benefits/${index}`,
    redeem: index === 1 ? packDestination : `https://example.org/redeem/${index}`,
    program: "Programa sintético",
    eligibility: "Fixture local.",
    availability: "Condição disponível somente para o teste.",
    instructions: "Acesso simulado.",
    sort: index,
    checkedAt: earlierCheck,
    result: { outcome: "verified", reason: "Verificação sintética" },
  }));
  await assert.rejects(importApprovedBenefitOffers(sql, sample.slice(1), "admin"), /100 ofertas/);
  assert.equal(await importApprovedBenefitOffers(sql, sample, "admin"), 100);
  assert.equal(await importApprovedBenefitOffers(sql, sample, "admin"), 100);
  actor = "paid";
  const catalogue = await store.memberBenefitWorkspace("catalogue", { query: "COLABORACAO", category: "produtividade", audience: "estudantes" });
  assert.equal(catalogue.benefits.length, 50);
  assert.equal(catalogue.benefits[0].id, "batch-1");
  assert.equal(catalogue.totals.catalogue, 100);
  assert.equal((await store.startBenefitRedemption({ benefitId: "batch-1" })).destination, packDestination);
  const stats = await checkPublishedBenefits(sql, sample, {
    force: true,
    check: async offer => offer.id === "batch-1"
      ? { outcome: "unavailable", reason: "Fim de campanha simulado" } : offer.result,
  });
  assert.equal(stats.available, 99);
  assert.equal(stats.belowTarget, true);
  assert.equal((await store.memberBenefitDetail("batch-1")).benefit, null);
});

test("automatic review publishes a single fixed-date campaign once under concurrent attempts", async () => {
  const now = Date.now();
  const offer = {
    id: "auto-pilot", partner: "Parceiro automático", condition: "Crédito sintético por 30 dias",
    category: "produtividade", audience: "geral", source: "https://example.org/auto-terms",
    redeem: "https://example.org/auto-redeem", program: "Programa sintético", eligibility: "Brasil",
    availability: "Enquanto a campanha do teste estiver aberta", instructions: "Inscrição simulada",
    sort: 100, startsAt: new Date(now - 60000).toISOString(),
    endsAt: new Date(now + 60000).toISOString(), checkedAt: new Date(now - 1000).toISOString(),
    result: { outcome: "verified", reason: "Verificação sintética" },
  };
  const match = duplicateMatcher({ offer });
  const expired = { ...offer, endsAt: new Date(now - 30000).toISOString() };
  assert.equal(await publishAutomaticOffer(sql, expired, "admin", match), "review");
  assert.equal(await publishAutomaticOffer(sql, offer, "blocked-admin", match), "review");
  assert.deepEqual((await Promise.all([
    publishAutomaticOffer(sql, offer, "admin", match),
    publishAutomaticOffer(sql, offer, "admin", match),
  ])).sort(), ["duplicate", "published"]);
  const [saved] = await sql`select b.verified_at,b.ends_at,public.member_benefit_is_available(b) as available,
    (select count(*)::int from member_deliverable_audit where entity_id=b.id and action='create') as audits
    from member_benefit b where b.id=${offer.id}`;
  assert.equal(saved.verified_at, null);
  assert.equal(saved.ends_at.toISOString(), offer.endsAt);
  assert.equal(saved.available, true);
  assert.equal(saved.audits, 1);
  await sql`update member_benefit set availability='Condições editadas' where id=${offer.id}`;
  await checkPublishedBenefits(sql, [{ ...offer, automatic: true }], {
    check: () => assert.fail("A ficha editada requer revisão antes de renovar o recibo"),
  });
  const [changed] = await sql`select outcome from member_benefit_monitor where benefit_id=${offer.id}`;
  assert.equal(changed.outcome, "review");
  assert.equal((await store.memberBenefitDetail(offer.id)).benefit, null);
});
