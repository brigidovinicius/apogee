import assert from "node:assert/strict";
import {before,after,test} from "node:test";
import {readFile} from "node:fs/promises";
import Stripe from "stripe";
import {opportunityLoader} from "./helpers/load-opportunity-module.mjs";
import {nativeCommunityDatabase} from "./helpers/community-native-db.mjs";
import {migrateCommunityAccess} from "../scripts/community-access-migrate.mjs";
let db,sql,load,detailStore,fulfill,access,stripe,model,member='free',catalogue;
const amount=143880,now=Math.floor(Date.now()/1000),start=now-86400,end=start+365*86400;
const price={id:'price_Annual',product:'prod_Community',active:true,livemode:false,type:'recurring',currency:'brl',unit_amount:amount,recurring:{interval:'year',interval_count:1,usage_type:'licensed'}};
const base={title:'Evento de teste local',organization:'Apogee',kind:'Evento',categories:['eventos'],summary:'Resumo público',deadline:'2099-12-31',verifiedAt:'2026-11-14',officialUrl:'https://example.test/private',eligibility:'PRIVATE_REQUIREMENTS',level:'Público diverso',location:'Brasil',benefit:'Teste',deadlineLabel:'Teste'};
const event=(id,type='invoice.paid')=>({id,type,livemode:false,data:{object:{id:type.startsWith('customer.subscription')?'sub_Annual':type.startsWith('checkout')?'cs_Annual':type.startsWith('charge.dispute')?'dp_Annual':type==='charge.refunded'?'ch_Annual':type.startsWith('radar.')?'issfr_Annual':'in_Annual'}}});
function resetModel() {
  model={cancelCalls:0,sub:{id:'sub_Annual',livemode:false,customer:'cus_Annual',metadata:{integration:'apogee_community_annual_v1'},status:'active',cancel_at_period_end:false,latest_invoice:'in_Annual',items:{has_more:false,data:[{quantity:1,price:structuredClone(price)}]}},
    invoice:{id:'in_Annual',livemode:false,customer:'cus_Annual',parent:{subscription_details:{subscription:'sub_Annual'}},status:'paid',currency:'brl',total:amount,amount_paid:amount,amount_remaining:0,billing_reason:'subscription_create'},
    line:{quantity:1,amount,currency:'brl',pricing:{price_details:{price:price.id}},parent:{subscription_item_details:{proration:false}},period:{start,end}},
    charge:{id:'ch_Annual',payment_intent:'pi_Annual',livemode:false,amount,currency:'brl',paid:true,captured:true,amount_refunded:0,disputed:false},
    dispute:'needs_response',checkoutCalls:[],subscriptionList:[],sessionExpiry:0,portalUpdates:false};
}
before(async()=>{
  db=await nativeCommunityDatabase();sql=db.sql;
  process.env.COMMUNITY_BILLING_ENABLED='true';process.env.STRIPE_MODE='test';process.env.STRIPE_SECRET_KEY='sk_test_LocalOnly';
  process.env.STRIPE_COMMUNITY_ANNUAL_PRICE_ID=price.id;process.env.STRIPE_COMMUNITY_PRODUCT_ID=price.product;process.env.RADAR_BILLING_ENABLED='true';
  process.env.STRIPE_WEBHOOK_SECRET='whsec_localannualvalidation';process.env.STRIPE_RADAR_PRICE_ID='price_Legacy';process.env.STRIPE_RADAR_PRODUCT_ID='prod_Legacy';
  resetModel();catalogue=Array.from({length:12},(_,i)=>({...base,id:`event-${i+1}`}));
  stripe={prices:{retrieve:async()=>structuredClone(price)},subscriptions:{retrieve:async()=>structuredClone(model.sub),list:async()=>({data:model.subscriptionList,has_more:false}),update:async(id,input)=>{model.cancelCalls++;model.sub.cancel_at_period_end=input.cancel_at_period_end;return model.sub;}},
    customers:{create:async()=>({id:'cus_Checkout'})},
    checkout:{sessions:{retrieve:async()=>({mode:'subscription',livemode:false,subscription:model.sub.id}),create:async(params,opts)=>{model.checkoutCalls.push({params,opts});return {url:'https://checkout.stripe.com/c/pay/local'};}}},
    invoices:{retrieve:async()=>structuredClone(model.invoice),listLineItems:async()=>({data:[structuredClone(model.line)],has_more:false})},
    invoicePayments:{list:async()=>({has_more:false,data:[{invoice:model.invoice.id,livemode:false,amount_paid:amount,currency:'brl',payment:{type:'payment_intent',payment_intent:'pi_Annual'}}]})},
    paymentIntents:{retrieve:async()=>({id:'pi_Annual',status:'succeeded',amount,amount_received:amount,currency:'brl',livemode:false,latest_charge:structuredClone(model.charge)})},
    charges:{retrieve:async()=>structuredClone(model.charge)},disputes:{retrieve:async()=>({payment_intent:'pi_Annual'}),list:async()=>({has_more:false,data:[{status:model.dispute}]})},
    radar:{earlyFraudWarnings:{list:async()=>({data:[],has_more:false}),retrieve:async()=>({charge:'ch_Annual',payment_intent:'pi_Annual'})}},webhooks:Stripe.webhooks,
    billingPortal:{configurations:{retrieve:async()=>({active:true,livemode:false,features:{subscription_update:{enabled:model.portalUpdates},subscription_cancel:{enabled:true,mode:'at_period_end'}}})},sessions:{create:async()=>({url:'https://billing.stripe.com/p/session/local'})}}};
  load=opportunityLoader({'@/lib/members/db':{getSql:()=>sql},'@/lib/billing/stripe':{stripeClient:()=>stripe},'./stripe':{stripeClient:()=>stripe},
    '@/lib/members/mail':{applicationOrigin:()=> 'https://apogee.test'},'@/lib/members/dal':{getMemberFromHeaders:async()=>member?{id:member}:null,requireSignedInMember:async()=>({id:member})},
    '@/lib/members/protection':{adultAccess:async()=>true},'@/lib/members/rate-limit':{consumeRateLimit:async()=>true},
    '@/lib/opportunities/radar-client':{listRadarOpportunities:async()=>catalogue},'next/navigation':{notFound:()=>{throw Error('NOT_FOUND');}}});
  detailStore=load('lib/opportunities/detail-store.ts');fulfill=load('lib/billing/community-fulfillment.ts').fulfillCommunityEvent;access=load('lib/billing/store.ts').radarAccess;
});
after(async()=>{await db?.close();});
const seed=async(id)=>sql`insert into "user"(id,name,email,email_verified,created_at,updated_at,adult_declared) values(${id},'Pessoa Teste',${id+'@example.test'},true,now(),now(),true) on conflict do nothing`;
const req=path=>new Request(`https://apogee.test${path}`,{method:'POST',headers:{origin:'https://apogee.test'}});

