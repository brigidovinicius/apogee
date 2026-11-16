import "server-only";
import { BillingError } from "./config";

export const COMMUNITY_AMOUNT = 143880;
export const COMMUNITY_CURRENCY = "brl";
export const COMMUNITY_TAG = "apogee_community_annual_v1";
export const COMMUNITY_ACCESS_PATH = "/membros/assinatura";

export function communityBillingEnabled() { return process.env.COMMUNITY_BILLING_ENABLED === "true"; }

/** A sales pause must keep existing payments, cancellations and refunds operational. */
export function communityProcessingRequired() {
  return communityBillingEnabled() || Boolean(process.env.STRIPE_COMMUNITY_PRODUCT_ID || process.env.STRIPE_COMMUNITY_ANNUAL_PRICE_ID);
}

export function communityServiceConfig() {
  const mode = process.env.STRIPE_MODE;
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  const price = process.env.STRIPE_COMMUNITY_ANNUAL_PRICE_ID ?? "";
  const product = process.env.STRIPE_COMMUNITY_PRODUCT_ID ?? "";
  if (!["test","live"].includes(mode ?? "") ||
      !new RegExp(`^(?:rk|sk)_${mode}_[A-Za-z0-9]+$`).test(key) ||
      !/^price_[A-Za-z0-9]+$/.test(price) || !/^prod_[A-Za-z0-9]+$/.test(product)) {
    throw new BillingError(503,"Assinatura temporariamente indisponível.");
  }
  return {key,price,product,livemode:mode === "live"};
}

/** Only new Checkout sessions depend on the sales switch. */
export function communityBillingConfig() {
  if (!communityBillingEnabled()) throw new BillingError(503,"Novas assinaturas temporariamente indisponíveis.");
  return communityServiceConfig();
}

export function stripeKey() {
  const mode=process.env.STRIPE_MODE, key=process.env.STRIPE_SECRET_KEY ?? "";
  if (!["test","live"].includes(mode ?? "") || !new RegExp(`^(?:rk|sk)_${mode}_[A-Za-z0-9]+$`).test(key)) throw new BillingError(503,"Pagamento temporariamente indisponível.");
  return key;
}
