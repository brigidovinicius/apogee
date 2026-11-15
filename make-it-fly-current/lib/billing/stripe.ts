import "server-only";
import Stripe from "stripe";
import { stripeKey } from "./community-config";

export function stripeClient() {
  return new Stripe(stripeKey(), { maxNetworkRetries: 1, timeout: 10_000 });
}
