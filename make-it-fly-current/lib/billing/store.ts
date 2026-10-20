import "server-only";
import { getSql } from "@/lib/members/db";

export type RadarPurchase = {
  sessionId: string; paymentIntentId: string; userId: string | null; email: string | null;
  priceId: string; productId: string; amount: number; currency: string; livemode: boolean;
  status: "paid" | "refunded" | "disputed"; eventCreatedAt: string;
};

// A leitura atual da Stripe ocorre DENTRO da trava. Eventos concorrentes e
// fora de ordem não podem restaurar um direito já reembolsado ou contestado.
export async function recordRadarEvent(eventId: string, eventType: string, sessionId: string,
  resolve: () => Promise<RadarPurchase | null>) {
  return getSql().begin(async tx => {
    await tx`select set_config('lock_timeout', '5s', true)`;
    await tx`select pg_advisory_xact_lock(hashtextextended(${sessionId}, 0))`;
    const receipt = await tx`insert into radar_stripe_event (event_id, event_type) values (${eventId}, ${eventType})
      on conflict do nothing returning event_id`;
    if (!receipt.length) return "duplicate";
    const purchase = await resolve();
    if (!purchase) return "ignored";
    if (purchase.userId) {
      const users = await tx`select id from "user" where id = ${purchase.userId}`;
      if (!users.length) throw new Error("Conta de destino indisponível.");
    }
    const [existing] = await tx`select user_id from radar_purchase where session_id = ${sessionId}`;
    if (existing?.user_id && purchase.userId && existing.user_id !== purchase.userId) throw new Error("Vínculo divergente.");
    await tx`insert into radar_purchase
      (session_id, payment_intent_id, user_id, email, price_id, product_id, amount, currency, livemode, status, provider_event_at)
      values (${sessionId}, ${purchase.paymentIntentId}, ${purchase.userId}, ${purchase.email},
        ${purchase.priceId}, ${purchase.productId}, ${purchase.amount}, ${purchase.currency}, ${purchase.livemode},
        ${purchase.status}, ${purchase.eventCreatedAt})
      on conflict (session_id) do update set status = excluded.status, updated_at = now(), provider_event_at = excluded.provider_event_at,
        user_id = coalesce(radar_purchase.user_id, excluded.user_id)`;
    return "recorded";
  });
}

export type RadarAccess = { active: boolean; source: "admin" | "legacy" | "stripe" | null };

// Consulta privada, sem reivindicar a compra antes de comprovar o e-mail.
export async function radarPurchaseNeedsVerification(userId: string, livemode: boolean): Promise<boolean> {
  const rows = await getSql()`select 1 from "user" u
    where u.id = ${userId} and u.blocked = false and u.email_verified = false
      and exists (select 1 from radar_purchase p where p.user_id is null
        and p.email = lower(trim(u.email)) and p.livemode = ${livemode} and p.status = 'paid')`;
  return rows.length > 0;
}

export async function radarAccess(userId: string, livemode: boolean): Promise<RadarAccess> {
  return getSql().begin(async tx => {
    const [user] = await tx`select id, email, email_verified, role, blocked from "user" where id = ${userId} for update`;
    if (!user || user.blocked) return { active: false, source: null };
    if (user.role === "admin") return { active: true, source: "admin" };
    const legacy = await tx`select user_id from radar_legacy_access where user_id = ${userId}`;
    if (legacy.length) return { active: true, source: "legacy" };
    // Payment Links não trazem uma identidade de membro confiável. O vínculo
    // só ocorre após provar o controle do mesmo e-mail no Better Auth.
    if (user.email_verified) {
      await tx`update radar_purchase set user_id = ${userId}, updated_at = now()
        where user_id is null and email = ${String(user.email).trim().toLowerCase()} and livemode = ${livemode}`;
    }
    const paid = await tx`select session_id from radar_purchase
      where user_id = ${userId} and livemode = ${livemode} and status = 'paid' limit 1`;
    return { active: paid.length > 0, source: paid.length ? "stripe" : null };
  });
}
