"use client";

import { useActionState } from "react";
import { updateProfile, type FormState } from "@/app/membros/actions";
import { Field, FormMessage } from "./form-field";
import styles from "./members.module.css";

export function ProfileForm({ name, bio }: { name: string; bio: string }) {
  const [state, action, pending] = useActionState(updateProfile, {} as FormState);
  return (
    <form className={styles.form} action={action} noValidate>
      <FormMessage message={state.message} />
      <Field name="name" label="Nome" error={state.errors?.name}>
        {(props) => (
          <input {...props} name="name" autoComplete="name" required maxLength={60} defaultValue={state.values?.name ?? name} />
        )}
      </Field>
      <Field name="bio" label="Bio" error={state.errors?.bio} hint="Até 500 caracteres. Conte o que você está construindo.">
        {(props) => <textarea {...props} name="bio" rows={5} maxLength={500} defaultValue={state.values?.bio ?? bio} />}
      </Field>
      <div className={styles.actions}>
        <button className={styles.primary} type="submit" disabled={pending}>
          {pending ? "Salvando…" : "Salvar perfil"} <span aria-hidden>→</span>
        </button>
      </div>
    </form>
  );
}
