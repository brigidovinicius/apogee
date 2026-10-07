"use client";

import { useActionState } from "react";
import { createTopic, type FormState } from "@/app/membros/actions";
import { Field, FormMessage } from "./form-field";
import styles from "./members.module.css";

export function TopicForm({ category }: { category: string }) {
  const [state, action, pending] = useActionState(createTopic, {} as FormState);
  return (
    <form className={styles.form} action={action} noValidate>
      <FormMessage message={state.message} />
      <input type="hidden" name="category" value={category} />
      <Field name="title" label="Título" error={state.errors?.title}>
        {(props) => <input {...props} name="title" required minLength={5} maxLength={120} defaultValue={state.values?.title} />}
      </Field>
      <Field name="body" label="Mensagem" error={state.errors?.body}>
        {(props) => <textarea {...props} name="body" required rows={8} maxLength={10000} defaultValue={state.values?.body} />}
      </Field>
      <div className={styles.actions}>
        <button className={styles.primary} type="submit" disabled={pending}>
          {pending ? "Publicando…" : "Publicar tópico"} <span aria-hidden>→</span>
        </button>
      </div>
    </form>
  );
}