test('additive migration: preflight, apply, repeat and schema drift refusal',async()=>{
  assert.equal((await migrateCommunityAccess(sql,{expectedRole:'apogee_local'})).pending,true);
  assert.equal((await migrateCommunityAccess(sql,{apply:true,expectedRole:'apogee_local'})).applied.length,2);
  assert.equal((await migrateCommunityAccess(sql,{apply:true,expectedRole:'apogee_local'})).changed,false);
  await sql`alter table radar_free_event add column unexpected text`;
  await assert.rejects(migrateCommunityAccess(sql,{apply:true,expectedRole:'apogee_local'}),/Colunas/);
  await sql`alter table radar_free_event drop column unexpected`;
  for(const id of ['free','other','legacy','paid','blocked','old-event','old-other','checkout']) await seed(id);
  await sql`update "user" set blocked=true where id='blocked'`;
});
test('real DB: 12 simultaneous event openings release exactly 10, reopen is idempotent and accounts are isolated',async()=>{
  const results=await Promise.all(catalogue.map(item=>detailStore.claimFreeRadarEvent('free',item.id,null)));
  assert.equal(results.filter(Boolean).length,10);
  let state=await detailStore.freeRadarState('free',catalogue);assert.equal(state.used,10);assert.equal(state.remaining,0);
  await Promise.all(Array.from({length:8},()=>detailStore.claimFreeRadarEvent('free',state.eventIds[0],null)));
  assert.equal((await detailStore.freeRadarState('free',catalogue)).used,10);
  assert.equal(await detailStore.claimFreeRadarEvent('other',catalogue[0].id,null),true);
  assert.equal((await detailStore.freeRadarState('other',catalogue)).used,1);
  assert.equal(await detailStore.claimFreeRadarEvent('blocked',catalogue[0].id,null),false);
  await assert.rejects(sql`insert into radar_free_event(user_id,opportunity_id,slot) values('other','invalid-11',11)`);
});
test('old free event counts once; old non-event selection survives without consuming event quota',async()=>{
  await detailStore.claimFreeRadarOpportunity('old-event',catalogue[0].id);
  let state=await detailStore.freeRadarState('old-event',catalogue);assert.equal(state.used,1);
  await detailStore.claimFreeRadarEvent('old-event',catalogue[1].id,state.previousEvent);
  assert.equal((await detailStore.freeRadarState('old-event',catalogue)).used,2);
  await detailStore.claimFreeRadarOpportunity('old-other','old-scholarship');
  state=await detailStore.freeRadarState('old-other',catalogue);assert.equal(state.used,0);assert.ok(state.readableIds.includes('old-scholarship'));
});
test('GET does not consume or leak; full legacy rights bypass quota while blocked accounts remain closed',async()=>{
  const detail=load('lib/opportunities/detail-access.ts').radarOpportunityDetail;member='other';
  const before=(await detailStore.freeRadarState('other',catalogue)).used;
  let result=await detail(catalogue[1].id);assert.equal(result.status,'available');assert.equal(result.opportunity,null);
  assert.equal((await detailStore.freeRadarState('other',catalogue)).used,before);
  await sql`insert into radar_legacy_access(user_id) values('legacy')`;
  member='legacy';result=await detail(catalogue[11].id,true);assert.equal(result.status,'unlimited');assert.equal(result.quota,null);
  assert.equal((await detailStore.freeRadarState('legacy',catalogue)).used,0);
  assert.equal((await access('blocked',false)).active,false);
});
test('annual checkout fixes price, quantity and cadence; retries reuse the same key and immutable parameters',async()=>{
  member='checkout';const checkout=load('lib/billing/community-checkout.ts').annualCheckout;
  await checkout(member,'/membros/oportunidades/event-1');await checkout(member,'/membros/oportunidades/event-2');
  assert.equal(model.checkoutCalls.length,2);const [a,b]=model.checkoutCalls;
  assert.deepEqual(a,b);assert.equal(a.params.mode,'subscription');assert.equal(a.params.adaptive_pricing.enabled,false);assert.deepEqual(a.params.line_items,[{price:price.id,quantity:1}]);
  assert.ok(!('payment_method_types' in a.params));assert.ok(!('trial_period_days' in a.params.subscription_data));
  assert.equal((await access(member,false)).active,false,'success URL and checkout creation grant nothing');
  const bad={...price,recurring:{...price.recurring,interval:'month'}};assert.equal(load('lib/billing/community-fulfillment.ts').validAnnualPrice(bad,{price:price.id,product:price.product,livemode:false}),false);
});
test('webhook signature and owner binding: unpaid, foreign customer, wrong price and wrong mode cannot grant access',async()=>{
  await sql`insert into community_customer(user_id,livemode,customer_id) values('paid',false,'cus_Annual')`;
  model.invoice.status='open';await fulfill(event('evt_unpaid'));assert.equal((await access('paid',false)).active,false);
  model.invoice.status='paid';model.sub.customer='cus_Foreign';await fulfill(event('evt_foreign'));assert.equal((await access('paid',false)).active,false);model.sub.customer='cus_Annual';
  model.sub.items.data[0].price.recurring.interval='month';model.line.pricing.price_details.price='price_Monthly';await fulfill(event('evt_monthly'));assert.equal((await access('paid',false)).active,false);model.sub.items.data[0].price=structuredClone(price);model.line.pricing.price_details.price=price.id;
  await fulfill({...event('evt_live'),livemode:true});assert.equal((await access('paid',false)).active,false);
  const route=load('app/api/stripe/webhook/route.ts').POST;
  const body=JSON.stringify({...event('evt_signed'),created:now,object:'event',api_version:'2026-09-30.clover',pending_webhooks:1,request:null});
  const wrong=await route(new Request('https://apogee.test/api/stripe/webhook',{method:'POST',body,headers:{'stripe-signature':'bad'}}));assert.equal(wrong.status,400);
  const header=Stripe.webhooks.generateTestHeaderString({payload:body,secret:process.env.STRIPE_WEBHOOK_SECRET});
  // Keep the old handler out of this annual fixture; it has independent legacy billing tests.
  process.env.RADAR_BILLING_ENABLED='false';
  const response=await route(new Request('https://apogee.test/api/stripe/webhook',{method:'POST',body,headers:{'stripe-signature':header}}));assert.equal(response.status,200);
  assert.equal((await access('paid',false)).source,'community');assert.equal((await access('paid',true)).active,false);
  assert.equal(await fulfill(event('evt_signed')),'duplicate');
});
test('cancellation keeps the paid period; failed renewal and out of order events never extend access',async()=>{
  model.sub.cancel_at_period_end=true;await fulfill(event('evt_cancel','customer.subscription.updated'));
  assert.equal((await access('paid',false)).active,true);
  const membership=await load('lib/billing/community-store.ts').communityMembership('paid',false);assert.equal(membership.subscription.cancelAtPeriodEnd,true);
  model.invoice.id='in_Renewal';model.invoice.status='open';model.invoice.billing_reason='subscription_cycle';model.line.period={start:end,end:end+365*86400};
  await fulfill({...event('evt_failed','invoice.payment_failed'),data:{object:{id:'in_Renewal'}}});
  assert.equal((await load('lib/billing/community-store.ts').communityAccess('paid',false)).paidUntil,new Date(end*1000).toISOString());
  model.invoice.status='paid';await fulfill({...event('evt_renewal'),data:{object:{id:'in_Renewal'}}});
  // Future paid renewal must not grant access before that period starts.
  await sql`update community_invoice set period_end=now()-interval '1 second',period_start=now()-interval '1 year' where id='in_Annual'`;
  assert.equal((await access('paid',false)).active,false);
  await sql`update community_invoice set period_start=${new Date(start*1000)},period_end=${new Date(end*1000)} where id='in_Annual'`;
  resetModel();
});
test('full refund and disputes remove only annual rights; stale paid events do not restore them; legacy rights survive',async()=>{
  model.charge.amount_refunded=100;await fulfill(event('evt_partial','charge.refunded'));assert.equal((await access('paid',false)).active,true);
  model.charge.amount_refunded=amount;await fulfill(event('evt_refund','charge.refunded'));assert.equal((await access('paid',false)).active,false);
  assert.equal((await load('lib/billing/community-store.ts').communityMembership('paid',false)).paymentStatus,'refunded');
  await fulfill(event('evt_stale_paid'));assert.equal((await access('paid',false)).active,false);
  await sql`insert into radar_legacy_access(user_id) values('paid')`;assert.equal((await access('paid',false)).source,'legacy');
  await sql`delete from radar_legacy_access where user_id='paid'`;model.charge.amount_refunded=0;model.charge.disputed=true;
  await fulfill(event('evt_dispute','charge.dispute.created'));assert.equal((await access('paid',false)).active,false);
  model.dispute='won';await fulfill(event('evt_won','charge.dispute.closed'));assert.equal((await access('paid',false)).active,true);
  model.charge.disputed=false;
});
test('fraud hold persists through stale events; duplicate concurrent deliveries do not duplicate rights',async()=>{
  await fulfill(event('evt_fraud','radar.early_fraud_warning.created'));assert.equal((await access('paid',false)).active,false);
  await fulfill(event('evt_after_fraud'));assert.equal((await access('paid',false)).active,false);
  const result=await Promise.all([fulfill(event('evt_concurrent')),fulfill(event('evt_concurrent'))]);assert.ok(result.includes('duplicate'));
  const [count]=await sql`select count(*)::int as n from community_invoice where id='in_Annual'`;assert.equal(count.n,1);
});
test('API auth, CSRF, cancellation ownership and retired standalone sale',async()=>{
  const checkout=load('app/api/comunidade/assinatura/checkout/route.ts').POST;member=null;assert.equal((await checkout(req('/api/comunidade/assinatura/checkout'))).status,401);
  const expired=await checkout(new Request('https://apogee.test/api/comunidade/assinatura/checkout',{method:'POST',headers:{origin:'https://apogee.test',accept:'text/html'}}));assert.equal(expired.status,303);assert.equal(new URL(expired.headers.get('location')).pathname,'/membros/entrar');
  member='other';assert.equal((await checkout(new Request('https://apogee.test/api/comunidade/assinatura/checkout',{method:'POST',headers:{origin:'https://evil.test'}}))).status,403);
  const cancel=load('app/api/comunidade/assinatura/cancelar/route.ts').POST;assert.equal((await cancel(req('/api/comunidade/assinatura/cancelar'))).status,409);
  member='paid';assert.equal((await cancel(req('/api/comunidade/assinatura/cancelar'))).status,303);assert.equal(model.sub.cancel_at_period_end,true);
  const callsBefore=model.checkoutCalls.length;
  const retired=load('app/api/radar/checkout/route.ts').POST;const response=await retired(req('/api/radar/checkout'));assert.equal(response.status,410);
  assert.equal(model.checkoutCalls.length,callsBefore);
});

