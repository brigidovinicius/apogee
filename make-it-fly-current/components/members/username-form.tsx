"use client";

import { useActionState } from "react";
import { completeUsername, type FormState } from "@/app/membros/actions";
import { NameInput } from "./name-input";
import { Field, FormMessage } from "./form-field";
import styles from "./members.module.css";

export function UsernameForm({ next, name, username }: { next: string; name: string; username: string }) {
  const [state, action, pending] = useActionState(completeUsername, {} as FormState);
  return (
    <form className={styles.form} action={action} noValidate>
      <FormMessage message={state.message} />
      <input type="hidden" name="next" value={next} />
      <Field name="name" label="Nome" error={state.errors?.name}>
        {(props) => <NameInput {...props} defaultValue={state.values?.name ?? name} />}
      </Field>
      <Field name="username" label="Nome de usuário" error={state.errors?.username}
        hint="Seu nome público no fórum e no perfil. Letras minúsculas, números, ponto e sublinhado.">
        {(props) => <input {...props} name="username" autoComplete="username" autoCapitalize="none"
          spellCheck={false} required minLength={3} maxLength={30} defaultValue={state.values?.username ?? username} />}
      </Field>
      <div className={styles.actions}>
        <button className={styles.primary} type="submit" disabled={pending}>
          {pending ? "Salvando…" : "Concluir cadastro"} <span aria-hidden>→</span>
        </button>
      </div>
    </form>
  );
}
