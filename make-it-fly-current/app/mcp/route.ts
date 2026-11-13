import { MCP_SCOPE, mcpEnabled, mcpResource } from "@/lib/mcp/config";
import { authorizeMcpRequest } from "@/lib/mcp/oauth";
import { mcpOriginAllowed, mcpResponseHeaders } from "@/lib/mcp/http";
import { handleMcpMessage } from "@/lib/mcp/server";
import { consumeRateLimit } from "@/lib/members/rate-limit";
import { memberClientIp } from "@/lib/members/client-ip";
import { readRequestBody, RequestBodyError } from "@/lib/request-body";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function failure(status: number, message: string, headers = mcpResponseHeaders()) {
  return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32000, message } }, { status, headers });
}
function challenge(error?: string) {
  const metadata = `${new URL(mcpResource()).origin}/.well-known/oauth-protected-resource/mcp`;
  return `Bearer resource_metadata="${metadata}", scope="${MCP_SCOPE}"${error ? `, error="${error}"` : ""}`;
}
export async function POST(request: Request) {
  if (!mcpEnabled()) return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  const headers = mcpResponseHeaders();
  if (!mcpOriginAllowed(request)) return failure(403, "Origem não autorizada.", headers);
  try {
    const ip = memberClientIp(request.headers);
    if (!ip) return failure(503, "Conexão temporariamente indisponível.", headers);
    if (!(await consumeRateLimit(`mcp-ip:${ip}`, 180, 60))) {
      headers.set("Retry-After", "60"); return failure(429, "Muitas consultas. Aguarde um minuto.", headers);
    }
    const identity = await authorizeMcpRequest(request);
    if (!identity) {
      headers.set("WWW-Authenticate", challenge(request.headers.has("authorization") ? "invalid_token" : undefined));
      return failure(401, "Conecte sua conta da Apogee para consultar o Radar.", headers);
    }
    if (!(await consumeRateLimit(`mcp-user:${identity.userId}`, 60, 60)) ||
        !(await consumeRateLimit(`mcp-client:${identity.clientId}:${identity.userId}`, 60, 60))) {
      headers.set("Retry-After", "60"); return failure(429, "Muitas consultas. Aguarde um minuto.", headers);
    }
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return failure(415, "Envie JSON.", headers);
    let body: unknown;
    try { body = JSON.parse((await readRequestBody(request, 65_536)).toString("utf8")); }
    catch (error) {
      if (error instanceof RequestBodyError) return failure(error.status, error.message, headers);
      return failure(400, "JSON inválido.", headers);
    }
    const response = await handleMcpMessage(request, identity.userId, body);
    for (const [key, value] of headers) response.headers.set(key, value);
    return response;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "insufficient_scope") {
      headers.set("WWW-Authenticate", challenge("insufficient_scope"));
      return failure(403, "Autorize a permissão de leitura do Radar.", headers);
    }
    return failure(503, "O Radar está temporariamente indisponível. Tente novamente mais tarde.", headers);
  }
}
export async function OPTIONS(request: Request) {
  if (!mcpEnabled()) return new Response(null, { status: 404 });
  return new Response(null, { status: mcpOriginAllowed(request) ? 204 : 403, headers: mcpResponseHeaders() });
}
export function GET() { return new Response(null, { status: mcpEnabled() ? 405 : 404, headers: { Allow: "POST, OPTIONS", "Cache-Control": "no-store" } }); }
export const DELETE = GET;
