import "server-only";
import type Stripe from "stripe";
import { billingConfig, RADAR_AMOUNT, RADAR_CHECKOUT_TAG, RADAR_CURRENCY } from "./config";
import { recordRadarEvent, type RadarPurchase } from "./store";
import { stripeClient } from "./stripe";

export const RADAR_STRIPE_EVENTS = ["checkout.session.completed", "checkout.session.async_payment_succeeded",
  "charge.refunded", "charge.dispute.created", "charge.dispute.closed"] as const;
const checkoutEvents = new Set<string>(RADAR_STRIPE_EVENTS.slice(0, 2));

function objectId(value: string | { id: string } | null | undefined) { return typeof value === "string" ? value : value?.id; }

export async function fulfillRadarEvent(event: Stripe.Event): Promise<string> {
  const config = billingConfig();
  if (event.livemode !== config.livemode || event.account || !RADAR_STRIPE_EVENTS.includes(event.type as typeof RADAR_STRIPE_EVENTS[number])) return "ignored";
  const stripe = stripeClient();
  let sessionId: string | undefined;
  if (checkoutEvents.has(event.type)) sessionId = (event.data.object as Stripe.Checkout.Session).id;
  else {
    const intent = objectId((event.data.object as Stripe.Charge | Stripe.Dispute).payment_intent);
    if (!intent) return "ignored";
    const sessions = await stripe.checkout.sessions.list({ payment_intent: intent, limit: 2 });
    if (sessions.has_more || sessions.data.length !== 1) return "ignored";
    sessionId = sessions.data[0].id;
  }
  if (!sessionId?.startsWith("cs_")) return "ignored";
  return recordRadarEvent(event.id, event.type, sessionId, async () => {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.mode !== "payment" || session.payment_status !== "paid" || session.status !== "complete" ||
        session.livemode !== config.livemode || session.currency !== RADAR_CURRENCY || session.amount_total !== RADAR_AMOUNT) return null;
    const items = await stripe.checkout.sessions.listLineItems(sessionId, { limit: 2 });
    const item = items.data[0];
    if (items.has_more || items.data.length !== 1 || item.quantity !== 1 || item.price?.id !== config.price ||
        objectId(item.price.product) !== config.product || item.price.type !== "one_time" ||
        item.price.currency !== RADAR_CURRENCY || item.price.unit_amount !== RADAR_AMOUNT ||
        item.amount_subtotal !== RADAR_AMOUNT || item.amount_total !== RADAR_AMOUNT) return null;
    const intentId = objectId(session.payment_intent);
    if (!intentId) return null;
    const intent = await stripe.paymentIntents.retrieve(intentId, { expand: ["latest_charge"] });
    if (intent.status !== "succeeded" || intent.currency !== RADAR_CURRENCY || intent.amount !== RADAR_AMOUNT ||
        intent.amount_received !== RADAR_AMOUNT || intent.livemode !== config.livemode) return null;
    const charge = intent.latest_charge;
    if (!charge || typeof charge === "string" || !charge.paid || !charge.captured) return null;
    let status: RadarPurchase["status"] = charge.amount_refunded >= RADAR_AMOUNT ? "refunded" : "paid";
    if (charge.disputed) {
      const disputes = await stripe.disputes.list({ payment_intent: intentId, limit: 100 });
      if (disputes.has_more || disputes.data.length === 0) throw new Error("Disputa não conciliada.");
      if (disputes.data.some(dispute => dispute.status !== "won")) status = "disputed";
    }
    const metadata = session.metadata ?? {};
    let userId: string | null = null;
    if (!session.payment_link) {
      if (metadata.integration !== RADAR_CHECKOUT_TAG || !metadata.radar_user_id ||
          metadata.radar_user_id !== session.client_reference_id) return null;
      userId = metadata.radar_user_id;
    }
    const email = session.customer_details?.email?.trim().toLowerCase() ?? null;
    if (!userId && !email) throw new Error("Compra sem destinatário conciliável.");
    return { sessionId, paymentIntentId: intentId, userId, email, priceId: config.price, productId: config.product,
      amount: RADAR_AMOUNT, currency: RADAR_CURRENCY, livemode: config.livemode, status,
      eventCreatedAt: new Date(event.created * 1000).toISOString() };
  });
}
