"use client";

import { useActionState } from "react";
import { createReply, type FormState } from "@/app/membros/actions";
import { Field, FormMessage } from "./form-field";
import styles from "./members.module.css";

export function ReplyForm({ topic }: { topic: string }) {
  const [state, action, pending] = useActionState(createReply, {} as FormState);
  return (
    <form className={styles.form} action={action} noValidate>
      <FormMessage message={state.message} />
      <input type="hidden" name="topic" value={topic} />
      <Field name="body" label="Sua resposta" error={state.errors?.body}>
        {(props) => <textarea {...props} name="body" required rows={6} maxLength={10000} defaultValue={state.values?.body} />}
      </Field>
      <div className={styles.actions}>
        <button className={styles.primary} type="submit" disabled={pending}>
          {pending ? "Enviando…" : "Responder"} <span aria-hidden>→</span>
        </button>
      </div>
    </form>
  );
}
