import "server-only";
import { randomUUID } from "node:crypto";
import { getSql } from "@/lib/members/db";
import { applicationOrigin } from "@/lib/members/mail";
import { BillingError } from "./config";
import { communityBillingConfig,COMMUNITY_TAG,COMMUNITY_ACCESS_PATH } from "./community-config";
import { communityAccess } from "./community-store";
import { validAnnualPrice } from "./community-fulfillment";
import { stripeClient } from "./stripe";

export async function annualCheckout(userId:string,next:string) {
  const config=communityBillingConfig(),stripe=stripeClient();
  if((await communityAccess(userId,config.livemode)).active) return `${applicationOrigin()}${COMMUNITY_ACCESS_PATH}`;
  const price=await stripe.prices.retrieve(config.price);
  if(!validAnnualPrice(price,config)) throw new BillingError(503,"Plano anual indisponível.");
  const attempt=await getSql().begin(async tx=>{
    const [user]=await tx`select id,email from "user" where id=${userId} and blocked=false for update`;
    if(!user) throw new BillingError(401,"Entre na sua conta para continuar.");
    const [pending]=await tx`select request_key,return_path,expires_at from community_checkout_attempt where user_id=${userId} and livemode=${config.livemode} and expires_at>now()`;
    if(pending) return {key:String(pending.request_key),email:String(user.email),next:String(pending.return_path),expiresAt:Math.floor(new Date(pending.expires_at).getTime()/1000)};
    const key=randomUUID();
    await tx`insert into community_checkout_attempt(user_id,livemode,request_key,return_path,expires_at)
      values(${userId},${config.livemode},${key},${next},now()+interval '1 hour')
      on conflict(user_id,livemode) do update set request_key=excluded.request_key,return_path=excluded.return_path,expires_at=excluded.expires_at`;
    const [created]=await tx`select expires_at from community_checkout_attempt where user_id=${userId} and livemode=${config.livemode}`;
    return {key,email:String(user.email),next,expiresAt:Math.floor(new Date(created.expires_at).getTime()/1000)};
  });
  let [owner]=await getSql()`select customer_id from community_customer where user_id=${userId} and livemode=${config.livemode}`;
  if(!owner) {
    const customer=await stripe.customers.create({email:attempt.email}, {idempotencyKey:`community-customer-${config.livemode}-${userId}`});
    await getSql()`insert into community_customer(user_id,livemode,customer_id) values(${userId},${config.livemode},${customer.id}) on conflict(user_id,livemode) do nothing`;
    [owner]=await getSql()`select customer_id from community_customer where user_id=${userId} and livemode=${config.livemode}`;
  }
  if(!owner) throw new BillingError(503,"Não foi possível preparar sua assinatura.");
  const customerId=String(owner.customer_id);
  const subscriptions=await stripe.subscriptions.list({customer:customerId,status:"all",limit:100});
  if(subscriptions.has_more || subscriptions.data.some(sub=>!["canceled","incomplete_expired"].includes(sub.status))) {
    throw new BillingError(409,"Já existe uma assinatura ou pagamento em andamento. Consulte sua assinatura antes de tentar novamente.");
  }
  const suffix=attempt.key.replaceAll("-","").slice(0,8).split("").map(c=>String.fromCharCode(97+parseInt(c,16))).join("");
  const session=await stripe.checkout.sessions.create({mode:"subscription",customer:customerId,
    line_items:[{price:config.price,quantity:1}],client_reference_id:userId,adaptive_pricing:{enabled:false},
    integration_identifier:`apogee_annual_${suffix}`,
    subscription_data:{metadata:{integration:COMMUNITY_TAG}},
    expires_at:attempt.expiresAt,
    success_url:`${applicationOrigin()}${COMMUNITY_ACCESS_PATH}?payment=received&next=${encodeURIComponent(attempt.next)}`,
    cancel_url:`${applicationOrigin()}${COMMUNITY_ACCESS_PATH}?payment=cancelled&next=${encodeURIComponent(attempt.next)}`,
  },{idempotencyKey:`community-annual-${config.livemode}-${attempt.key}`});
  if(!session.url || new URL(session.url).origin !== "https://checkout.stripe.com") throw new BillingError(503,"Checkout indisponível.");
  return session.url;
}
