import "server-only";
import { randomUUID } from "node:crypto";
import type Stripe from "stripe";
import { requireAdmin } from "@/lib/members/dal";
import { getSql } from "@/lib/members/db";
import { communityBillingConfig } from "./community-config";
import { stripeClient } from "./stripe";
import { fulfillCommunityEvent } from "./community-fulfillment";

export async function listAnnualMemberships(page = 1) {
  await requireAdmin("/admin/assinaturas");
  const sql = getSql(), livemode = process.env.STRIPE_MODE !== "test";
  const [count] = await sql`select count(*)::int as n from community_subscription where livemode=${livemode}`;
  const pages = Math.max(1, Math.ceil(Number(count.n) / 50)), selected = Math.min(pages, Math.max(1, Number.isSafeInteger(page) ? page : 1));
  const rows = await sql`select s.id,s.status,s.cancel_at_period_end,u.username,
    (select max(i.period_end) from community_invoice i where i.subscription_id=s.id and i.status='paid' and not i.fraud_review_required and i.period_start<=now() and i.period_end>now()) as paid_until,
    (select i.status from community_invoice i where i.subscription_id=s.id order by (i.period_start<=now()) desc,i.period_start desc limit 1) as payment_status
    from community_subscription s join "user" u on u.id=s.user_id where s.livemode=${livemode} order by s.updated_at desc,s.id limit 50 offset ${(selected - 1) * 50}`;
  return { rows, page: selected, pages, livemode };
}

/** Operator reconciliation reads canonical Stripe objects; it never fabricates payment. */
export async function reconcileAnnualMembership(id: string) {
  await requireAdmin("/admin/assinaturas");
  if (!/^sub_[A-Za-z0-9]+$/.test(id)) throw Error("Assinatura inválida.");
  const config = communityBillingConfig();
  const [local] = await getSql()`select s.customer_id from community_subscription s
    join community_customer c on c.user_id=s.user_id and c.livemode=s.livemode and c.customer_id=s.customer_id
    where s.id=${id} and s.livemode=${config.livemode}`;
  if (!local) throw Error("Assinatura vinculada não encontrada.");
  const stripe = stripeClient(), sub = await stripe.subscriptions.retrieve(id);
  const customer = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  if (sub.livemode !== config.livemode || customer !== local.customer_id) throw Error("Vínculo divergente.");
  const invoices = await stripe.invoices.list({ subscription: id, limit: 100 });
  if (invoices.has_more) throw Error("O histórico exige revisão adicional antes de conciliar.");
  const run = randomUUID().replaceAll("-", "");
  const event = (objectId: string, type: "invoice.paid" | "customer.subscription.updated") => ({ id: `reconcile_${run}_${objectId}`, type, livemode: config.livemode, data: { object: { id: objectId } } }) as unknown as Stripe.Event;
  await fulfillCommunityEvent(event(id, "customer.subscription.updated"));
  for (const invoice of invoices.data) await fulfillCommunityEvent(event(invoice.id, "invoice.paid"));
  return invoices.data.length;
}
