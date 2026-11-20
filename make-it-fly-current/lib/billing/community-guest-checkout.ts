import "server-only";
import { randomUUID } from "node:crypto";
import type Stripe from "stripe";
import { getSql } from "@/lib/members/db";
import { applicationOrigin } from "@/lib/members/mail";
import { BillingError } from "./config";
import { COMMUNITY_TAG, communityBillingConfig, communityServiceConfig } from "./community-config";
import { communityReturnPath } from "./community-navigation";
import { fulfillCommunityEvent, validAnnualPrice } from "./community-fulfillment";
import { guestCheckoutEnabled, validGuestId, recordGuestSession, stripeObjectId } from "./community-guest-store";
import { stripeClient } from "./stripe";

type GuestAttempt = { id: string; session_id: string | null; return_path: string; expires_at: string };

export async function guestAnnualCheckout(previous: unknown, destination: unknown) {
  if (!guestCheckoutEnabled()) throw new BillingError(503, "Checkout temporariamente indisponível.");
  const config = communityBillingConfig(), stripe = stripeClient(), sql = getSql();
  const next = communityReturnPath(destination ?? "/membros");
  const price = await stripe.prices.retrieve(config.price);
  if (!validAnnualPrice(price, config)) throw new BillingError(503, "Plano anual indisponível.");
  let attempt: GuestAttempt | undefined = validGuestId(previous) ? (await sql<GuestAttempt[]>`select * from community_guest_checkout where id=${previous} and livemode=${config.livemode}`)[0] : undefined;
  if (attempt?.session_id) {
    const session = await stripe.checkout.sessions.retrieve(String(attempt.session_id));
    await recordGuestSession(session);
    if (session.status === "complete") return { id: String(attempt.id), url: `${applicationOrigin()}/comunidade/ativar` };
    if (session.status === "open" && session.url && new URL(session.url).origin === "https://checkout.stripe.com") return { id: String(attempt.id), url: session.url };
    attempt = undefined;
  }
  if (attempt && new Date(attempt.expires_at).getTime() < Date.now() + 31 * 60_000) attempt = undefined;
  if (!attempt) {
    [attempt] = await sql<GuestAttempt[]>`insert into community_guest_checkout(id,livemode,return_path,expires_at)
      values(${randomUUID()},${config.livemode},${next},now()+interval '1 hour') returning *`;
  }
  const id = String(attempt.id);
  const customer = await stripe.customers.create({}, { idempotencyKey: `community-guest-customer-${config.livemode}-${id}` });
  await sql`update community_guest_checkout set customer_id=${customer.id} where id=${id} and (customer_id is null or customer_id=${customer.id})`;
  const session = await stripe.checkout.sessions.create({
    mode: "subscription", customer: customer.id, line_items: [{ price: config.price, quantity: 1 }],
    client_reference_id: id, adaptive_pricing: { enabled: false }, locale: "pt-BR",
    metadata: { integration: COMMUNITY_TAG, guest_checkout: id },
    subscription_data: { metadata: { integration: COMMUNITY_TAG, guest_checkout: id } },
    expires_at: Math.floor(new Date(attempt.expires_at).getTime() / 1000),
    custom_text: { submit: { message: "Após o pagamento, crie sua conta Apogee com o mesmo e-mail para vincular sua assinatura. Licenças de ferramentas não incluídas; Trilha inicial parcial." } },
    success_url: `${applicationOrigin()}/api/comunidade/assinatura/retorno?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${applicationOrigin()}/comunidade?payment=cancelled#plano-anual`,
  }, { idempotencyKey: `community-guest-checkout-${config.livemode}-${id}` });
  if (!session.url || new URL(session.url).origin !== "https://checkout.stripe.com") throw new BillingError(503, "Checkout indisponível.");
  await sql`update community_guest_checkout set session_id=${session.id} where id=${id} and (session_id is null or session_id=${session.id})`;
  return { id, url: session.url };
}

