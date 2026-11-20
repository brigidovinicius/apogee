// Preflight by default; --apply is an explicitly authorized, additive release step.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import postgres from 'postgres';
import { databaseOptions } from './members-grant-admin.mjs';
const source = readFileSync(new URL('../sql/community-guest-checkout.sql', import.meta.url), 'utf8');
const shape = 'id:uuid:NO,livemode:boolean:NO,return_path:text:NO,customer_id:text:YES,session_id:text:YES,email:text:YES,status:text:NO,user_id:text:YES,expires_at:timestamp with time zone:NO,created_at:timestamp with time zone:NO,claimed_at:timestamp with time zone:YES';
export async function migrateGuestCheckout(sql, { apply = false, expectedRole = 'apogee_app' } = {}) {
  return sql.begin(async tx => {
    await tx`select set_config('lock_timeout','5s',true)`;
    await tx`select pg_advisory_xact_lock(hashtextextended('community-guest-checkout-schema',0))`;
    const [actor] = await tx`select current_user as role`;
    if (actor.role !== expectedRole) throw Error('Papel divergente.');
    const [existing] = await tx`select tableowner from pg_tables where schemaname='public' and tablename='community_guest_checkout'`;
    if (!existing && !apply) return { pending: true, changed: false };
    if (!existing) await tx.unsafe(source);
    const [owner] = await tx`select tableowner from pg_tables where schemaname='public' and tablename='community_guest_checkout'`;
    if (owner?.tableowner !== expectedRole) throw Error('Ownership divergente.');
    const columns = await tx`select column_name,data_type,is_nullable from information_schema.columns where table_schema='public' and table_name='community_guest_checkout' order by ordinal_position`;
    if (columns.map(c => `${c.column_name}:${c.data_type}:${c.is_nullable}`).join(',') !== shape) throw Error('Colunas divergentes.');
    const constraints = await tx`select pg_get_constraintdef(oid) as definition from pg_constraint where conrelid='public.community_guest_checkout'::regclass`;
    for (const fragment of ['PRIMARY KEY (id)', 'UNIQUE (customer_id)', 'UNIQUE (session_id)', 'FOREIGN KEY (user_id)', 'ON DELETE SET NULL', "'open'", "'complete'", "'expired'"]) if (!constraints.some(c => c.definition.includes(fragment))) throw Error('Restrições divergentes.');
    const indexes = await tx`select indexname from pg_indexes where schemaname='public' and tablename='community_guest_checkout'`;
    for (const name of ['community_guest_checkout_email_idx','community_guest_checkout_user_idx']) if (!indexes.some(i => i.indexname === name)) throw Error('Índice ausente.');
    const grants = await tx`select 1 from information_schema.table_privileges where table_schema='public' and table_name='community_guest_checkout' and grantee='PUBLIC'`;
    if (grants.length) throw Error('Privilégios públicos indevidos.');
    return { pending: false, changed: !existing };
  });
}
async function main() {
  if (process.argv.slice(2).some(arg => arg !== '--apply')) throw Error('Argumento inválido.');
  const { url, options } = databaseOptions(), sql = postgres(url, { ...options, connect_timeout: 10 });
  try { console.log(JSON.stringify(await migrateGuestCheckout(sql, { apply: process.argv.includes('--apply') }))); }
  finally { await sql.end(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(() => { console.error('Migração do checkout não concluída. Nenhum segredo foi exibido.'); process.exitCode = 1; });
