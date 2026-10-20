import "server-only";

export const RADAR_AMOUNT = 4900;
export const RADAR_CURRENCY = "brl";
export const RADAR_ACCESS_PATH = "/membros/radar/acesso";
export const RADAR_CHECKOUT_TAG = "apogee_radar_lifetime_v1";

export class BillingError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

export function radarBillingEnabled(): boolean {
  return process.env.RADAR_BILLING_ENABLED === "true";
}

export function billingConfig() {
  const mode = process.env.STRIPE_MODE;
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  const price = process.env.STRIPE_RADAR_PRICE_ID ?? "";
  const product = process.env.STRIPE_RADAR_PRODUCT_ID ?? "";
  if (!radarBillingEnabled() || !["test", "live"].includes(mode ?? "") ||
      !new RegExp(`^(?:rk|sk)_${mode}_[A-Za-z0-9]+$`).test(key) ||
      !/^price_[A-Za-z0-9]+$/.test(price) || !/^prod_[A-Za-z0-9]+$/.test(product)) {
    throw new BillingError(503, "Pagamento temporariamente indisponível.");
  }
  return { key, price, product, livemode: mode === "live" };
}

export function webhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET ?? "";
  if (!/^whsec_[A-Za-z0-9]+$/.test(secret)) throw new BillingError(503, "Webhook indisponível.");
  return secret;
}
