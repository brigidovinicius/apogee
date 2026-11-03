"use server";

import { headers } from "next/headers";
import { redirect, RedirectType } from "next/navigation";
import type { FormState } from "@/app/membros/actions";
import { getAuth } from "@/lib/members/auth";
import { applicationOrigin } from "@/lib/members/mail";
import { fieldErrors, safeNextPath } from "@/lib/members/validation";
import {
  PASSWORD_RESET_INVALID, PASSWORD_RESET_SENT, passwordResetCallback,
  requestPasswordResetSchema, resetPasswordSchema,
} from "@/lib/members/password-recovery";

const text = (form: FormData, key: string) => {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
};

function errorState(error: unknown, resetting = false): FormState {
  const apiError = error as { status?: string; body?: { code?: string } } | null;
  if (apiError?.status === "TOO_MANY_REQUESTS") {
    return { message: "Muitas tentativas. Aguarde alguns minutos e tente novamente." };
  }
  if (resetting && ["INVALID_TOKEN", "USER_NOT_FOUND"].includes(apiError?.body?.code ?? "")) {
    return { message: PASSWORD_RESET_INVALID };
  }
  return { message: "Não foi possível concluir agora. Tente novamente em alguns minutos." };
}

export async function requestPasswordReset(_: FormState, form: FormData): Promise<FormState> {
  const values = { email: text(form, "email") };
  const parsed = requestPasswordResetSchema.safeParse(values);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };
  try {
    await getAuth().api.requestPasswordReset({ headers: await headers(), body: {
      email: parsed.data.email,
      redirectTo: passwordResetCallback(applicationOrigin(), text(form, "next")),
    } });
  } catch (error) {
    return { ...errorState(error), values };
  }
  return { ok: true, message: PASSWORD_RESET_SENT };
}

export async function resetPassword(_: FormState, form: FormData): Promise<FormState> {
  const parsed = resetPasswordSchema.safeParse({
    token: text(form, "token"), password: text(form, "password"), confirmPassword: text(form, "confirmPassword"),
  });
  if (!parsed.success) {
    const errors = fieldErrors(parsed.error);
    return errors.token ? { message: PASSWORD_RESET_INVALID } : { errors };
  }
  try {
    await getAuth().api.resetPassword({ headers: await headers(), body: {
      token: parsed.data.token, newPassword: parsed.data.password,
    } });
  } catch (error) {
    return errorState(error, true);
  }
  redirect(`/membros/entrar?senha=redefinida&next=${encodeURIComponent(safeNextPath(text(form, "next")))}`, RedirectType.replace);
}
