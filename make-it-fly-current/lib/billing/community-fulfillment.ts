import "server-only";
import type Stripe from "stripe";
import { getSql } from "@/lib/members/db";
import { communityServiceConfig, COMMUNITY_AMOUNT, COMMUNITY_CURRENCY, COMMUNITY_TAG } from "./community-config";
import { recordGuestSession } from "./community-guest-store";
import { stripeClient } from "./stripe";

export const COMMUNITY_STRIPE_EVENTS = ["checkout.session.completed","checkout.session.async_payment_succeeded",
  "customer.subscription.created","customer.subscription.updated","customer.subscription.deleted",
  "invoice.paid","invoice.payment_failed","invoice.voided","invoice.marked_uncollectible",
  "charge.refunded","charge.dispute.created","charge.dispute.closed","radar.early_fraud_warning.created"] as const;
const objectId=(value: string | {id:string} | null | undefined)=>typeof value === "string" ? value : value?.id;

export function validAnnualPrice(price: Stripe.Price, config: ReturnType<typeof communityServiceConfig>, requireActive=true) {
  return (!requireActive || price.active) && price.livemode === config.livemode && price.type === "recurring" &&
    price.currency === COMMUNITY_CURRENCY && price.unit_amount === COMMUNITY_AMOUNT &&
    objectId(price.product) === config.product && price.id === config.price &&
    price.recurring?.interval === "year" && price.recurring.interval_count === 1 && price.recurring.usage_type === "licensed";
}

