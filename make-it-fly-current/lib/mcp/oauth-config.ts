import "server-only";
import type { OAuthOptions } from "@better-auth/oauth-provider";
import { MCP_SCOPES, mcpResource } from "./config";

export function mcpOAuthOptions(): OAuthOptions<string[]> {
  return {
    loginPage: "/membros/integracoes/mcp/entrar",
    consentPage: "/membros/integracoes/mcp/autorizar",
    scopes: [...MCP_SCOPES, "offline_access"],
    grantTypes: ["authorization_code", "refresh_token"],
    disableJwtPlugin: true,
    storeTokens: "hashed", storeClientSecret: "encrypted",
    accessTokenExpiresIn: 900, refreshTokenExpiresIn: 60 * 60 * 24 * 30,
    codeExpiresIn: 300, refreshTokenReuseInterval: 0,
    resources: [{ identifier: mcpResource(), name: "Apogee", allowedScopes: [...MCP_SCOPES, "offline_access"] }],
    enforcePerClientResources: true,
    allowDynamicClientRegistration: true,
    allowUnauthenticatedClientRegistration: true,
    clientRegistrationRequirePKCE: true,
    // Client capabilities are a ceiling, not a user grant. The initial HTTP
    // challenge requests reads only; writes always need signed user consent.
    clientRegistrationDefaultScopes: [...MCP_SCOPES, "offline_access"],
    clientRegistrationAllowedScopes: [...MCP_SCOPES, "offline_access"],
    clientRegistrationDefaultResources: [mcpResource()],
    clientRegistrationAllowedResources: [mcpResource()],
    // OAuth clients never gain management rights through this public connector.
    clientPrivileges: async () => false,
    resourcePrivileges: async () => false,
  };
}