test('billing portal is owned by the account and cannot expose plan switching or immediate cancellation',async()=>{
  const portal=load('app/api/comunidade/assinatura/portal/route.ts').POST;
  process.env.STRIPE_COMMUNITY_PORTAL_CONFIGURATION_ID='bpc_Annual';member='other';
  assert.equal((await portal(req('/api/comunidade/assinatura/portal'))).status,404);
  member='paid';assert.equal((await portal(req('/api/comunidade/assinatura/portal'))).status,303);
  model.portalUpdates=true;assert.equal((await portal(req('/api/comunidade/assinatura/portal'))).status,503);model.portalUpdates=false;
});
test('local review paths cannot enable data fixtures or billing bypasses in production',async()=>{
  const old={node:process.env.NODE_ENV,flag:process.env.APOGEE_FUNCTIONAL_REVIEW,preview:process.env.APOGEE_LOCAL_PREVIEW,url:process.env.DATABASE_URL};
  try {
    process.env.NODE_ENV='production';process.env.APOGEE_FUNCTIONAL_REVIEW='1';process.env.APOGEE_LOCAL_PREVIEW='1';process.env.DATABASE_URL='postgres://example@127.0.0.1/test';
    const guards=load('lib/offer-preview.ts');assert.equal(guards.localFunctionalReview(),false);assert.equal(guards.localOfferPreview(),false);process.env.APOGEE_STRIPE_SANDBOX_REVIEW='1';assert.equal(guards.localStripeSandboxReview(),false);delete process.env.APOGEE_STRIPE_SANDBOX_REVIEW;
  } finally {
    for(const [name,value] of Object.entries({NODE_ENV:old.node,APOGEE_FUNCTIONAL_REVIEW:old.flag,APOGEE_LOCAL_PREVIEW:old.preview,DATABASE_URL:old.url})) {if(value===undefined)delete process.env[name];else process.env[name]=value;}
  }
});

