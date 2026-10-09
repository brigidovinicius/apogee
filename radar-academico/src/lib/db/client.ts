import { Pool, type PoolClient, type QueryResultRow } from "pg";

let pool: Pool | undefined;

function getPool() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL não configurada");
  pool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.DATABASE_POOL_MAX ?? 5),
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined,
  });
  return pool;
}

export async function withAdminTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await client.query("select set_config('app.is_admin','true',true)");
    const result = await work(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function queryPublic<T extends QueryResultRow>(text: string, values: unknown[] = []) {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await client.query("select set_config('app.is_admin','false',true)");
    const result = await client.query<T>(text, values);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}