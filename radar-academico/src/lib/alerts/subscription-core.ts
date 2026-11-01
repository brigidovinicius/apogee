import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
export class AlertError extends Error { constructor(message: string, public status = 400) { super(message); } }
export const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const tokenPattern = /^[a-f0-9]{64}$/;
export const fingerprint = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
export const tokenHash = (value: string) => createHash("sha256").update(value).digest("hex");
export function normalizedAlertEmail(value: unknown) {
  if (typeof value !== "string") throw new AlertError("Informe um e-mail válido");
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i.test(email)) throw new AlertError("Informe um e-mail válido");
  return email;
}
export function links(confirm: string, unsubscribe: string) {
  // Fixed public destination; never accept callback URLs from subscription requests.
  const base = "https://www.apogee.community/oportunidades/avisos";
  return { confirm: `${base}?acao=confirmar&token=${confirm}`, unsubscribe: `${base}?acao=cancelar&token=${unsubscribe}` };
}
export async function allowance(client: PoolClient, key: string, max: number, seconds: number) {
  const result = await client.query<{ count: number }>(`insert into opportunity_alert_limits (key,count,resets_at) values ($1,1,now()+$2*interval '1 second')
    on conflict (key) do update set count=case when opportunity_alert_limits.resets_at<=now() then 1 else opportunity_alert_limits.count+1 end,
    resets_at=case when opportunity_alert_limits.resets_at<=now() then excluded.resets_at else opportunity_alert_limits.resets_at end returning count`, [key,seconds]);
  return result.rows[0].count <= max;
}