test('operator reconciliation is admin-only, mode/owner-bound and reads canonical invoices without creating payment',async()=>{
  const operationsLoad=opportunityLoader({'@/lib/members/db':{getSql:()=>sql},'@/lib/billing/stripe':{stripeClient:()=>stripe},'./stripe':{stripeClient:()=>stripe},
    '@/lib/members/dal':{requireAdmin:async()=>{if(member!=='admin')throw Error('ADMIN');return {id:'admin',role:'admin'};}}});
  const operations=operationsLoad('lib/billing/community-operations.ts');
  member='other';await assert.rejects(operations.listAnnualMemberships(),/ADMIN/);await assert.rejects(operations.reconcileAnnualMembership('sub_Annual'),/ADMIN/);
  member='admin';await assert.rejects(operations.reconcileAnnualMembership('sub_Foreign'),/encontrada/);
  stripe.invoices.list=async()=>({data:[{id:'in_Annual'}],has_more:false});
  const calls=model.checkoutCalls.length;
  assert.equal(await operations.reconcileAnnualMembership('sub_Annual'),1);
  assert.equal(model.checkoutCalls.length,calls);
  const list=await operations.listAnnualMemberships();assert.ok(list.rows.some(row=>row.id==='sub_Annual'));
  assert.equal(list.cohort, null, 'the reconciliation list remains available before the learning tables exist');
  await sql.unsafe(await readFile(new URL('../drizzle/0020_member_deliverables.sql',import.meta.url),'utf8'));
  await seed('cohort-buyer');
  const before = (await operations.listAnnualMemberships()).cohort;
  await sql`insert into community_subscription(id,user_id,customer_id,livemode,status)
    values('sub_Cohort','cohort-buyer','cus_Cohort',false,'active')`;
  await sql`insert into community_invoice(id,subscription_id,amount,currency,period_start,period_end,status)
    values('in_Cohort','sub_Cohort',143880,'brl',now()-interval '1 day',now()+interval '364 days','paid')`;
  await sql`insert into radar_saved_opportunity(user_id,opportunity_id,snapshot)
    values('cohort-buyer','radar-activation','{}')`;
  const {cohort} = await operations.listAnnualMemberships();
  assert.equal(cohort.buyers,before.buyers+1);assert.equal(cohort.activated,before.activated+1);
  await sql`update community_invoice set status='refunded' where id='in_Cohort'`;
  assert.deepEqual((await operations.listAnnualMemberships()).cohort,before);
  model.sub.customer='cus_Foreign';await assert.rejects(operations.reconcileAnnualMembership('sub_Annual'),/divergente/);model.sub.customer='cus_Annual';
  process.env.COMMUNITY_BILLING_ENABLED='false';assert.equal(await operations.reconcileAnnualMembership('sub_Annual'),1);process.env.COMMUNITY_BILLING_ENABLED='true';
});

