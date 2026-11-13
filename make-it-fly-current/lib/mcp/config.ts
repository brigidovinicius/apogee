import "server-only";
import { applicationOrigin } from "@/lib/members/mail";

export const MCP_SCOPE = "radar:read";
export const mcpEnabled = () => process.env.APOGEE_MCP_ENABLED === "true";
export const mcpResource = () => `${applicationOrigin()}/mcp`;
export const mcpIssuer = () => `${applicationOrigin()}/api/auth`;
export const mcpMetadataUrl = () => `${applicationOrigin()}/.well-known/oauth-protected-resource/mcp`;