/** Current Stripe state is read under the subscription lock, never trusted from a stale payload. */
export async function fulfillCommunityEvent(event: Stripe.Event): Promise<string> {
  if (!COMMUNITY_STRIPE_EVENTS.includes(event.type as typeof COMMUNITY_STRIPE_EVENTS[number])) return "ignored";
  const config=communityServiceConfig();
  if (event.account || event.livemode !== config.livemode) return "ignored";
  const stripe=stripeClient();
  const input=event.data.object as unknown as {id:string;payment_intent?:string;charge?:string};
  const targets=new Map<string,string|null>();
  let fraudCharge: string|undefined;
  if (event.type.startsWith("customer.subscription.")) targets.set(input.id,null);
  else if (event.type.startsWith("checkout.session.")) {
    const session=await stripe.checkout.sessions.retrieve(input.id);
    if (session.mode !== "subscription" || session.livemode !== config.livemode) return "ignored";
    await recordGuestSession(session);
    const sub=objectId(session.subscription); if(sub) targets.set(sub,null);
  } else if (event.type.startsWith("invoice.")) {
    const invoice=await stripe.invoices.retrieve(input.id);
    const sub=objectId(invoice.parent?.subscription_details?.subscription); if(sub) targets.set(sub,invoice.id);
  } else {
    let intent: string|undefined;
    if (event.type === "charge.refunded") {
      const charge=await stripe.charges.retrieve(input.id); intent=objectId(charge.payment_intent);
    } else if (event.type.startsWith("charge.dispute.")) {
      const dispute=await stripe.disputes.retrieve(input.id); intent=objectId(dispute.payment_intent);
    } else {
      const warning=await stripe.radar.earlyFraudWarnings.retrieve(input.id);
      fraudCharge=objectId(warning.charge); intent=objectId(warning.payment_intent);
    }
    if (!intent) return "ignored";
    const payments=await stripe.invoicePayments.list({payment:{type:"payment_intent",payment_intent:intent},limit:100});
    if(payments.has_more) throw new Error("Pagamentos exigem conciliação adicional.");
    for(const payment of payments.data) {
      const id=objectId(payment.invoice); if(!id) continue;
      const invoice=await stripe.invoices.retrieve(id);
      const sub=objectId(invoice.parent?.subscription_details?.subscription); if(sub) targets.set(sub,invoice.id);
    }
  }
  if (!targets.size) return "ignored";
  return getSql().begin(async tx=>{
    await tx`select set_config('lock_timeout','5s',true)`;
    // A deterministic order also prevents deadlocks for multi-invoice payment events.
    for(const id of [...targets.keys()].sort()) await tx`select pg_advisory_xact_lock(hashtextextended(${`community:${id}`},0))`;
    const receipt=await tx`insert into community_stripe_event(event_id,event_type) values(${event.id},${event.type}) on conflict do nothing returning event_id`;
    if(!receipt.length) return "duplicate";
    let matched=false;
    for(const [id,invoiceId] of targets) {
      const sub=await stripe.subscriptions.retrieve(id);
      if(sub.livemode !== config.livemode || sub.items.has_more || sub.items.data.length !== 1) continue;
      const item=sub.items.data[0];
      const [known]=await tx`select user_id,customer_id,livemode from community_subscription where id=${sub.id}`;
      if(!known && (item.quantity !== 1 || !validAnnualPrice(item.price,config,false))) continue;
      const customer=objectId(sub.customer); if(!customer) continue;
      const owners=await tx`select user_id from community_customer where customer_id=${customer} and livemode=${config.livemode}
        union select user_id from community_guest_checkout where customer_id=${customer} and livemode=${config.livemode} and user_id is not null`;
      if (owners.length > 1) throw new Error("Vínculo de cliente divergente.");
      const [owner]=owners;
      // Account-first mapping or an email-verified post-purchase claim.
      if(!owner || (!known && sub.metadata.integration !== COMMUNITY_TAG)) continue;
      const [existing]=await tx`select user_id,customer_id,livemode from community_subscription where id=${sub.id}`;
      if(existing && (existing.user_id !== owner.user_id || existing.customer_id !== customer || existing.livemode !== config.livemode)) throw new Error("Vínculo divergente.");
      await tx`insert into community_subscription(id,user_id,customer_id,livemode,status,cancel_at_period_end)
        values(${sub.id},${String(owner.user_id)},${customer},${config.livemode},${sub.status},${sub.cancel_at_period_end})
        on conflict(id) do update set status=excluded.status,cancel_at_period_end=excluded.cancel_at_period_end,updated_at=now()`;
      matched=true;
      const requested=invoiceId ?? objectId(sub.latest_invoice);
      if(!requested) continue;
      const invoice=await stripe.invoices.retrieve(requested);
      if(invoice.livemode !== config.livemode || objectId(invoice.customer) !== customer || objectId(invoice.parent?.subscription_details?.subscription) !== sub.id) continue;
      const lines=await stripe.invoices.listLineItems(invoice.id,{limit:2});
      const line=lines.data[0];
      if(lines.has_more || lines.data.length !== 1 || line.quantity !== 1 || line.amount !== COMMUNITY_AMOUNT || line.currency !== COMMUNITY_CURRENCY ||
        line.pricing?.price_details?.price !== config.price || line.parent?.subscription_item_details?.proration ||
        !["subscription_create","subscription_cycle"].includes(invoice.billing_reason ?? "")) continue;
      const start=line.period.start,end=line.period.end;
      if(!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || end-start<360*86400 || end-start>370*86400) continue;
      let status="unpaid",paymentIntent:string|null=null,chargeId:string|null=null;
      if(invoice.status === "paid" && invoice.currency === COMMUNITY_CURRENCY && invoice.total === COMMUNITY_AMOUNT && invoice.amount_paid === COMMUNITY_AMOUNT && invoice.amount_remaining === 0) {
        const payments=await stripe.invoicePayments.list({invoice:invoice.id,status:"paid",limit:2});
        const payment=payments.data[0];
        if(!payments.has_more && payments.data.length === 1 && payment.amount_paid === COMMUNITY_AMOUNT && payment.currency === COMMUNITY_CURRENCY && payment.livemode === config.livemode && payment.payment.type === "payment_intent") {
          paymentIntent=objectId(payment.payment.payment_intent) ?? null;
          if(paymentIntent) {
            const intent=await stripe.paymentIntents.retrieve(paymentIntent,{expand:["latest_charge"]});
            const charge=intent.latest_charge;
            if(intent.status === "succeeded" && intent.amount === COMMUNITY_AMOUNT && intent.amount_received === COMMUNITY_AMOUNT && intent.currency === COMMUNITY_CURRENCY && intent.livemode === config.livemode && charge && typeof charge !== "string" && charge.livemode === config.livemode && charge.amount === COMMUNITY_AMOUNT && charge.currency === COMMUNITY_CURRENCY && charge.paid && charge.captured) {
              chargeId=charge.id; status=charge.amount_refunded>=COMMUNITY_AMOUNT ? "refunded" : "paid";
              if(charge.disputed) {
                const disputes=await stripe.disputes.list({payment_intent:paymentIntent,limit:100});
                if(disputes.has_more || !disputes.data.length) throw new Error("Disputa exige conciliação.");
                if(disputes.data.some(dispute=>dispute.status !== "won")) status="disputed";
              }
              const warnings=await stripe.radar.earlyFraudWarnings.list({charge:chargeId,limit:1});
              if(fraudCharge === chargeId || warnings.has_more || warnings.data.length>0) status="fraud";
            }
          }
        }
      }
      await tx`insert into community_invoice(id,subscription_id,amount,currency,period_start,period_end,status,fraud_review_required,payment_intent_id,charge_id)
        values(${invoice.id},${sub.id},${COMMUNITY_AMOUNT},${COMMUNITY_CURRENCY},${new Date(start*1000).toISOString()},${new Date(end*1000).toISOString()},${status},${status === "fraud"},${paymentIntent},${chargeId})
        on conflict(id) do update set status=case when community_invoice.status='fraud' and excluded.status='paid' then 'fraud' else excluded.status end,
          fraud_review_required=community_invoice.fraud_review_required or excluded.fraud_review_required,
          payment_intent_id=excluded.payment_intent_id,charge_id=excluded.charge_id,updated_at=now()`;
    }
    return matched ? "recorded" : "ignored";
  });
}
