import { z } from "zod";
import { emailSchema, passwordSchema, safeNextPath } from "./validation";

export const FORGOT_PASSWORD_PATH = "/membros/esqueci-senha";
export const RESET_PASSWORD_PATH = "/membros/redefinir-senha";
export const PASSWORD_RESET_EXPIRES_IN = 30 * 60;
export const PASSWORD_RESET_SENT = "Se houver uma conta com esse e-mail, você receberá um link para redefinir sua senha. Confira também a caixa de spam. O link vale por 30 minutos.";
export const PASSWORD_RESET_INVALID = "Este link é inválido ou expirou. Solicite um novo link para redefinir sua senha.";

export const requestPasswordResetSchema = z.object({ email: emailSchema });
export const resetTokenSchema = z.string().min(1).max(256).regex(/^[A-Za-z0-9_-]+$/);
export const resetPasswordSchema = z.object({
  token: resetTokenSchema,
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine(value => value.password === value.confirmPassword, {
  path: ["confirmPassword"], message: "As senhas precisam ser iguais.",
});

export function passwordResetCallback(origin: string, next: unknown): string {
  const url = new URL(RESET_PASSWORD_PATH, origin);
  url.searchParams.set("next", safeNextPath(next));
  return url.href;
}

// Também protege chamadas diretas à API, sem confiar no Host do pedido.
export function normalizePasswordResetCallback(origin: string, value: unknown): string {
  if (value === undefined) return passwordResetCallback(origin, undefined);
  if (typeof value !== "string") throw new Error("Destino de recuperação inválido.");
  const url = new URL(value, origin);
  if (url.origin !== origin || url.username || url.password || url.pathname !== RESET_PASSWORD_PATH) {
    throw new Error("Destino de recuperação inválido.");
  }
  return passwordResetCallback(origin, url.searchParams.get("next"));
}
