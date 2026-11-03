"use client";

import { useActionState } from "react";
import { requestPasswordReset, resetPassword } from "@/app/membros/esqueci-senha/actions";
import { Field, FormMessage } from "./form-field";
import styles from "./members.module.css";
import type { FormState } from "@/app/membros/actions";

const initial: FormState = {};

export function ForgotPasswordForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(requestPasswordReset, initial);
  if (state.ok) return <p className={styles.lead} role="status">{state.message}</p>;
  return <form className={styles.form} action={action} noValidate>
    <FormMessage message={state.message} />
    <input type="hidden" name="next" value={next} />
    <Field name="email" label="E-mail da sua conta" error={state.errors?.email}>
      {props => <input {...props} name="email" type="email" autoComplete="email" required maxLength={254} defaultValue={state.values?.email} />}
    </Field>
    <div className={styles.actions}>
      <button className={styles.primary} type="submit" disabled={pending}>{pending ? "Enviando…" : "Enviar link de recuperação"}</button>
    </div>
  </form>;
}

export function ResetPasswordForm({ token, next }: { token: string; next: string }) {
  const [state, action, pending] = useActionState(resetPassword, initial);
  return <form className={styles.form} action={action} noValidate>
    <FormMessage message={state.message} />
    <input type="hidden" name="token" value={token} />
    <input type="hidden" name="next" value={next} />
    <Field name="password" label="Nova senha" error={state.errors?.password} hint="De 8 a 128 caracteres.">
      {props => <input {...props} name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={128} />}
    </Field>
    <Field name="confirmPassword" label="Confirme a nova senha" error={state.errors?.confirmPassword}>
      {props => <input {...props} name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={128} />}
    </Field>
    <div className={styles.actions}>
      <button className={styles.primary} type="submit" disabled={pending}>{pending ? "Salvando…" : "Salvar nova senha"}</button>
    </div>
  </form>;
}
