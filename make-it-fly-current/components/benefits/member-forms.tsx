"use client";
import Link from "next/link";
import { useActionState } from "react";
import { Bookmark, ArrowUpRight } from "lucide-react";
import { saveBenefitAction, startBenefitAction, type BenefitActionState } from "@/app/membros/beneficios/actions";
import styles from "./benefits.module.css";
export function BenefitSaveButton({ benefitId, saved, name }: { benefitId: string; saved: boolean; name: string }) {
  const [state, action, pending] = useActionState<BenefitActionState, FormData>(saveBenefitAction, {});
  const current = state.saved ?? saved;
  return <form action={action} className={styles.saveForm} aria-busy={pending}>
    <input type="hidden" name="benefitId" value={benefitId} /><input type="hidden" name="saved" value={String(!current)} />
    <button type="submit" className={styles.save} disabled={pending} aria-pressed={current} aria-label={`${current ? "Remover dos salvos" : "Salvar oferta"}: ${name}`}><Bookmark size={17} fill={current ? "currentColor" : "none"} aria-hidden="true" /><span>{pending ? "Salvando…" : current ? "Salva" : "Salvar"}</span></button>
    {state.message ? <span className={styles.feedback} role={state.ok ? "status" : "alert"}>{state.message}</span> : null}
  </form>;
}
export function BenefitStartForm({ benefitId, initialStatus }: { benefitId: string; initialStatus?: BenefitActionState["redemptionStatus"] }) {
  const [state, action, pending] = useActionState<BenefitActionState, FormData>(startBenefitAction, { redemptionStatus: initialStatus });
  return <div className={styles.start}>
    <form action={action} aria-busy={pending}><input type="hidden" name="benefitId" value={benefitId} /><button type="submit" disabled={pending} className={styles.primary}>{pending ? "Iniciando…" : state.redemptionStatus ? "Reabrir instruções de resgate" : "Iniciar resgate"}</button></form>
    {state.message ? <p role={state.ok ? "status" : "alert"}>{state.message}</p> : <p>O início fica no seu histórico. Abrir a oferta não confirma desconto ou crédito recebido.</p>}
    {state.ok && state.destination ? <a className={styles.primary} href={state.destination} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Continuar no parceiro <ArrowUpRight size={17} aria-hidden="true" /><span className="sr-only"> (nova aba)</span></a> : null}
    {state.ok ? <Link href="/membros/beneficios/resgates">Acompanhar meus resgates</Link> : null}
  </div>;
}