test('pausing new sales preserves signed payment processing, refunds, portal and cancellation; failures remain retryable',async()=>{
  const previousModel=model,previousMember=member;
  try {
    resetModel();member='pause-paid';await seed(member);
    model.sub.id='sub_Paused';model.sub.customer='cus_Paused';model.sub.latest_invoice='in_Paused';
    model.invoice.id='in_Paused';model.invoice.customer='cus_Paused';model.invoice.parent.subscription_details.subscription='sub_Paused';
    await sql`insert into community_customer(user_id,livemode,customer_id) values(${member},false,'cus_Paused')`;
    process.env.COMMUNITY_BILLING_ENABLED='false';
    const checkout=load('app/api/comunidade/assinatura/checkout/route.ts').POST;
    assert.equal((await checkout(req('/api/comunidade/assinatura/checkout'))).status,503);
    assert.equal(model.checkoutCalls.length,0,'a pause creates no Checkout session');
    const route=load('app/api/stripe/webhook/route.ts').POST;
    const deliver=async(id,type='invoice.paid')=>{
      const body=JSON.stringify({...event(id,type),data:{object:{id:type==='charge.refunded'?'ch_Annual':'in_Paused'}}});
      const signature=Stripe.webhooks.generateTestHeaderString({payload:body,secret:process.env.STRIPE_WEBHOOK_SECRET});
      return route(new Request('https://apogee.test/api/stripe/webhook',{method:'POST',body,headers:{'stripe-signature':signature}}));
    };
    assert.equal((await deliver('evt_pause_paid')).status,200);
    assert.equal((await access(member,false)).source,'community','a payment completed before the pause is still honored');
    assert.equal((await deliver('evt_pause_paid')).status,200);
    const [count]=await sql`select count(*)::int as n from community_invoice where id='in_Paused'`;assert.equal(count.n,1);
    const portal=load('app/api/comunidade/assinatura/portal/route.ts').POST;
    assert.equal((await portal(req('/api/comunidade/assinatura/portal'))).status,303);
    const cancel=load('app/api/comunidade/assinatura/cancelar/route.ts').POST;
    assert.equal((await cancel(req('/api/comunidade/assinatura/cancelar'))).status,303);
    assert.equal(model.sub.cancel_at_period_end,true);assert.equal((await access(member,false)).active,true);
    model.charge.amount_refunded=amount;
    assert.equal((await deliver('evt_pause_refund','charge.refunded')).status,200);
    assert.equal((await access(member,false)).active,false,'a pause must not hide refunds');
    const retrieve=stripe.paymentIntents.retrieve;
    stripe.paymentIntents.retrieve=async()=>{throw Error('synthetic provider outage');};
    try {
      assert.equal((await deliver('evt_pause_retry')).status,503);
      const [receipt]=await sql`select count(*)::int as n from community_stripe_event where event_id='evt_pause_retry'`;assert.equal(receipt.n,0);
    } finally {stripe.paymentIntents.retrieve=retrieve;}
    assert.equal((await deliver('evt_pause_retry')).status,200,'the failed delivery remains processable');
    delete process.env.STRIPE_COMMUNITY_ANNUAL_PRICE_ID;
    assert.equal((await deliver('evt_pause_bad_config')).status,503,'partial configuration is never acknowledged as processed');
    process.env.STRIPE_COMMUNITY_ANNUAL_PRICE_ID=price.id;
    assert.equal((await deliver('evt_pause_bad_config')).status,200);
  } finally {
    model=previousModel;member=previousMember;process.env.COMMUNITY_BILLING_ENABLED='true';process.env.STRIPE_COMMUNITY_ANNUAL_PRICE_ID=price.id;
  }
});


