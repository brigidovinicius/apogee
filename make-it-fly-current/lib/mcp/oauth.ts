import "server-only";
import type { GenericEndpointContext } from "@better-auth/core";
import { getOAuthProviderApi, verifyOAuthQueryParams } from "@better-auth/oauth-provider";
import { isAPIError } from "better-auth/api";
import { getAuth } from "@/lib/members/auth";
import { getMcpMember } from "@/lib/mcp/identity";
import { MCP_SCOPES, mcpIssuer, mcpResource } from "./config";
import { mcpOAuthOptions } from "./oauth-config";
import { mcpTokenFamilyActive } from "@/lib/mcp/families";

export class McpAuthorizationError extends Error {
  constructor(readonly status: number, readonly code: string) { super(code); }
}

export async function authorizeMcpRequest(request: Request) {
  const header = request.headers.get("authorization");
  if (!header || !/^Bearer [A-Za-z0-9._~+\/-]+=*$/i.test(header) || header.length > 4096) return null;
  const auth = getAuth();
  // Official in-process introspection verifies opaque hashes, client, session,
  // expiry and revocation. No recursive HTTP call or third-party credential.
  const context = { context: await auth.$context } as GenericEndpointContext;
  const provider = getOAuthProviderApi(context, mcpOAuthOptions());
  let payload;
  try {
    payload = await provider.requireActiveAccessToken(header.slice(7));
  } catch (error) {
    if (isAPIError(error) && (error.statusCode === 401 || error.statusCode === 400)) return null;
    throw error;
  }
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (payload.iss !== mcpIssuer() || !audiences.includes(mcpResource()) || !payload.sub ||
      typeof payload.client_id !== "string" || payload.cnf || payload.token_type !== "Bearer") return null;
  const scopes = typeof payload.scope === "string" ? payload.scope.split(" ").filter(Boolean) : [];
  if (!MCP_SCOPES.some(scope => scopes.includes(scope))) {
    throw new McpAuthorizationError(403, "insufficient_scope");
  }
  const consents = await context.context.adapter.findMany<{ scopes: string[]; resources?: string[] }>({
    model: "oauthConsent", where: [{ field: "userId", value: payload.sub }, { field: "clientId", value: payload.client_id }], limit: 100,
  });
  if (!consents.some(grant => scopes.every(scope => grant.scopes.includes(scope)) && grant.resources?.includes(mcpResource()))) return null;
  const digest = await provider.hashToken(header.slice(7), "access_token");
  if (!(await mcpTokenFamilyActive(digest, payload.sub, payload.client_id))) return null;
  if (!(await getMcpMember(payload.sub))) return null;
  return { userId: payload.sub, clientId: payload.client_id, scopes };
}

/** Select and verify exactly the provider-signed fields, not arbitrary page params. */
export async function verifiedMcpQuery(params: URLSearchParams): Promise<string | null> {
  if (params.toString().length > 8192) return null;
  const signedNames = new Set(["sig", "ba_param", ...params.getAll("ba_param")]);
  const query = new URLSearchParams([...params].filter(([key]) => signedNames.has(key))).toString();
  const { secret } = await getAuth().$context;
  return await verifyOAuthQueryParams(query, secret) ? query : null;
}
