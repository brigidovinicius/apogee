"use client";

import { useState, type FormEvent } from "react";
import { createAuthClient } from "better-auth/client";
import { oauthProviderClient } from "@better-auth/oauth-provider/client";
import { Field, FormMessage } from "./form-field";
import styles from "./members.module.css";

// This client forwards the signed OAuth request through email or Google login.
// The provider owns validation and the continuation redirect.
const authClient = createAuthClient({ plugins: [oauthProviderClient()] });

export function McpLogin() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string>();
  async function emailLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setMessage(undefined);
    const form = new FormData(event.currentTarget);
    try {
      const result = await authClient.signIn.email({ email: String(form.get("email") ?? ""), password: String(form.get("password") ?? "") });
      if (result.error) setMessage("Não foi possível entrar. Confira e-mail e senha ou tente novamente mais tarde.");
    } catch { setMessage("Não foi possível entrar agora. Tente novamente."); }
    finally { setPending(false); }
  }
  async function googleLogin() {
    setPending(true); setMessage(undefined);
    try {
      const result = await authClient.signIn.social({ provider: "google", callbackURL: window.location.href, requestSignUp: false });
      if (result.error) setMessage("Não foi possível entrar com Google. Use a conta já cadastrada na Apogee.");
    } catch { setMessage("Não foi possível entrar com Google agora."); }
    finally { setPending(false); }
  }
  return <form className={styles.form} onSubmit={emailLogin}>
    <FormMessage message={message} />
    <Field name="email" label="E-mail">{props => <input {...props} name="email" type="email" autoComplete="email" required maxLength={320} />}</Field>
    <Field name="password" label="Senha">{props => <input {...props} name="password" type="password" autoComplete="current-password" required maxLength={128} />}</Field>
    <button className={styles.primary} disabled={pending} type="submit">{pending ? "Entrando…" : "Entrar na Apogee"}</button>
    <button className={styles.googleButton} disabled={pending} type="button" onClick={googleLogin}>Entrar com Google</button>
  </form>;
}
