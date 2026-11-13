import "server-only";
import { applicationOrigin } from "@/lib/members/mail";

export const MCP_SCOPE = "radar:read";
export const MCP_SCOPES = [MCP_SCOPE, "account:read", "calendar:write", "collections:write"] as const;
export const MCP_DEFAULT_SCOPES = [MCP_SCOPE, "account:read", "offline_access"];
export const MCP_SCOPE_LABELS: Record<string, string> = {
  "radar:read": "Consultar oportunidades e datas do Radar com seu acesso atual",
  "account:read": "Consultar seu perfil, calendário pessoal e coleções",
  "calendar:write": "Salvar e remover oportunidades do seu calendário pessoal",
  "collections:write": "Criar e editar suas coleções e adicionar ou remover oportunidades",
};
export const mcpEnabled = () => process.env.APOGEE_MCP_ENABLED === "true";
export const mcpResource = () => `${applicationOrigin()}/mcp`;
export const mcpIssuer = () => `${applicationOrigin()}/api/auth`;
export const mcpMetadataUrl = () => `${applicationOrigin()}/.well-known/oauth-protected-resource/mcp`;
