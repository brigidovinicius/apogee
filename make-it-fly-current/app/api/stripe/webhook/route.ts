import { BillingError, webhookSecret } from "@/lib/billing/config";
import { fulfillRadarEvent } from "@/lib/billing/fulfillment";
import { billingFailure, billingResponse, webhookBody } from "@/lib/billing/http";
import { stripeClient } from "@/lib/billing/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const signature = request.headers.get("stripe-signature");
    if (!signature) throw new BillingError(400, "Assinatura obrigatória.");
    const stripe = stripeClient();
    const secret = webhookSecret();
    const raw = await webhookBody(request);
    let event;
    try { event = stripe.webhooks.constructEvent(raw, signature, secret); }
    catch { throw new BillingError(400, "Assinatura inválida."); }
    await fulfillRadarEvent(event);
    return billingResponse({ received: true });
  } catch (error) { return billingFailure(error); }
}
