import { createHash, createHmac } from "node:crypto";
import { z } from "zod";
import { radarAlertRequest, readAlertBody } from "@/lib/opportunities/radar-alerts-client";
import { memberClientIp } from "@/lib/members/client-ip";
import { consumeRateLimit } from "@/lib/members/rate-limit";

export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store" };
// Match the Radar receiver's accepted formats; authorization/availability stays there.
const payloadSchema = z.discriminatedUnion("action", [
  z.strictObject({
    action: z.literal("subscribe"),
    opportunityId: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i).toLowerCase(),
    email: z.string().trim().toLowerCase().max(254).regex(/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i),
    consent: z.literal(true),
  }),
  z.strictObject({ action: z.literal("confirm"), token: z.string().regex(/^[a-f0-9]{64}$/) }),
  z.strictObject({ action: z.literal("unsubscribe"), token: z.string().regex(/^[a-f0-9]{64}$/) }),
]);
const unavailable = () => Response.json({ error: "Avisos indisponíveis" }, { status: 503, headers });
const limited = () => Response.json({ error: "Muitas solicitações. Tente mais tarde." }, { status: 429, headers });

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const allowed = ["https://www.apogee.community", "https://apogee.community"];
  if (process.env.NODE_ENV !== "production") allowed.push(new URL(request.url).origin);
  if (!origin || !allowed.includes(origin) || request.headers.get("sec-fetch-site") === "cross-site") {
    return Response.json({ error: "Solicitação inválida" }, { status: 403, headers });
  }
  try {
    let payload: z.infer<typeof payloadSchema>;
    try { payload = payloadSchema.parse(await readAlertBody(request)); }
    catch { return Response.json({ error: "Solicitação inválida" }, { status: 400, headers }); }

    if (payload.action === "subscribe") {
      const ip = memberClientIp(request.headers);
      const secret = process.env.BETTER_AUTH_SECRET ?? "";
      if (!ip || secret.length < 32) return unavailable();
      const digest = (scope: string, value: string) => createHmac("sha256", secret).update(`radar-alerts:${scope}:${value}`).digest("hex");
      // Persistent, atomic counters. Rejected clients/recipients never spend the global budget.
      if (!await consumeRateLimit(`radar-alerts:subscribe-ip:${digest("ip", ip)}`, 10, 3600)) return limited();
      if (!await consumeRateLimit(`radar-alerts:subscribe-recipient:${digest("recipient", payload.email)}`, 3, 3600)) {
        // Same acknowledgement as Radar for active/pending/rate-limited addresses.
        return Response.json({ ok: true }, { headers });
      }
      if (!await consumeRateLimit("radar-alerts:subscribe", 100, 3600)) return limited();
    } else {
      // New subscriptions cannot exhaust the budget for an existing cancellation link.
      const key = `radar-alerts:${payload.action}:${createHash("sha256").update(payload.token).digest("hex")}`;
      if (!await consumeRateLimit(key, 20, 3600)) return limited();
    }
    const result = await radarAlertRequest(payload);
    return Response.json(result.body, { status: result.status, headers });
  } catch { return unavailable(); }
}
