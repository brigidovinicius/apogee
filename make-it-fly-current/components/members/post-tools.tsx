"use client";

import { useActionState, useState } from "react";
import { deletePost, editPost, type FormState } from "@/app/membros/actions";
import { Field, FormMessage } from "./form-field";
import styles from "./members.module.css";

type PostToolsProps = {
  postId: number;
  body: string;
  category: string;
  isOpening: boolean;
};

export function PostTools({ postId, body, category, isOpening }: PostToolsProps) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [editState, editAction, editPending] = useActionState(async (previous: FormState, form: FormData) => {
    const result = await editPost(previous, form);
    if (result.ok) setEditing(false);
    return result;
  }, {} as FormState);
  const [deleteState, deleteAction, deletePending] = useActionState(deletePost, {} as FormState);

  if (editing) {
    return (
      <form className={styles.form} action={editAction} noValidate style={{ marginTop: "1rem" }}>
        <FormMessage message={editState.message} />
        <input type="hidden" name="post" value={postId} />
        <Field name={`edit-${postId}`} label="Editar mensagem" error={editState.errors?.body}>
          {(props) => (
            <textarea {...props} name="body" rows={6} maxLength={10000} defaultValue={editState.values?.body ?? body} />
          )}
        </Field>
        <div className={styles.actions}>
          <button className={styles.linkButton} type="button" onClick={() => setEditing(false)}>
            Cancelar
          </button>
          <button className={styles.primary} type="submit" disabled={editPending}>
            {editPending ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className={styles.postTools}>
      <button className={styles.linkButton} type="button" onClick={() => setEditing(true)}>
        Editar
      </button>
      {confirming ? (
        <form action={deleteAction}>
          <input type="hidden" name="post" value={postId} />
          <input type="hidden" name="category" value={category} />
          <button className={styles.danger} type="submit" disabled={deletePending}>
            {isOpening ? "Confirmar: apagar tópico" : "Confirmar exclusão"}
          </button>{" "}
          <button className={styles.linkButton} type="button" onClick={() => setConfirming(false)}>
            Não apagar
          </button>
        </form>
      ) : (
        <button className={styles.danger} type="button" onClick={() => setConfirming(true)}>
          {isOpening ? "Apagar tópico" : "Apagar"}
        </button>
      )}
      {deleteState.message ? (
        <span className={styles.fieldError} role="alert">
          {deleteState.message}
        </span>
      ) : null}
    </div>
  );
}
