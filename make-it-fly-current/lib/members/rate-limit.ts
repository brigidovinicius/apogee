import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "./db";

// Janela fixa atômica na tabela rate_limit (compartilhada com o Better Auth,
// mas com prefixo próprio "action:"). Retorna true quando a ação é permitida.
export async function consumeRateLimit(key: string, max: number, windowSeconds: number): Promise<boolean> {
  const now = Date.now();
  const windowStart = now - windowSeconds * 1000;
  const fullKey = `action:${key}`;
  const rows = await getDb().execute<{ count: number }>(sql`
    insert into rate_limit (id, key, count, last_request)
    values (gen_random_uuid()::text, ${fullKey}, 1, ${now})
    on conflict (key) do update set
      count = case when rate_limit.last_request < ${windowStart} then 1 else rate_limit.count + 1 end,
      last_request = case when rate_limit.last_request < ${windowStart} then ${now} else rate_limit.last_request end
    returning count`);
  return Number(rows[0]?.count ?? 0) <= max;
}
