import "server-only";
import { getSql } from "@/lib/members/db";
import { mcpResource } from "./config";

export async function listMcpConnections(userId: string) {
  const rows = await getSql()`select c.client_id, coalesce(c.name, 'Aplicativo') as name, max(g.updated_at) as authorized_at
    from mcp_oauth_consent g join mcp_oauth_client c on c.client_id = g.client_id
    where g.user_id = ${userId} and ${mcpResource()} = any(g.resources)
    group by c.client_id, c.name order by authorized_at desc`;
  return rows.map(row => ({ clientId: String(row.client_id), name: String(row.name), authorizedAt: new Date(row.authorized_at).toISOString() }));
}

export async function revokeMcpConnection(userId: string, clientId: string) {
  if (!clientId || clientId.length > 2048) throw new Error("Conexão inválida.");
  await getSql().begin(async tx => {
    const [owner] = await tx`select id from "user" where id = ${userId} and blocked = false for update`;
    if (!owner) throw new Error("Conta indisponível.");
    // Permanent tombstones also reject tokens inserted by an in-flight refresh
    // after the deletes, even if this client is explicitly connected again.
    await tx`update mcp_oauth_family set revoked_at = coalesce(revoked_at, now()) where user_id = ${userId} and client_id = ${clientId}`;
    await tx`delete from mcp_oauth_access_token where user_id = ${userId} and client_id = ${clientId}`;
    await tx`delete from mcp_oauth_refresh_token where user_id = ${userId} and client_id = ${clientId}`;
    // Consent is checked on each Bearer request as well as by the provider.
    await tx`delete from mcp_oauth_consent where user_id = ${userId} and client_id = ${clientId}`;
  });
}
