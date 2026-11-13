import "server-only";
import { mcpEnabled } from "./config";
import { mcpOriginAllowed } from "./http";
import { memberClientIp } from "@/lib/members/client-ip";
import { consumeRateLimit } from "@/lib/members/rate-limit";
import { readRequestBody, RequestBodyError } from "@/lib/request-body";

export function isMcpOAuthPath(path: string) {
  return path.startsWith("/api/auth/oauth2/") || path.startsWith("/api/auth/admin/oauth2/");
}
const machinePaths = new Set(["/api/auth/oauth2/token", "/api/auth/oauth2/register", "/api/auth/oauth2/revoke"]);
export function oauthCorsHeaders() {
  return { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Cache-Control": "no-store" };
}
export async function handleMcpOAuth(request: Request, handler: (request: Request) => Promise<Response>) {
  if (!mcpEnabled()) return new Response(null, { status: 404 });
  const path = new URL(request.url).pathname;
  const machine = machinePaths.has(path);
  const headers = machine ? oauthCorsHeaders() : { "Cache-Control": "no-store" };
  try {
    if (new URL(request.url).search.length > 8192) return Response.json({ error: "invalid_request" }, { status: 400, headers });
    if (machine && !mcpOriginAllowed(request)) return Response.json({ error: "invalid_request" }, { status: 403, headers });
    const ip = memberClientIp(request.headers);
    if (!ip) return Response.json({ error: "temporarily_unavailable" }, { status: 503, headers });
    const registration = path === "/api/auth/oauth2/register";
    if (!(await consumeRateLimit(`mcp-oauth:${registration ? "register" : "request"}:${ip}`, registration ? 20 : 120, registration ? 3600 : 60))) {
      return Response.json({ error: "temporarily_unavailable" }, { status: 429, headers: { ...headers, "Retry-After": registration ? "3600" : "60" } });
    }
    let bounded = request;
    if (request.method === "POST") {
      const body = await readRequestBody(request, 16_384);
      bounded = new Request(request, { body: new Uint8Array(body) });
    }
    const response = await handler(bounded);
    for (const [name, value] of Object.entries(headers)) response.headers.set(name, value);
    return response;
  } catch (error) {
    return Response.json({ error: error instanceof RequestBodyError ? "invalid_request" : "temporarily_unavailable" }, { status: error instanceof RequestBodyError ? error.status : 503, headers });
  }
}
export function mcpOAuthPreflight(request: Request) {
  const enabled = mcpEnabled() && machinePaths.has(new URL(request.url).pathname);
  return new Response(null, { status: !enabled ? 404 : mcpOriginAllowed(request) ? 204 : 403, headers: enabled ? oauthCorsHeaders() : undefined });
}
