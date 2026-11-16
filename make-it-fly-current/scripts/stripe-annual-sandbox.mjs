// Dedicated local validation. Never use live keys or an existing database.
// Start through the global npm queue with APOGEE_RUN_STRIPE_SANDBOX=1.
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {createServer} from 'node:http';
import {createInterface} from 'node:readline';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import Stripe from 'stripe';
import {hashPassword} from 'better-auth/crypto';
import {nativeCommunityDatabase} from '../tests/helpers/community-native-db.mjs';
import {migrateCommunityAccess} from './community-access-migrate.mjs';
import {migrateMemberToolbox} from './member-toolbox-migrate.mjs';
import {migrateMemberDeliverables} from './member-deliverables-migrate.mjs';
import {starterTrack,starterModule,starterActivities} from '../content/member-starter.mjs';
import {opportunityLoader} from '../tests/helpers/load-opportunity-module.mjs';

assert.equal(process.env.APOGEE_RUN_STRIPE_SANDBOX,'1','Explicit sandbox flag required.');
const expectedAccount='acct_1R7iASASpZUkiAYG';
const credentials=JSON.parse(execFileSync('python3',['-c',`import json,tomllib,pathlib
p=tomllib.loads(pathlib.Path('/Users/viniciusbrigido/.config/stripe/config.toml').read_text())['apogee-production']
print(json.dumps({'account':p['account_id'],'key':p['test_mode_api_key']}))`],{encoding:'utf8'}));
assert.equal(credentials.account,expectedAccount);
assert.match(credentials.key,/^(?:rk|sk)_test_[A-Za-z0-9]+$/);
const stripe=new Stripe(credentials.key,{maxNetworkRetries:1,timeout:15000});
const account=await stripe.accounts.retrieve();assert.equal(account.id,expectedAccount);
const run=process.env.APOGEE_SANDBOX_RUN ?? `apogee-annual-${Date.now()}`;
assert.match(run,/^apogee-annual-[A-Za-z0-9-]+$/);
const artifacts=process.env.APOGEE_SANDBOX_ARTIFACTS ?? '/private/tmp/apogee-stripe-sandbox-artifacts';
await mkdir(artifacts,{recursive:true});
const origin='http://127.0.0.1:3461',controlPort=3472,token=randomBytes(24).toString('hex');
const metadata={validation_run:run,purpose:'annual_checkout_sandbox'};
const userId=username=>`${run}:${username}`;
const redact=value=>String(value).replace(/\b(?:sk|rk|pk)_(?:test|live)_[A-Za-z0-9]+/g,'[REDACTED_KEY]').replace(/whsec_[A-Za-z0-9]+/g,'[REDACTED_WEBHOOK]');
const log=(message)=>console.log(redact(message));
let db,listener,server,control,closing=false,clockCase=null;
let evidence={run,account:expectedAccount,livemode:false,startedAt:new Date().toISOString(),actions:[]};
try { const old=JSON.parse(await readFile(`${artifacts}/evidence.json`,'utf8'));if(old.run===run && old.account===expectedAccount && old.livemode===false){evidence=old;clockCase=old.clockCase??null;} } catch(error){if(error.code!=='ENOENT')throw error;}
async function save(){await writeFile(`${artifacts}/evidence.json`,JSON.stringify(evidence,null,2));}
async function stop(code=0){
  if(closing)return;closing=true;
  control?.close();server?.kill('SIGTERM');listener?.kill('SIGTERM');
  if(db)await db.close();await save();process.exit(code);
}
process.on('SIGTERM',()=>void stop());process.on('SIGINT',()=>void stop());
try {
  const product=await stripe.products.create({name:'Comunidade Apogee anual — TESTE',description:'Recurso exclusivo da validação do checkout; sem cobrança real.',metadata},{idempotencyKey:`${run}-product`});
  assert.equal(product.livemode,false);
  const price=await stripe.prices.create({product:product.id,currency:'brl',unit_amount:143880,recurring:{interval:'year'},metadata},{idempotencyKey:`${run}-price`});
  assert.equal(price.livemode,false);assert.equal(price.recurring.interval,'year');
  const portal=await stripe.billingPortal.configurations.create({
    business_profile:{headline:'Comunidade Apogee — ambiente de teste'},default_return_url:`${origin}/membros/assinatura`,
    features:{invoice_history:{enabled:true},payment_method_update:{enabled:true},customer_update:{enabled:false},
      subscription_cancel:{enabled:true,mode:'at_period_end',proration_behavior:'none'},subscription_update:{enabled:false}},metadata,
  },{idempotencyKey:`${run}-portal`});
  assert.equal(portal.livemode,false);
  evidence.product=product.id;evidence.price=price.id;evidence.portal=portal.id;await save();
  let previous;
  try { previous=JSON.parse(await readFile('/private/tmp/apogee-stripe-sandbox-state.json','utf8')); } catch(error){if(error.code!=='ENOENT')throw error;}
  if(previous?.run===run && previous.account===expectedAccount && previous.livemode===false && previous.dir) {
    try { db=await nativeCommunityDatabase({directory:previous.dir,preserve:true}); } catch(error){if(error.code!=='ENOENT')throw error;}
  }
  db??=await nativeCommunityDatabase({preserve:true});await migrateCommunityAccess(db.sql,{apply:true,expectedRole:'apogee_local'});await migrateMemberToolbox(db.sql,{apply:true,expectedRole:'apogee_local'});await migrateMemberDeliverables(db.sql,{apply:true,expectedRole:'apogee_local'});
  if(!db.resumed) {
  const password=await hashPassword('RevisaoLocal2026!');
  for(const username of ['sandboxcompra','sandboxrecusa','sandboxcontrole','sandboxlegado','sandboxciclo']) {
    const id=userId(username);
    await db.sql`insert into "user"(id,name,email,email_verified,username,adult_declared) values(${id},'Pessoa Teste',${username+'@example.test'},true,${username},true)`;
    await db.sql`insert into account(id,account_id,provider_id,user_id,password) values(${id},${id},'credential',${id},${password})`;
    await db.sql`insert into member_adult_review(user_id,status,reviewed_at,evidence_reference) values(${id},'approved',now(),'sandbox_test_only')`;
    if(username!=='sandboxlegado')for(let n=1;n<=10;n++)await db.sql`insert into radar_free_event(user_id,opportunity_id,slot) values(${id},${'radar-review-event-'+n},${n})`;
  }
  await db.sql`insert into radar_legacy_access(user_id) values(${userId('sandboxlegado')})`;
  const editor=userId('sandboxciclo');
  await db.sql`insert into member_learning_track(id,name,description,status,reviewed_by) values(${starterTrack.id},${starterTrack.name},${starterTrack.description},'published',${editor})`;
  await db.sql`insert into member_learning_module(id,track_id,name,description,deliverable,status,reviewed_by) values(${starterModule.id},${starterTrack.id},${starterModule.name},${starterModule.description},${starterModule.deliverable},'published',${editor})`;
  for(const [order,a] of starterActivities.entries()) await db.sql`insert into member_learning_activity(id,module_id,name,instructions,status,sort_order,reviewed_by) values(${a.id},${starterModule.id},${a.name},${a.instructions},'published',${order},${editor})`;
  await db.sql`insert into member_tool_category(id,slug,name,status) values('local-video','video','Vídeo','published')`;
  await db.sql`insert into member_tool(id,category_id,name,description,url,status,reviewed_at,reviewed_by) values('local-flow','local-video','Google Flow','Criação de vídeos com inteligência artificial.','https://labs.google/fx/tools/flow','published',now(),${editor})`;

  }
  const {COMMUNITY_STRIPE_EVENTS}=opportunityLoader()('lib/billing/community-fulfillment.ts');
  let resolveSecret,rejectSecret;
  const secretPromise=new Promise((resolve,reject)=>{resolveSecret=resolve;rejectSecret=reject;});
  const secretTimer=setTimeout(()=>rejectSecret(Error('Stripe listener readiness timeout.')),30000);
  const cli=process.env.APOGEE_STRIPE_CLI ?? '/opt/homebrew/bin/stripe';
  const cliHelp=execFileSync(cli,['--config',`${db.dir}/stripe-cli.toml`,'listen','--help'],{encoding:'utf8'});
  listener=spawn(cli,[
    '--config',`${db.dir}/stripe-cli.toml`,'--color','off','listen','--skip-update','--latest',...(cliHelp.includes('--events-from')?['--events-from','@self']:[]),'--events',COMMUNITY_STRIPE_EVENTS.join(','),'--forward-to',`${origin}/api/stripe/webhook`],
    {env:{...process.env,STRIPE_API_KEY:credentials.key},stdio:['ignore','pipe','pipe']});
  listener.once('error',rejectSecret);listener.once('exit',code=>{if(!closing)rejectSecret(Error(`Stripe listener exited: ${code}`));});
  for(const stream of [listener.stdout,listener.stderr])createInterface({input:stream}).on('line',line=>{
    const match=line.match(/whsec_[A-Za-z0-9]+/);if(match){clearTimeout(secretTimer);resolveSecret(match[0]);}
    log(`[stripe-cli] ${line}`);
  });
  const webhookSecret=await secretPromise;
  const inherited=Object.fromEntries(['PATH','HOME','TMPDIR','LANG','PG_BIN'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
  const env={...inherited,NODE_OPTIONS:'--max-old-space-size=2048',NEXT_TELEMETRY_DISABLED:'1',NODE_ENV:'development',APOGEE_LOCAL_PREVIEW:'1',APOGEE_FUNCTIONAL_REVIEW:'0',APOGEE_STRIPE_SANDBOX_REVIEW:'1',
    DATABASE_URL:db.url,DATABASE_SSL_MODE:'disable',DATABASE_POOL_MAX:'2',BETTER_AUTH_URL:origin,BETTER_AUTH_SECRET:randomBytes(32).toString('hex'),
    STRIPE_MODE:'test',STRIPE_SECRET_KEY:credentials.key,STRIPE_WEBHOOK_SECRET:webhookSecret,
    STRIPE_COMMUNITY_PRODUCT_ID:product.id,STRIPE_COMMUNITY_ANNUAL_PRICE_ID:price.id,STRIPE_COMMUNITY_PORTAL_CONFIGURATION_ID:portal.id,
    COMMUNITY_BILLING_ENABLED:'true',RADAR_BILLING_ENABLED:'false',MEMBERS_EMAIL_ENABLED:'false',MEMBERS_RESEND_API_KEY:'',
    MEMBERS_SUPERVISED_REGISTRATION_ENABLED:'true',GOOGLE_CLIENT_ID:'',GOOGLE_CLIENT_SECRET:'',MCP_ENABLED:'false',RADAR_GOOGLE_CALENDAR_ENABLED:'false'};
  server=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--webpack','-H','127.0.0.1','-p','3461'],{env,stdio:['ignore','pipe','pipe']});
  for(const stream of [server.stdout,server.stderr])stream.on('data',chunk=>process.stdout.write(redact(chunk)));
  server.once('exit',code=>{if(!closing)void stop(code??1);});
  async function snapshot(){
    const local=await db.sql`select u.username as account,count(distinct f.opportunity_id)::int as events,
      exists(select 1 from radar_legacy_access l where l.user_id=u.id) as legacy,
      exists(select 1 from community_subscription s join community_invoice i on i.subscription_id=s.id where s.user_id=u.id and s.livemode=false and i.status='paid' and not i.fraud_review_required and i.period_start<=now() and i.period_end>now()) as annual_active
      from "user" u left join radar_free_event f on f.user_id=u.id group by u.id order by u.id`;
    const subscriptions=await db.sql`select id,user_id,status,cancel_at_period_end from community_subscription order by user_id`;
    const invoices=await db.sql`select id,subscription_id,amount,currency,period_start,period_end,status,fraud_review_required,payment_intent_id from community_invoice order by period_start,id`;
    const events=await db.sql`select event_id,event_type,processed_at from community_stripe_event order by processed_at`;
    const customers=await db.sql`select user_id,customer_id from community_customer where livemode=false order by user_id`;
    const remote=[];
    for(const owner of customers){
      const list=await stripe.subscriptions.list({customer:owner.customer_id,status:'all',limit:10});
      for(const sub of list.data){assert.equal(sub.livemode,false);remote.push({id:sub.id,user:owner.user_id,status:sub.status,cancelAtPeriodEnd:sub.cancel_at_period_end,
        items:sub.items.data.map(i=>({price:i.price.id,amount:i.price.unit_amount,currency:i.price.currency,interval:i.price.recurring?.interval,start:i.current_period_start,end:i.current_period_end}))});}
    }
    const clock=clockCase?await stripe.testHelpers.testClocks.retrieve(clockCase.clock):null;
    const result={local,subscriptions,invoices,events,customers,remote,clock:clock?{id:clock.id,status:clock.status,frozen_time:clock.frozen_time}:null};
    evidence.latest=result;await save();return result;
  }
  async function action(name){
    if(name==='status')return snapshot();
    if(name==='finish'){await snapshot();setTimeout(()=>void stop(),150);return {stopping:true};}
    if(name==='refund'){
      const [owned]=await db.sql`select i.payment_intent_id from community_invoice i join community_subscription s on s.id=i.subscription_id where s.user_id=${userId('sandboxcompra')} and s.livemode=false and i.status='paid' order by i.period_start desc limit 1`;
      assert.ok(owned?.payment_intent_id);const intent=await stripe.paymentIntents.retrieve(owned.payment_intent_id);assert.equal(intent.livemode,false);
      const refund=await stripe.refunds.create({payment_intent:intent.id,metadata},{idempotencyKey:`${run}-refund`});
      evidence.actions.push({action:name,id:refund.id,status:refund.status,at:new Date().toISOString()});await save();return {id:refund.id,status:refund.status};
    }
    if(name==='clock-start'){
      assert.equal(clockCase,null);const clock=await stripe.testHelpers.testClocks.create({frozen_time:Math.floor(Date.now()/1000),name:run});
      const customer=await stripe.customers.create({name:'Teste de renovação anual',email:'sandboxciclo@example.test',test_clock:clock.id,payment_method:'pm_card_visa',invoice_settings:{default_payment_method:'pm_card_visa'},metadata},{idempotencyKey:`${run}-clock-customer`});
      assert.equal(customer.livemode,false);await db.sql`insert into community_customer(user_id,livemode,customer_id) values(${userId('sandboxciclo')},false,${customer.id})`;
      const sub=await stripe.subscriptions.create({customer:customer.id,items:[{price:price.id}],metadata:{...metadata,integration:'apogee_community_annual_v1'},payment_behavior:'error_if_incomplete'},{idempotencyKey:`${run}-clock-subscription`});
      assert.equal(sub.livemode,false);clockCase={clock:clock.id,customer:customer.id,subscription:sub.id};evidence.clockCase=clockCase;
      evidence.actions.push({action:name,...clockCase,at:new Date().toISOString()});await save();return clockCase;
    }
    if(name==='reconcile'){
      const owners=await db.sql`select customer_id from community_customer where livemode=false`;
      const refreshed=[];
      for(const owner of owners){
        const list=await stripe.subscriptions.list({customer:owner.customer_id,status:'all',limit:10});
        for(const sub of list.data){assert.equal(sub.livemode,false);await stripe.subscriptions.update(sub.id,{metadata:{validation_run:run,validation_refresh:String(Date.now())}});refreshed.push(sub.id);}
      }
      evidence.actions.push({action:name,subscriptions:refreshed,at:new Date().toISOString()});await save();return {refreshed};
    }
    assert.ok(clockCase);
    if(name==='clock-renew'||name==='clock-finalize'){
      const clock=await stripe.testHelpers.testClocks.retrieve(clockCase.clock);assert.equal(clock.status,'ready');
      const sub=await stripe.subscriptions.retrieve(clockCase.subscription);assert.equal(sub.livemode,false);
      const target=name==='clock-renew'?sub.items.data[0].current_period_end+2:clock.frozen_time+3700;
      const advanced=await stripe.testHelpers.testClocks.advance(clock.id,{frozen_time:target});
      evidence.actions.push({action:name,frozen_time:target,at:new Date().toISOString()});await save();return {status:advanced.status,frozen_time:advanced.frozen_time};
    }
    if(name==='clock-fail-card'){
      const method=await stripe.paymentMethods.attach('pm_card_chargeCustomerFail',{customer:clockCase.customer});assert.equal(method.livemode,false);
      await stripe.customers.update(clockCase.customer,{invoice_settings:{default_payment_method:method.id}});
      await stripe.subscriptions.update(clockCase.subscription,{default_payment_method:method.id});
      evidence.actions.push({action:name,at:new Date().toISOString()});await save();return {configured:true};
    }
    if(name==='clock-cancel'){
      const sub=await stripe.subscriptions.cancel(clockCase.subscription,{invoice_now:false,prorate:false});assert.equal(sub.livemode,false);
      evidence.actions.push({action:name,subscription:sub.id,status:sub.status,at:new Date().toISOString()});await save();return {id:sub.id,status:sub.status};
    }
    throw Error('Unknown action.');
  }
  control=createServer(async(req,res)=>{
    if(req.headers['x-apogee-validation-token']!==token){res.writeHead(403);return res.end();}
    const name=(req.url??'').slice(1);if((name==='status'&&req.method!=='GET')||(name!=='status'&&req.method!=='POST')){res.writeHead(405);return res.end();}
    try{const result=await action(name);res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(result));}
    catch(error){log(`Control ${name}: ${error.message}`);res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:redact(error.message)}));}
  });
  await new Promise((resolve,reject)=>{control.once('error',reject);control.listen(controlPort,'127.0.0.1',resolve);});
  await writeFile('/private/tmp/apogee-stripe-sandbox-state.json',JSON.stringify({run,account:expectedAccount,livemode:false,product:product.id,price:price.id,portal:portal.id,database:db.url,dir:db.dir,data:db.data,controlPort,token,pid:process.pid}),{mode:0o600});
  await snapshot();log(`Sandbox ready: ${run}; account=${expectedAccount}; livemode=false; ${origin}/previa/stripe`);
} catch(error){log(`Sandbox not started: ${error.message}`);await stop(1);}
