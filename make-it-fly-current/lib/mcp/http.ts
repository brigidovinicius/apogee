import "server-only";
import { mcpResource } from "./config";

export function mcpOriginAllowed(request: Request) {
  const origin = request.headers.get("origin");
  return origin === null || [new URL(mcpResource()).origin, "https://chatgpt.com", "https://claude.ai"].includes(origin);
}
export function mcpResponseHeaders() {
  return new Headers({
    "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow",
    "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept, MCP-Protocol-Version, MCP-Session-Id",
    "Access-Control-Expose-Headers": "WWW-Authenticate, MCP-Protocol-Version, MCP-Session-Id, Retry-After",
  });
}
