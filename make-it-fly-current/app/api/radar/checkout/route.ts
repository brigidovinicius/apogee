import { randomUUID, randomBytes } from "node:crypto";
import { getMemberFromHeaders } from "@/lib/members/dal";
import {adultAccess} from "@/lib/members/protection";
import { getSql } from "@/lib/members/db";
import { applicationOrigin } from "@/lib/members/mail";
import { consumeRateLimit } from "@/lib/members/rate-limit";
import { billingConfig, BillingError, RADAR_ACCESS_PATH, RADAR_AMOUNT, RADAR_CHECKOUT_TAG, RADAR_CURRENCY } from "@/lib/billing/config";
import { billingFailure } from "@/lib/billing/http";
import { radarAccess } from "@/lib/billing/store";
import { stripeClient } from "@/lib/billing/stripe";
import { radarDetailReturnPath } from "@/lib/opportunities/detail-path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    if (request.headers.get("origin") !== applicationOrigin() || request.headers.get("sec-fetch-site") === "cross-site") throw new BillingError(403, "Origem não permitida.");
    const member = await getMemberFromHeaders(request.headers);
    if (!member) throw new BillingError(401, "Entre na sua conta para continuar.");
    if(!(await adultAccess(member.id)))throw new BillingError(403,"Conclua a verificação da conta adulta antes de continuar.");
    const next = radarDetailReturnPath(new URL(request.url).searchParams.get("next"));
    const returnQuery = next === "/membros/oportunidades" ? "" : `&next=${encodeURIComponent(next)}`;
    const config = billingConfig();
    if ((await radarAccess(member.id, config.livemode)).active) return Response.redirect(new URL(next, applicationOrigin()), 303);
    if (!(await consumeRateLimit(`radar-checkout:${member.id}`, 5, 3600))) throw new BillingError(429, "Aguarde antes de tentar novamente.");
    const stripe = stripeClient();
    const price = await stripe.prices.retrieve(config.price);
    if (!price.active || price.type !== "one_time" || price.currency !== RADAR_CURRENCY || price.unit_amount !== RADAR_AMOUNT ||
        (typeof price.product === "string" ? price.product : price.product.id) !== config.product || price.livemode !== config.livemode) throw new BillingError(503, "Preço indisponível.");
    const [user] = await getSql()`select email from "user" where id = ${member.id} and blocked = false`;
    if (!user) throw new BillingError(401, "Entre na sua conta para continuar.");
    const suffix = Array.from(randomBytes(8), n => String.fromCharCode(97 + n % 26)).join("");
    const checkout = await stripe.checkout.sessions.create({
      mode: "payment", adaptive_pricing: { enabled: false },
      line_items: [{ price: config.price, quantity: 1 }], client_reference_id: member.id,
      customer_email: user.email, integration_identifier: `apogee_radar_${suffix}`,
      metadata: { integration: RADAR_CHECKOUT_TAG, radar_user_id: member.id },
      success_url: `${applicationOrigin()}${RADAR_ACCESS_PATH}?payment=received${returnQuery}`,
      cancel_url: `${applicationOrigin()}${RADAR_ACCESS_PATH}?payment=cancelled${returnQuery}`,
    }, { idempotencyKey: `radar-${member.id}-${randomUUID()}` });
    if (!checkout.url || new URL(checkout.url).origin !== "https://checkout.stripe.com") throw new Error("Checkout indisponível.");
    return Response.redirect(checkout.url, 303);
  } catch (error) { return billingFailure(error); }
}
