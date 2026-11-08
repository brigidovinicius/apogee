import "server-only";
import { createHmac, randomBytes } from "node:crypto";
import { validBehaviorEvent, type BehaviorEvent } from "./behavior-contract";
import { readRequestBody, RequestBodyError } from "./request-body";
import { applicationOrigin } from "./members/mail";
import { memberClientIp } from "./members/client-ip";
import { getSql } from "./members/db";
const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" };
const rateSecret = randomBytes(32);
const buckets = new Map<string, { count: number; expires: number }>();
function consume(request: Request) {
  const now = Date.now();
  for (const [key, bucket] of buckets) if (bucket.expires <= now) buckets.delete(key);
  // Trusted edge header only. This short-lived keyed digest stays in memory.
  const ip = memberClientIp(request.headers);
  if (!ip) return false;
  const key = createHmac("sha256", rateSecret).update(ip).digest("hex");
  const bucket = buckets.get(key);
  if (bucket) { if (bucket.count >= 120) return false; bucket.count++; return true; }
  if (buckets.size >= 5000) return false;
  buckets.set(key, { count: 1, expires: now + 600_000 });
  return true;
}
export type BehaviorCount = BehaviorEvent & { count: number };
export function aggregateBehavior(events: BehaviorEvent[]): BehaviorCount[] {
  const counts = new Map<string, BehaviorCount>();
  for (const event of events) {
    const key = JSON.stringify([event.page, event.event, event.target, event.device]);
    const existing = counts.get(key);
    if (existing) existing.count++;
    else counts.set(key, { ...event, count: 1 });
  }
  return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, item]) => item);
}
export async function storeBehavior(counts: BehaviorCount[]) {
  await getSql().begin(async tx => {
    await tx`set local statement_timeout = '3s'`;
    await tx`delete from apogee_behavior_daily where day < (now() at time zone 'America/Sao_Paulo')::date - 89`;
    for (const item of counts) await tx`insert into apogee_behavior_daily (day, page, event, target, device, count)
      values ((now() at time zone 'America/Sao_Paulo')::date, ${item.page}, ${item.event}, ${item.target}, ${item.device}, ${item.count})
      on conflict (day, page, event, target, device) do update set count = apogee_behavior_daily.count + excluded.count`;
  });
}
type Options = { enabled?: boolean; origin?: string; rateLimit?: (request: Request) => boolean; store?: typeof storeBehavior };
export async function handleBehaviorPost(request: Request, options: Options = {}) {
  try {
    if (!(options.enabled ?? process.env.APOGEE_BEHAVIOR_ENABLED === "true")) return new Response(null, { status: 204, headers });
    if (request.headers.get("dnt") === "1" || request.headers.get("sec-gpc") === "1") return new Response(null, { status: 204, headers });
    if (request.headers.get("origin") !== (options.origin ?? applicationOrigin()) || request.headers.get("sec-fetch-site") === "cross-site") return Response.json({ error: "Origem inválida." }, { status: 403, headers });
    if (request.headers.get("x-apogee-measurement") !== "allow-v1") return Response.json({ error: "Escolha de medição ausente." }, { status: 400, headers });
    if (!(options.rateLimit ?? consume)(request)) return Response.json({ error: "Limite de medição atingido." }, { status: 429, headers });
    if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") return Response.json({ error: "Formato inválido." }, { status: 415, headers });
    const parsed: unknown = JSON.parse((await readRequestBody(request, 8192)).toString("utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || Object.keys(parsed).length !== 1 || !("events" in parsed) || !Array.isArray(parsed.events) || parsed.events.length < 1 || parsed.events.length > 20 || !parsed.events.every(validBehaviorEvent)) return Response.json({ error: "Eventos inválidos." }, { status: 400, headers });
    await (options.store ?? storeBehavior)(aggregateBehavior(parsed.events));
    return Response.json({ received: true }, { status: 202, headers });
  } catch (error) {
    const status = error instanceof RequestBodyError ? error.status : error instanceof SyntaxError ? 400 : 503;
    return Response.json({ error: status === 503 ? "Medição indisponível." : "Eventos inválidos." }, { status, headers });
  }
}
