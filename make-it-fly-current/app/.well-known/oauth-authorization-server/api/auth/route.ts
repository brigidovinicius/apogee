import { getAuth } from "@/lib/members/auth";
import { mcpEnabled } from "@/lib/mcp/config";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  if (!mcpEnabled()) return new Response(null, { status: 404 });
  try {
    const metadata = await getAuth().api.getOAuthServerConfig();
    return Response.json(metadata, { headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" } });
  } catch { return Response.json({ error: "temporarily_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } }); }
}
