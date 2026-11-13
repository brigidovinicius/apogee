import { MCP_SCOPES, mcpEnabled, mcpIssuer, mcpResource } from "@/lib/mcp/config";
export const dynamic = "force-dynamic";
export function GET() {
  if (!mcpEnabled()) return new Response(null, { status: 404 });
  return Response.json({ resource: mcpResource(), resource_name: "Apogee", authorization_servers: [mcpIssuer()],
    scopes_supported: [...MCP_SCOPES], bearer_methods_supported: ["header"] },
  { headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" } });
}
