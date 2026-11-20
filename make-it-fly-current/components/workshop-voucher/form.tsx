"use client";

import { useActionState, type ReactNode } from "react";
import type { VoucherActionResult } from "@/lib/workshop-voucher/actions";
import styles from "./form.module.css";

export function VoucherForm({ action, label, children }: {
  action: (state: VoucherActionResult, form: FormData) => Promise<VoucherActionResult>;
  label: string;
  children?: ReactNode;
}) {
  const [state, submit, pending] = useActionState(action, {});
  return <form action={submit} className={styles.form}>
    {children}
    <p><button type="submit" data-ap-button="secondary" disabled={pending}>{pending ? "Aguarde…" : label}</button></p>
    {state.message && <p role={state.ok ? "status" : "alert"}>{state.message}</p>}
  </form>;
}
