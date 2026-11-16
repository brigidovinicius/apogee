"use client";
import { useActionState, useId, useState } from "react";
import { saveEditorial, type EditorialState } from "@/app/admin/beneficios/actions";
import type { DeliverableKind } from "@/lib/deliverables/validation";
import { PROVIDER_ACCESS_LABELS } from "@/lib/benefits/types";
import styles from "./deliverables.module.css";
type Choice = { id: string; name: string };
type Field = { key: string; label: string; long?: boolean; type?: string; required?: boolean };
const fields: Record<DeliverableKind, Field[]> = {
  benefit: [
    { key: "partner", label: "Ferramenta ou parceiro", required: true }, { key: "description", label: "Descrição da oferta e variante", long: true, required: true },
    { key: "providerLabel", label: "Disponibilizado por (opcional)" }, { key: "sourceUrl", label: "Página pública de referência (não comprova acordo)", type: "url" },
    { key: "evidenceUrl", label: "Fonte HTTPS de comprovação do acordo (somente administração)", type: "url" },
    { key: "eligibility", label: "Elegibilidade", long: true }, { key: "availability", label: "Disponibilidade e limites", long: true },
    { key: "startsAt", label: "Início da vigência (UTC)", type: "date" }, { key: "endsAt", label: "Fim da vigência, exclusivo (UTC)", type: "date" },
    { key: "redemption", label: "Procedimento real de resgate e validação de titularidade", long: true },
    { key: "redemptionUrl", label: "Link oficial de resgate, sem credenciais ou códigos pessoais", type: "url" },
  ],
  track: [{ key: "description", label: "Objetivo e limites desta trilha parcial", long: true, required: true }],
  module: [{ key: "description", label: "Objetivo e instruções do módulo", long: true, required: true }, { key: "deliverable", label: "Entregável esperado", long: true, required: true }],
  activity: [{ key: "instructions", label: "Instruções completas e material autorizado", long: true, required: true }, { key: "resourceUrl", label: "Material externo oficial (opcional)", type: "url" }],
};
export function DeliverableEditor({ kind, values = {}, choices = [] }: { kind: DeliverableKind; values?: Record<string, string>; choices?: Choice[] }) {
  const id = useId();
  const [data, setData] = useState<Record<string,string>>(() => ({ name: "", sortOrder: "0", status: "draft", ...values }));
  // Keep the revision paired with these fields. A refresh of another row must
  // never attach a newer revision to this still-unsaved local draft.
  const [revision, setRevision] = useState(values.revision ?? "");
  const setField = (key: string, value: string) => setData(current => ({ ...current, [key]: value }));
  const [state, action, pending] = useActionState(async (previous: EditorialState, form: FormData) => {
    const result = await saveEditorial(previous, form);
    if (result.ok && !values.id) setData({ name: "", sortOrder: "0", status: "draft" });
    if (result.ok && result.revision) setRevision(result.revision);
    return result;
  }, {});
  const parent = kind === "module" ? "trackId" : kind === "activity" ? "moduleId" : null;
  return <form action={action} aria-busy={pending} className={styles.editor}>
    <input type="hidden" name="kind" value={kind} />{values.id ? <input type="hidden" name="id" value={values.id} /> : null}
    {values.id ? <input type="hidden" name="revision" value={revision} /> : null}
    <fieldset disabled={pending} className={styles.editor}>
      <legend>{values.id ? "Editar registro" : "Criar registro"}</legend>
      <label htmlFor={`${id}-name`}>Nome<input id={`${id}-name`} name="name" value={data.name ?? ""} onChange={e => setField("name", e.target.value)} maxLength={140} required /></label>
      {parent ? <label htmlFor={`${id}-parent`}>{kind === "module" ? "Trilha" : "Módulo"}<select id={`${id}-parent`} name={parent} value={data[parent] ?? ""} onChange={e => setField(parent, e.target.value)} required><option value="" disabled>Selecione</option>{choices.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label> : null}
      {kind === "benefit" ? <>
        <label htmlFor={`${id}-category`}>Categoria<select id={`${id}-category`} name="categoryId" value={data.categoryId ?? ""} onChange={e => setField("categoryId", e.target.value)}><option value="">Sem categoria</option>{choices.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label htmlFor={`${id}-provider-access`}>Acesso à oferta no fornecedor<select id={`${id}-provider-access`} name="providerAccess" value={data.providerAccess ?? "unconfirmed"} onChange={e => setField("providerAccess", e.target.value)}>{Object.entries(PROVIDER_ACCESS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      </> : null}
      {fields[kind].map(f => <label key={f.key} htmlFor={`${id}-${f.key}`}>{f.label}{f.long ? <textarea id={`${id}-${f.key}`} name={f.key} value={data[f.key] ?? ""} onChange={e => setField(f.key, e.target.value)} maxLength={f.key === "instructions" ? 12000 : f.key === "redemption" ? 4000 : 2000} required={f.required} /> : <input id={`${id}-${f.key}`} name={f.key} type={f.type ?? "text"} value={data[f.key] ?? ""} onChange={e => setField(f.key, e.target.value)} maxLength={1000} required={f.required} />}</label>)}
      <label htmlFor={`${id}-order`}>Ordem<input id={`${id}-order`} name="sortOrder" type="number" min={0} max={10000} step={1} value={data.sortOrder ?? "0"} onChange={e => setField("sortOrder", e.target.value)} required /></label>
      <label htmlFor={`${id}-status`}>Estado editorial<select id={`${id}-status`} name="status" value={data.status ?? "draft"} onChange={e => setField("status", e.target.value)}><option value="draft">Rascunho</option>{kind !== "benefit" ? <option value="preparing">Em preparação</option> : null}<option value="published">Publicado</option><option value="archived">Arquivado</option></select></label>
      <p>{kind === "benefit" ? "Publicar exige comprovação, vigência, condições e resgate. Nenhum acordo é criado por este formulário." : "Publique somente material autorizado e revisado. Arquivar um módulo ou trilha restringe também seus conteúdos."}</p>
      <button disabled={pending || Boolean(parent && !choices.length)} type="submit">{pending ? "Salvando…" : "Salvar conteúdo"}</button>
    </fieldset>
    {state.message ? <p role={state.ok ? "status" : "alert"}>{state.message}</p> : null}
  </form>;
}
