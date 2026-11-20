import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { opportunityLoader } from './helpers/load-opportunity-module.mjs';
import { nativeCommunityDatabase } from './helpers/community-native-db.mjs';
import { migrateGuestCheckout } from '../scripts/community-guest-checkout-migrate.mjs';
let db, sql, load, stripe, session, sub, invoice, start, claim, fulfill, access, attempt, member = null, cookie;
let createCalls = [], refund = 0, paid = true;
const amount = 143880, now = Math.floor(Date.now()/1000);
const price = { id:'price_Annual',product:'prod_Annual',active:true,livemode:false,type:'recurring',currency:'brl',unit_amount:amount,recurring:{interval:'year',interval_count:1,usage_type:'licensed'} };
const req = (path, origin = 'https://apogee.test') => new Request(`https://apogee.test${path}`,{method:'POST',headers:{origin}});
before(async () => {
  db = await nativeCommunityDatabase(); sql = db.sql;
  await sql.unsafe(await readFile(new URL('../drizzle/0017_community_annual.sql',import.meta.url),'utf8'));
  Object.assign(process.env,{COMMUNITY_BILLING_ENABLED:'true',COMMUNITY_GUEST_CHECKOUT_ENABLED:'true',STRIPE_MODE:'test',STRIPE_SECRET_KEY:'sk_test_Synthetic',STRIPE_COMMUNITY_ANNUAL_PRICE_ID:price.id,STRIPE_COMMUNITY_PRODUCT_ID:price.product});
  invoice = {id:'in_Guest',livemode:false,customer:'cus_Guest',parent:{subscription_details:{subscription:'sub_Guest'}},status:'paid',currency:'brl',total:amount,amount_paid:amount,amount_remaining:0,billing_reason:'subscription_create'};
  stripe = {
    prices:{retrieve:async()=>structuredClone(price)},customers:{create:async()=>({id:'cus_Guest'})},
    checkout:{sessions:{create:async(params,opts)=>{createCalls.push({params,opts});session={...params,id:'cs_test_GuestSession1234567890',url:'https://checkout.stripe.com/c/pay/synthetic',status:'open',livemode:false,customer_details:null,subscription:null};return session;},retrieve:async()=>structuredClone(session)}},
    subscriptions:{retrieve:async()=>structuredClone(sub),list:async()=>({data:[],has_more:false}),update:async(id,values)=>{Object.assign(sub,values);return sub;}},
    invoices:{list:async()=>({data:[invoice],has_more:false}),retrieve:async()=>({...invoice,status:paid?'paid':'open'}),listLineItems:async()=>({has_more:false,data:[{quantity:1,amount,currency:'brl',pricing:{price_details:{price:price.id}},parent:{subscription_item_details:{proration:false}},period:{start:now-3600,end:now-3600+365*86400}}]})},
    invoicePayments:{list:async()=>({has_more:false,data:[{invoice:invoice.id,livemode:false,amount_paid:amount,currency:'brl',payment:{type:'payment_intent',payment_intent:'pi_Guest'}}]})},
    paymentIntents:{retrieve:async()=>({status:'succeeded',amount,amount_received:amount,currency:'brl',livemode:false,latest_charge:{id:'ch_Guest',livemode:false,amount,currency:'brl',paid:true,captured:true,amount_refunded:refund,disputed:false}})},
    radar:{earlyFraudWarnings:{list:async()=>({data:[],has_more:false})}},
    billingPortal:{configurations:{retrieve:async()=>({active:true,livemode:false,features:{subscription_update:{enabled:false},subscription_cancel:{enabled:true,mode:'at_period_end'}}})},sessions:{create:async(params)=>({url:`https://billing.stripe.com/p/${params.customer}`})}},
  };
  load = opportunityLoader({
    '@/lib/members/db':{getSql:()=>sql},'./stripe':{stripeClient:()=>stripe},'@/lib/billing/stripe':{stripeClient:()=>stripe},
    '@/lib/members/mail':{applicationOrigin:()=> 'https://apogee.test'},'@/lib/members/client-ip':{memberClientIp:()=> '127.0.0.1'},
    '@/lib/members/dal':{getMemberFromHeaders:async()=>member?{id:member}:null},'@/lib/members/rate-limit':{consumeRateLimit:async()=>true},
    'next/headers':{cookies:async()=>({get:()=>cookie?{value:cookie}:undefined})},
  });
  ({guestAnnualCheckout:start,claimGuestAnnualCheckout:claim}=load('lib/billing/community-guest-checkout.ts'));
  fulfill=load('lib/billing/community-fulfillment.ts').fulfillCommunityEvent;
  access=load('lib/billing/community-store.ts').communityAccess;
  for(const [id,verified] of [['buyer',false],['stranger',true]]) await sql`insert into "user"(id,name,email,email_verified,created_at,updated_at) values(${id},'Teste',${id+'@example.test'},${verified},now(),now())`;
});
after(async()=>{await db?.close();});
test('guest schema is additive, repeatable and refuses drift',async()=>{
  assert.deepEqual(await migrateGuestCheckout(sql,{expectedRole:'apogee_local'}),{pending:true,changed:false});
  assert.equal((await migrateGuestCheckout(sql,{expectedRole:'apogee_local',apply:true})).changed,true);
  assert.equal((await migrateGuestCheckout(sql,{expectedRole:'apogee_local',apply:true})).changed,false);
  await sql`alter table community_guest_checkout add column unexpected text`;
  await assert.rejects(migrateGuestCheckout(sql,{expectedRole:'apogee_local',apply:true}),/Colunas/);
  await sql`alter table community_guest_checkout drop column unexpected`;
});
test('anonymous CTA opens Stripe directly, fixes annual price and stores a secure retry cookie',async()=>{
  const route=load('app/api/comunidade/assinatura/iniciar/route.ts').POST;
  assert.equal((await route(req('/api/comunidade/assinatura/iniciar','https://evil.test'))).status,403);
  assert.equal(createCalls.length,0);
  const response=await route(req('/api/comunidade/assinatura/iniciar?next=%2Fmembros%2Fferramentas'));
  assert.equal(response.status,303);assert.match(response.headers.get('location'),/^https:\/\/checkout.stripe.com\//);
  assert.match(response.headers.get('set-cookie'),/HttpOnly/i);assert.match(response.headers.get('set-cookie'),/SameSite=lax/i);assert.match(response.headers.get('set-cookie'),/Secure/i);
  [attempt]=await sql`select * from community_guest_checkout`;cookie=attempt.id;
  const {params}=createCalls[0];assert.equal(params.mode,'subscription');assert.deepEqual(params.line_items,[{price:price.id,quantity:1}]);assert.equal(params.customer,'cus_Guest');assert.equal(params.client_reference_id,attempt.id);
  assert.ok(params.success_url.includes('{CHECKOUT_SESSION_ID}'));assert.equal(params.adaptive_pricing.enabled,false);
  await start(attempt.id,'https://evil.test');assert.equal(createCalls.length,1,'an open session is reused');
  assert.equal((await access('buyer',false)).active,false);
});
test('webhook before signup retains the purchase without granting access; return URL alone grants nothing',async()=>{
  session.status='complete';session.customer_details={email:'Buyer@Example.test'};session.subscription='sub_Guest';
  sub={id:'sub_Guest',livemode:false,customer:'cus_Guest',status:'active',cancel_at_period_end:false,metadata:session.subscription_data.metadata,latest_invoice:'in_Guest',items:{has_more:false,data:[{quantity:1,price}]}};
  const event={id:'evt_GuestBeforeAccount',type:'checkout.session.completed',livemode:false,data:{object:{id:session.id}}};
  await fulfill(event);
  const [row]=await sql`select email,user_id,status from community_guest_checkout where id=${attempt.id}`;
  assert.deepEqual(row,{email:'buyer@example.test',user_id:null,status:'complete'});
  assert.equal((await access('buyer',false)).active,false);
  assert.equal(await fulfill(event),'duplicate');
  assert.match((await start(attempt.id,'/membros')).url,/\/comunidade\/ativar$/);
});
test('unverified email and another account cannot claim a purchase',async()=>{
  await assert.rejects(claim('buyer'),e=>e.status===403);
  await assert.rejects(claim('stranger'),e=>e.status===404);
  await sql`update "user" set email_verified=true where id='buyer'`;
  await sql`update "user" set blocked=true where id='buyer'`;
  await assert.rejects(claim('buyer'),e=>e.status===401);
  await sql`update "user" set blocked=false where id='buyer'`;
});
test('verified email recovers across browsers, reconciles an earlier webhook and preserves an existing customer mapping',async()=>{
  await sql`insert into community_customer(user_id,livemode,customer_id) values('buyer',false,'cus_Older')`;
  cookie=undefined;
  assert.equal(await claim('buyer'),'/membros/ferramentas');
  assert.equal((await access('buyer',false)).active,true);
  assert.equal((await access('buyer',true)).active,false);
  const [mapping]=await sql`select customer_id from community_customer where user_id='buyer'`;assert.equal(mapping.customer_id,'cus_Older');
  assert.equal(await claim('buyer'),'/membros/ferramentas');
  const [count]=await sql`select count(*)::int as n from community_subscription where user_id='buyer'`;assert.equal(count.n,1);
});
test('refund before or after claim is read canonically; replay never restores access',async()=>{
  refund=amount;
  await claim('buyer');assert.equal((await access('buyer',false)).active,false);
  await claim('buyer');assert.equal((await access('buyer',false)).active,false);
  refund=0;paid=false;await claim('buyer');assert.equal((await access('buyer',false)).active,false);
  paid=true;await claim('buyer');assert.equal((await access('buyer',false)).active,true);
});
test('guest-owned subscription can cancel renewal and open its own portal during a sales pause',async()=>{
  member='buyer';process.env.COMMUNITY_BILLING_ENABLED='false';process.env.COMMUNITY_GUEST_CHECKOUT_ENABLED='false';process.env.STRIPE_COMMUNITY_PORTAL_CONFIGURATION_ID='bpc_Test';
  await assert.rejects(start(undefined,'/membros'),e=>e.status===503);
  assert.equal(await claim('buyer'),'/membros/ferramentas');
  const cancel=await load('app/api/comunidade/assinatura/cancelar/route.ts').POST(req('/api/comunidade/assinatura/cancelar'));
  assert.equal(cancel.status,303);assert.equal(sub.cancel_at_period_end,true);assert.equal((await access('buyer',false)).active,true);
  const portal=await load('app/api/comunidade/assinatura/portal/route.ts').POST(req('/api/comunidade/assinatura/portal'));
  assert.equal(portal.headers.get('location'),'https://billing.stripe.com/p/cus_Guest');
});
