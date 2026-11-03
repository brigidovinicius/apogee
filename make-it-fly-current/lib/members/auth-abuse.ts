import "server-only";
import { createHash } from "node:crypto";
import { APIError } from "better-auth";
import { consumeRateLimit } from "./rate-limit";
import { memberClientIp } from "./client-ip";
import { supervisedRegistrationEnabled } from "./protection";
import { applicationOrigin, memberMailAvailable } from "./mail";
import { normalizePasswordResetCallback, requestPasswordResetSchema } from "./password-recovery";

export async function enforceMemberAuthAbuse(context: { path: string; headers?: Headers; body?: unknown }): Promise<void> {
  if (context.path === "/request-password-reset" || context.path === "/reset-password") {
    const ip = memberClientIp(context.headers ?? new Headers());
    if (!ip) throw new APIError("SERVICE_UNAVAILABLE", { message: "Autenticação temporariamente indisponível." });
    const requesting = context.path === "/request-password-reset";
    if (!(await consumeRateLimit(`password-reset-ip:${requesting ? "request" : "reset"}:${ip}`, requesting ? 5 : 10, requesting ? 3600 : 600))) {
      throw new APIError("TOO_MANY_REQUESTS", { message: "Muitas tentativas. Aguarde alguns minutos e tente novamente." });
    }
    if (!requesting) return;
    const parsed = requestPasswordResetSchema.safeParse(context.body);
    if (!parsed.success) throw new APIError("BAD_REQUEST", { message: "Informe um e-mail válido." });
    const body = context.body as Record<string, unknown>;
    try {
      body.redirectTo = normalizePasswordResetCallback(applicationOrigin(), body.redirectTo);
    } catch {
      throw new APIError("BAD_REQUEST", { message: "Destino de recuperação inválido." });
    }
    body.email = parsed.data.email;
    const digest = createHash("sha256").update(parsed.data.email).digest("hex");
    if (!(await consumeRateLimit(`password-reset-account:${digest}`, 3, 3600))) {
      throw new APIError("TOO_MANY_REQUESTS", { message: "Muitas tentativas. Aguarde alguns minutos e tente novamente." });
    }
    if (!memberMailAvailable()) throw new APIError("SERVICE_UNAVAILABLE", { message: "Recuperação temporariamente indisponível." });
    return;
  }
  const field = context.path === "/sign-in/email" ? "email" : context.path === "/sign-in/username" ? "username" : null;
  if (!field && context.path !== "/sign-up/email") return;
  if (!memberClientIp(context.headers ?? new Headers())) {
    throw new APIError("SERVICE_UNAVAILABLE", { message: "Autenticação temporariamente indisponível." });
  }
  if (!field) {
    if(supervisedRegistrationEnabled() && (!context.body||typeof context.body!=="object"||(context.body as Record<string,unknown>).adultDeclared!==true)) {
      throw new APIError("BAD_REQUEST",{message:"O cadastro deve ser solicitado por um adulto. Menores devem ser vinculados ao responsável."});
    }
    return;
  }
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
