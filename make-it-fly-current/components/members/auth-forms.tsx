"use client";

import { useActionState } from "react";
import { signIn, signUp, type FormState } from "@/app/membros/actions";
import { Field, FormMessage } from "./form-field";
import styles from "./members.module.css";

const initial: FormState = {};

export function SignInForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signIn, initial);
  return (
    <form className={styles.form} action={action} noValidate>
      <FormMessage message={state.message} />
      <input type="hidden" name="next" value={next} />
      <Field name="email" label="E-mail" error={state.errors?.email}>
        {(props) => (
          <input {...props} name="email" type="email" autoComplete="email" required defaultValue={state.values?.email} />
        )}
      </Field>
      <Field name="password" label="Senha" error={state.errors?.password}>
        {(props) => <input {...props} name="password" type="password" autoComplete="current-password" required />}
      </Field>
      <div className={styles.actions}>
        <button className={styles.primary} type="submit" disabled={pending}>
          {pending ? "Entrando…" : "Entrar"} <span aria-hidden>→</span>
        </button>
      </div>
    </form>
  );
}

export function SignUpForm() {
  const [state, action, pending] = useActionState(signUp, initial);
  return (
    <form className={styles.form} action={action} noValidate>
      <FormMessage message={state.message} />
      <Field name="name" label="Nome" error={state.errors?.name}>
        {(props) => <input {...props} name="name" autoComplete="name" required maxLength={60} defaultValue={state.values?.name} />}
      </Field>
      <Field
        name="username"
        label="Nome de usuário"
        error={state.errors?.username}
        hint="Aparece no seu perfil. Letras minúsculas, números, ponto e sublinhado."
      >
        {(props) => (
          <input
            {...props}
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            minLength={3}
            maxLength={30}
            defaultValue={state.values?.username}
          />
        )}
      </Field>
      <Field name="email" label="E-mail" error={state.errors?.email}>
        {(props) => (
          <input {...props} name="email" type="email" autoComplete="email" required defaultValue={state.values?.email} />
        )}
      </Field>
      <Field name="password" label="Senha" error={state.errors?.password} hint="Mínimo de 8 caracteres.">
        {(props) => (
          <input {...props} name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={128} />
        )}
      </Field>
      <div className={styles.actions}>
        <button className={styles.primary} type="submit" disabled={pending}>
          {pending ? "Criando conta…" : "Criar conta"} <span aria-hidden>→</span>
        </button>
      </div>
    </form>
  );
}
