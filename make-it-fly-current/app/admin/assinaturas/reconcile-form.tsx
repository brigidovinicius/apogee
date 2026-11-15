"use client";
import { useActionState } from "react";
import { reconcileMembership } from "./actions";
import styles from "@/components/community/deliverables.module.css";
export function ReconcileForm({ id, enabled }: { id: string; enabled: boolean }) {
  const [state, action, pending] = useActionState(reconcileMembership, {});
  return <form action={action} aria-busy={pending} className={styles.editor}><input type="hidden" name="id" value={id} />
    <button type="submit" disabled={!enabled || pending}>{pending ? "Consultando pagamentos…" : "Conciliar com a Stripe"}</button>
    {state.message ? <p role={state.ok ? "status" : "alert"}>{state.message}</p> : null}
  </form>;
}
