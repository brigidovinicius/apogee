import "server-only";
import type { GenericEndpointContext } from "@better-auth/core";
import { defineRequestState } from "@better-auth/core/context";
import { getSessionFromCtx } from "better-auth/api";
import { getSql } from "@/lib/members/db";
import { MCP_SCOPE, mcpEnabled, mcpResource } from "./config";

const consentSnapshot = defineRequestState<{ userId: string; clientId: string; consentIds: string[] } | null>(() => null);

/** Capture grant identities before the provider reads consent. A reconnect
 * creates a new consent ID and cannot authorize an older suspended request.
 */
export async function captureMcpConsentSnapshot(context: GenericEndpointContext) {
  if (!mcpEnabled() || context.path !== "/oauth2/authorize") return;
  await consentSnapshot.set(null);
  const clientId = context.query?.client_id ?? context.body?.client_id;
  if (typeof clientId !== "string") return;
  const session = await getSessionFromCtx(context, { disableCookieCache: true, disableRefresh: true });
  if (!session) return;
  const rows = await getSql()`select id from mcp_oauth_consent where user_id = ${session.user.id} and client_id = ${clientId}`;
  await consentSnapshot.set({ userId: session.user.id, clientId, consentIds: rows.map(row => String(row.id)) });
}

/** Register the immutable code family BEFORE the provider can issue its code.
 * Sharing the account lock with disconnect also rejects an authorize request
 * that read old consent before the disconnect and resumed afterwards.
 */
export async function registerMcpAuthorizationCode(record: { identifier: string; value: string }) {
  if (!mcpEnabled()) return;
  let value: unknown;
  try { value = JSON.parse(record.value); } catch { return; }
  if (!value || typeof value !== "object" || !("type" in value) || value.type !== "authorization_code") return;
  const data = value as { userId?: unknown; resource?: unknown; query?: { client_id?: unknown; scope?: unknown } };
  if (!Array.isArray(data.resource) || !data.resource.includes(mcpResource())) return;
  const userId = data.userId, clientId = data.query?.client_id;
  const scopes = typeof data.query?.scope === "string" ? data.query.scope.split(" ").filter(Boolean) : [MCP_SCOPE];
  if (typeof userId !== "string" || typeof clientId !== "string" || !record.identifier || record.identifier.length > 512) throw Error("Autorização indisponível.");
  const snapshot = await consentSnapshot.get();
  if (!snapshot || snapshot.userId !== userId || snapshot.clientId !== clientId) throw Error("Autorize novamente a conexão na Apogee.");
  await getSql().begin(async tx => {
    const [owner] = await tx`select id from "user" where id = ${userId} and blocked = false for update`;
    if (!owner) throw Error("Conta indisponível.");
    const consents = await tx`select id, scopes, resources from mcp_oauth_consent where user_id = ${userId} and client_id = ${clientId}`;
    if (!consents.some(row => snapshot.consentIds.includes(String(row.id)) && Array.isArray(row.scopes) && scopes.every(scope => row.scopes.includes(scope)) &&
      Array.isArray(row.resources) && row.resources.includes(mcpResource()))) throw Error("Autorize novamente a conexão na Apogee.");
    const rows = await tx`insert into mcp_oauth_family (id, user_id, client_id) values (${record.identifier}, ${userId}, ${clientId})
      on conflict (id) do nothing returning id`;
    if (!rows.length) throw Error("Solicitação de autorização indisponível.");
  });
}

export async function mcpTokenFamilyActive(tokenHash: string, userId: string, clientId: string) {
  const rows = await getSql()`select 1 from mcp_oauth_access_token t
    join mcp_oauth_family f on f.id = t.authorization_code_id
    where t.token = ${tokenHash} and t.user_id = ${userId} and t.client_id = ${clientId}
      and f.user_id = ${userId} and f.client_id = ${clientId} and f.revoked_at is null limit 1`;
  return rows.length === 1;
}
