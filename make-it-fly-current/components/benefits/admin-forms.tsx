"use client";
import { useActionState, useId } from "react";
import { saveCategoryAction, reviewRedemptionAction, type BenefitManagementState } from "@/app/admin/beneficios/workspace-actions";
import type { BenefitCategory, AdminRedemption } from "@/lib/benefits/types";
import styles from "@/components/community/deliverables.module.css";
export function BenefitCategoryForm({ category }: { category?: BenefitCategory }) {
  const id = useId(), [state, action, pending] = useActionState<BenefitManagementState, FormData>(saveCategoryAction, {});
  return <form action={action} className={styles.editor} aria-busy={pending}>
    {category ? <><input type="hidden" name="id" value={category.id} /><input type="hidden" name="version" value={category.version} /></> : null}
    <fieldset disabled={pending} className={styles.editor}><legend>{category ? "Editar categoria" : "Nova categoria"}</legend>
      <label htmlFor={`${id}-name`}>Nome da categoria<input id={`${id}-name`} name="name" defaultValue={category?.name ?? ""} maxLength={80} required /></label>
      <label htmlFor={`${id}-description`}>Descrição da categoria<input id={`${id}-description`} name="description" defaultValue={category?.description ?? ""} maxLength={240} /></label>
      <label htmlFor={`${id}-order`}>Ordem da categoria<input id={`${id}-order`} type="number" name="sortOrder" defaultValue={category?.sort_order ?? 0} min={0} max={10000} required /></label>
      <label htmlFor={`${id}-status`}>Estado da categoria<select id={`${id}-status`} name="status" defaultValue={category?.status ?? "draft"}><option value="draft">Rascunho</option><option value="published">Publicada</option><option value="archived">Arquivada</option></select></label>
      <button type="submit">{pending ? "Salvando…" : "Salvar categoria"}</button>
    </fieldset>{state.message ? <p role={state.ok ? "status" : "alert"}>{state.message}</p> : null}
  </form>;
}
export function BenefitRedemptionReview({ redemption }: { redemption: AdminRedemption }) {
  const id = useId(), [state, action, pending] = useActionState<BenefitManagementState, FormData>(reviewRedemptionAction, {});
  return <form action={action} className={styles.editor} aria-busy={pending}>
    <input type="hidden" name="id" value={redemption.id} /><input type="hidden" name="revision" value={redemption.revision} />
    <fieldset disabled={pending} className={styles.editor}><legend>Conferir resultado no parceiro</legend>
      <label htmlFor={`${id}-status`}>Resultado<select id={`${id}-status`} name="status" defaultValue={redemption.status === "rejected" ? "rejected" : "confirmed"}><option value="confirmed">Confirmado por evidência</option><option value="rejected">Não aprovado</option></select></label>
      <label htmlFor={`${id}-evidence`}>Referência privada da conferência<input id={`${id}-evidence`} name="evidenceReference" defaultValue={redemption.evidence_reference} minLength={8} maxLength={500} required /></label>
      <p>Informe a referência de um ticket ou documento conferido. Não copie senhas, códigos individuais ou dados pessoais. Um clique não comprova o recebimento do benefício.</p>
      <button type="submit">{pending ? "Registrando…" : "Registrar conferência"}</button>
    </fieldset>{state.message ? <p role={state.ok ? "status" : "alert"}>{state.message}</p> : null}
  </form>;
}
