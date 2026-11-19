"use client";
import { useActionState, useEffect, useRef } from "react";
import { updateProgress } from "@/app/membros/trilha/actions";
import styles from "./deliverables.module.css";

export function LearningProgress({ id, completed }: { id: string; completed: boolean }) {
  const [state, action, pending] = useActionState(updateProgress, {});
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!pending && state.message) button.current?.focus({ preventScroll: true });
  }, [pending, state]);
  return <form action={action} aria-busy={pending} className={styles.progress}>
    <input type="hidden" name="activityId" value={id} />
    <input type="hidden" name="completed" value={completed ? "false" : "true"} />
    <button data-ap-button={completed ? "secondary" : "primary"} ref={button} type="submit" disabled={pending}>{pending ? "Salvando…" : completed ? "Reabrir atividade" : "Marcar como concluída"}</button>
    {state.message ? <p role={state.ok ? "status" : "alert"}>{state.message}</p> : null}
  </form>;
}
