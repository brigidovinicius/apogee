import { MCP_SCOPE, mcpEnabled, mcpIssuer, mcpResource } from "@/lib/mcp/config";
export const dynamic = "force-dynamic";
export function GET() {
  if (!mcpEnabled()) return new Response(null, { status: 404 });
  return Response.json({ resource: mcpResource(), resource_name: "Radar Apogee", authorization_servers: [mcpIssuer()],
    scopes_supported: [MCP_SCOPE], bearer_methods_supported: ["header"] },
  { headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" } });
}
