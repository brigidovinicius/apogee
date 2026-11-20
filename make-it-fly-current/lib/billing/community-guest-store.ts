import "server-only";
import type Stripe from "stripe";
import { getSql } from "@/lib/members/db";
import { COMMUNITY_TAG, communityServiceConfig } from "./community-config";
import { stripeClient } from "./stripe";

export const GUEST_CHECKOUT_COOKIE = "apogee_annual_checkout";
export const ANNUAL_ACTIVATION_PATH = "/membros/ativar-assinatura";
export const guestCheckoutEnabled = () => process.env.COMMUNITY_GUEST_CHECKOUT_ENABLED === "true";
export const stripeObjectId = (value: string | { id: string } | null | undefined) => typeof value === "string" ? value : value?.id;
export const validGuestId = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);

/** Only canonical Stripe sessions can set the purchase email or completion state. */
export async function recordGuestSession(session: Stripe.Checkout.Session) {
  if (session.metadata?.integration !== COMMUNITY_TAG || !validGuestId(session.metadata?.guest_checkout)) return false;
  const config = communityServiceConfig();
  if (session.mode !== "subscription" || session.livemode !== config.livemode || !session.status) return false;
  const customer = stripeObjectId(session.customer);
  if (!customer) return false;
  const email = session.customer_details?.email?.trim().toLowerCase() ?? null;
  const rows = await getSql()`update community_guest_checkout set session_id=${session.id},email=${email},status=${session.status}
    where id=${session.metadata.guest_checkout} and livemode=${config.livemode} and customer_id=${customer}
      and (session_id is null or session_id=${session.id}) returning id`;
  return rows.length === 1;
}

export async function refreshGuestSession(sessionId: string) {
  if (!/^cs_(?:test_|live_)?[A-Za-z0-9]{16,240}$/.test(sessionId)) return false;
  const session = await stripeClient().checkout.sessions.retrieve(sessionId);
  return recordGuestSession(session);
}
