"use client";

import { createAuthClient } from "better-auth/client";
import { useActionState, useState } from "react";
import { signIn, signUp, type FormState } from "@/app/membros/actions";
import { googleOAuthErrorMessage } from "@/lib/members/social-auth";
import { Field, FormMessage } from "./form-field";
import styles from "./members.module.css";

const initial: FormState = {};
const authClient = createAuthClient();

type GoogleAuthProps = {
  next: string;
  errorMessage?: string;
  requestSignUp?: boolean;
};

function GoogleAuth({ next, errorMessage, requestSignUp = false }: GoogleAuthProps) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string>();
  const returnTo = requestSignUp ? "/membros/cadastro" : "/membros/entrar";
  const errorCallbackURL = `${returnTo}?next=${encodeURIComponent(next)}`;

  async function continueWithGoogle() {
    setPending(true);
    setMessage(undefined);
    try {
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: next,
        newUserCallbackURL: requestSignUp ? next : undefined,
        errorCallbackURL,
        requestSignUp,
      });
      if (result.error) setMessage(googleOAuthErrorMessage(result.error.code));
    } catch {
      setMessage("Não foi possível iniciar a entrada com Google. Tente novamente.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <div className={styles.oauthDivider} aria-hidden="true">
        <span />
        ou
        <span />
      </div>
      <FormMessage message={message ?? errorMessage} />
      <button className={styles.googleButton} type="button" disabled={pending} onClick={continueWithGoogle}>
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M21.35 12.24c0-.71-.06-1.39-.18-2.04H12v3.86h5.24a4.48 4.48 0 0 1-1.94 2.94v2.5h3.14c1.84-1.7 2.91-4.2 2.91-7.26Z" />
          <path fill="#34A853" d="M12 21.75c2.63 0 4.84-.87 6.46-2.36L15.32 17a5.82 5.82 0 0 1-8.67-3.06H3.4v2.58A9.76 9.76 0 0 0 12 21.75Z" />
          <path fill="#FBBC05" d="M6.65 13.94A5.87 5.87 0 0 1 6.32 12c0-.67.12-1.32.33-1.94V7.48H3.4A9.75 9.75 0 0 0 2.25 12c0 1.62.39 3.16 1.15 4.52l3.25-2.58Z" />
          <path fill="#EA4335" d="M12 6.25c1.52 0 2.89.52 3.97 1.55l2.98-2.98C16.83 2.85 14.63 1.75 12 1.75a9.76 9.76 0 0 0-8.6 5.73l3.25 2.58A5.82 5.82 0 0 1 12 6.25Z" />
        </svg>
        {pending ? "Redirecionando…" : requestSignUp ? "Criar conta com Google" : "Entrar com Google"}
      </button>
    </>
  );
}

export function SignInForm({ next, googleError }: { next: string; googleError?: string }) {
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
      <GoogleAuth next={next} errorMessage={googleError} />
    </form>
  );
}

export function SignUpForm({ next, googleError }: { next: string; googleError?: string }) {
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
      <GoogleAuth next={next} errorMessage={googleError} requestSignUp />
    </form>
  );
}