test('repeated cancellation after resuming renewal performs a fresh idempotent state change and preserves destination',async()=>{
  member='paid';const cancel=load('app/api/comunidade/assinatura/cancelar/route.ts').POST;
  model.sub.cancel_at_period_end=false;const before=model.cancelCalls;
  let response=await cancel(req('/api/comunidade/assinatura/cancelar?next=%2Fmembros%2Ftrilha'));assert.equal(response.status,303);assert.equal(new URL(response.headers.get('location')).searchParams.get('next'),'/membros/trilha');assert.equal(model.cancelCalls,before+1);
  await cancel(req('/api/comunidade/assinatura/cancelar'));assert.equal(model.cancelCalls,before+1,'already cancelled needs no update');
  model.sub.cancel_at_period_end=false;await cancel(req('/api/comunidade/assinatura/cancelar'));assert.equal(model.cancelCalls,before+2,'resumed renewal must be cancellable again');
});

test('annual funnel migration retains old totals and accepts only assigned journey stages', async () => {
  const runSql = async name => {
    const client = await sql.reserve();
    try { await client.unsafe(await readFile(new URL('../sql/' + name, import.meta.url), 'utf8')); }
    finally { await client.release(); }
  };
  await runSql('behavior-daily.sql');
  await sql`insert into apogee_behavior_daily values(current_date, 'home','page_view','view','mobile',7)`;
  await runSql('behavior-annual-funnel.sql');
  for (const [page, event, target] of [
    ['annual_offer','section_view','annual_price'], ['annual_offer','action','annual_choose'],
    ['annual_summary','section_view','account_ready'], ['annual_summary','action','checkout_start'],
    ['annual_summary','section_view','confirmed_return']
  ]) await sql`insert into apogee_behavior_daily values(current_date, ${page},${event},${target},'mobile',1)`;
  await assert.rejects(sql`insert into apogee_behavior_daily values(current_date,'annual_offer','section_view','confirmed_return','mobile',1)`, {code:'23514'});
  const [row] = await sql`select count from apogee_behavior_daily where page='home'`;
  assert.equal(Number(row.count),7);
});
