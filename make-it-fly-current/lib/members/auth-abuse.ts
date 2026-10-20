import "server-only";
import { createHash } from "node:crypto";
import { APIError } from "better-auth";
import { consumeRateLimit } from "./rate-limit";
import { memberClientIp } from "./client-ip";

export async function enforceMemberAuthAbuse(context: { path: string; headers?: Headers; body?: unknown }): Promise<void> {
  const field = context.path === "/sign-in/email" ? "email" : context.path === "/sign-in/username" ? "username" : null;
  if (!field && context.path !== "/sign-up/email") return;
  if (!memberClientIp(context.headers ?? new Headers())) {
    throw new APIError("SERVICE_UNAVAILABLE", { message: "Autenticação temporariamente indisponível." });
  }
  if (!field) return;
  const value = context.body && typeof context.body === "object" ? (context.body as Record<string, unknown>)[field] : undefined;
  if (typeof value !== "string" || !value.trim() || value.length > 320) {
    throw new APIError("BAD_REQUEST", { message: "Identificador de acesso inválido." });
  }
  const identifier = value.trim().toLowerCase();
  const digest = createHash("sha256").update(identifier).digest("hex");
  // Mesma cota para action e endpoint direto; independe de conta existir ou senha.
  if (!(await consumeRateLimit(`signin-account:${field}:${digest}`, 8, 600))) {
    throw new APIError("TOO_MANY_REQUESTS", { message: "Muitas tentativas. Aguarde alguns minutos e tente novamente." });
  }
}
