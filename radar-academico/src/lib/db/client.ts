import { Pool, type PoolClient, type QueryResultRow } from "pg";

type Access = "reader" | "editor";
const pools: Partial<Record<Access, Pool>> = {};

function getPool(access: Access) {
  const variable = access === "reader" ? "DATABASE_READER_URL" : "DATABASE_EDITOR_URL";
  const url = process.env[variable];
  // DATABASE_URL pertence exclusivamente ao migrador. Nunca serve de fallback.
  if (!url) throw new Error(`${variable} não configurada`);
  pools[access] ??= new Pool({
    connectionString: url,
    max: Number(process.env.DATABASE_POOL_MAX ?? 5),
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined,
  });
  return pools[access];
}

async function assertRuntimeRole(client: PoolClient, access: Access) {
  const { rows } = await client.query<{ safe: boolean }>(`select
    session_user = $1 and current_user = $1
    and not (r.rolsuper or r.rolbypassrls or r.rolcreatedb or r.rolcreaterole or r.rolreplication or r.rolinherit)
    and r.rolcanlogin
    and not exists (select 1 from pg_catalog.pg_auth_members where member=r.oid)
    and not exists (select 1 from pg_catalog.pg_database where datdba=r.oid)
    and not exists (select 1 from pg_catalog.pg_namespace where nspowner=r.oid)
    and not exists (select 1 from pg_catalog.pg_class where relowner=r.oid)
    and not pg_catalog.has_database_privilege(current_user,current_database(),'CREATE')
    and not pg_catalog.has_schema_privilege(current_user,'public','CREATE') as safe
    from pg_catalog.pg_roles r where r.rolname=session_user`, [`radar_${access}`]);
  if (rows.length !== 1 || rows[0].safe !== true) throw new Error("Privilégios de banco incompatíveis com o runtime Radar");
}

async function transaction<T>(access: Access, work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool(access).connect();
  let begun = false;
  let discard = false;
  try {
    await client.query(access === "reader" ? "begin read only" : "begin");
    begun = true;
    await assertRuntimeRole(client, access);
    await client.query("set local search_path = pg_catalog, public, pg_temp");
    await client.query("set local row_security = on");
    await client.query("select set_config('app.is_admin',$1,true)", [access === "editor" ? "true" : "false"]);
    const result = await work(client);
    await client.query("commit");
    return result;
  } catch (error) {
    if (begun) {
      try { await client.query("rollback"); }
      catch { discard = true; }
    } else discard = true;
    throw error;
  } finally {
    client.release(discard);
  }
}

export async function withAdminTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  return transaction("editor", work);
}

export async function queryPublic<T extends QueryResultRow>(text: string, values: unknown[] = []) {
  return transaction("reader", client => client.query<T>(text, values));
}