/** Email ownership, never the return URL or cookie, authorizes attaching a purchase. */
export async function claimGuestAnnualCheckout(userId: string) {
  const config = communityServiceConfig(), sql = getSql(), stripe = stripeClient();
  const [account] = await sql`select email,email_verified,blocked from "user" where id=${userId}`;
  if (!account || account.blocked) throw new BillingError(401, "Entre na sua conta para continuar.");
  if (!account.email_verified) throw new BillingError(403, "Confirme seu e-mail para ativar a assinatura.");
  const purchases = await sql`select id,session_id from community_guest_checkout where email=${String(account.email).trim().toLowerCase()}
    and livemode=${config.livemode} and status='complete' and (user_id is null or user_id=${userId}) order by created_at desc limit 10`;
  if (!purchases.length) throw new BillingError(404, "Ainda não encontramos uma compra com o e-mail desta conta. Use o mesmo e-mail do checkout ou tente novamente em instantes.");
  let next = "/membros", matched = false;
  for (const purchase of purchases) {
    const session = await stripe.checkout.sessions.retrieve(String(purchase.session_id));
    if (!await recordGuestSession(session) || session.status !== "complete" || session.customer_details?.email?.trim().toLowerCase() !== String(account.email).trim().toLowerCase()) continue;
    const customer = stripeObjectId(session.customer), subscriptionId = stripeObjectId(session.subscription);
    if (!customer || !subscriptionId) continue;
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    if (subscription.livemode !== config.livemode || stripeObjectId(subscription.customer) !== customer || subscription.metadata.integration !== COMMUNITY_TAG || subscription.metadata.guest_checkout !== String(purchase.id) || subscription.items.has_more || subscription.items.data.length !== 1 || subscription.items.data[0].quantity !== 1 || !validAnnualPrice(subscription.items.data[0].price, config, false)) continue;
    matched = true;
    next = await sql.begin(async tx => {
      const [current] = await tx`select email,email_verified,blocked from "user" where id=${userId} for update`;
      if (!current?.email_verified || current.blocked || String(current.email).trim().toLowerCase() !== session.customer_details?.email?.trim().toLowerCase()) throw new BillingError(403, "Confirme o e-mail usado no checkout.");
      const [row] = await tx`select user_id,return_path from community_guest_checkout where id=${String(purchase.id)} for update`;
      const [owner] = await tx`select user_id from community_customer where customer_id=${customer} and livemode=${config.livemode}`;
      if (!row || (row.user_id && row.user_id !== userId) || (owner && owner.user_id !== userId)) throw new BillingError(409, "Esta compra já está vinculada a outra conta.");
      await tx`update community_guest_checkout set user_id=${userId},claimed_at=coalesce(claimed_at,now()) where id=${String(purchase.id)}`;
      await tx`insert into community_customer(user_id,livemode,customer_id) values(${userId},${config.livemode},${customer}) on conflict(user_id,livemode) do nothing`;
      return communityReturnPath(row.return_path);
    });
    // Re-read canonical invoices even when webhooks arrived before registration.
    const invoices = await stripe.invoices.list({ subscription: subscriptionId, limit: 100 });
    if (invoices.has_more) throw new BillingError(409, "Seu histórico precisa de uma conferência. Entre em contato com o suporte.");
    const run = randomUUID();
    const event = (id: string, type: "invoice.paid" | "customer.subscription.updated") => ({ id: `guest_claim_${run}_${id}`, type, livemode: config.livemode, data: { object: { id } } }) as unknown as Stripe.Event;
    await fulfillCommunityEvent(event(subscriptionId, "customer.subscription.updated"));
    for (const invoice of invoices.data) await fulfillCommunityEvent(event(invoice.id, "invoice.paid"));
  }
  if (!matched) throw new BillingError(409, "Não foi possível vincular esta compra. Entre em contato com o suporte.");
  return next;
}
