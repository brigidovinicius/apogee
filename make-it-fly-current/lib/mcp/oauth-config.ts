import "server-only";
import type { OAuthOptions } from "@better-auth/oauth-provider";
import { MCP_SCOPE, mcpResource } from "./config";

export function mcpOAuthOptions(): OAuthOptions<string[]> {
  return {
    loginPage: "/membros/integracoes/mcp/entrar",
    consentPage: "/membros/integracoes/mcp/autorizar",
    scopes: [MCP_SCOPE, "offline_access"],
    grantTypes: ["authorization_code", "refresh_token"],
    disableJwtPlugin: true,
    storeTokens: "hashed", storeClientSecret: "encrypted",
    accessTokenExpiresIn: 900, refreshTokenExpiresIn: 60 * 60 * 24 * 30,
    codeExpiresIn: 300, refreshTokenReuseInterval: 0,
    resources: [{ identifier: mcpResource(), name: "Radar Apogee", allowedScopes: [MCP_SCOPE, "offline_access"] }],
    enforcePerClientResources: true,
    allowDynamicClientRegistration: true,
    allowUnauthenticatedClientRegistration: true,
    clientRegistrationRequirePKCE: true,
    clientRegistrationDefaultScopes: [MCP_SCOPE, "offline_access"],
    clientRegistrationAllowedScopes: [MCP_SCOPE, "offline_access"],
    clientRegistrationDefaultResources: [mcpResource()],
    clientRegistrationAllowedResources: [mcpResource()],
    // OAuth clients never gain management rights through this public connector.
    clientPrivileges: async () => false,
    resourcePrivileges: async () => false,
  };
}
