import "server-only";
import Stripe from "stripe";
import { billingConfig } from "./config";

export function stripeClient() {
  return new Stripe(billingConfig().key, { maxNetworkRetries: 1, timeout: 10_000 });
}
