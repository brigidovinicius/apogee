"use client";

import Link from "next/link";
import { useActionState, useState, type ChangeEvent } from "react";
import { adminStyles } from "@/components/admin/admin-ui";
import { isRepositoryCategory } from "@/lib/toolbox/repositories.mjs";
import { TOOLBOX_STATUS_LABELS, type ToolboxCategory, type ManagedTool } from "@/lib/toolbox/types";
import { saveToolboxCategory, saveToolboxTool } from "./actions";
import styles from "./toolbox-admin.module.css";

function useFields(initial: Record<string, string>) {
  const [values, setValues] = useState(initial);
  return (name: string) => ({ name, value: values[name] ?? "", onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setValues(current => ({ ...current, [name]: event.target.value })) });
}
function StatusOptions() {
  return Object.entries(TOOLBOX_STATUS_LABELS).map(([value, label]) => <option value={value} key={value}>{label}</option>);
}
export function ToolboxCategoryForm({ item }: { item?: ToolboxCategory }) {
  const [state, action, pending] = useActionState(saveToolboxCategory, { error: "" });
  const bind = useFields({ name: item?.name ?? "", description: item?.description ?? "", status: item?.status ?? "draft", order: String(item?.order ?? 0) });
  return <section className={styles.editor} id="editor-categoria" aria-labelledby="category-editor-title">
    <h2 id="category-editor-title">{item ? "Editar categoria" : "Nova categoria"}</h2>
    <form action={action} className={adminStyles.catalogueForm} aria-labelledby="category-editor-title">
      <input type="hidden" name="id" value={item?.id ?? ""} /><input type="hidden" name="version" value={item?.version ?? ""} />
      <label className={adminStyles.field}><span>Nome da categoria</span><input required maxLength={80} {...bind("name")} placeholder="Ex.: Vídeo" /></label>
      <label className={adminStyles.field}><span>Descrição da categoria (opcional)</span><textarea maxLength={240} {...bind("description")} /></label>
      <div className={styles.twoFields}>
        <label className={adminStyles.field}><span>Estado da categoria</span><select {...bind("status")}><StatusOptions /></select></label>
        <label className={adminStyles.field}><span>Ordem da categoria</span><input type="number" min={0} max={9999} required {...bind("order")} /></label>
      </div>
      <p className={styles.hint}>Posições menores aparecem primeiro. Uma categoria aparece aos assinantes quando está publicada e tem ferramentas publicadas. Crie categorias de projetos com “GitHub” no início do nome.</p>
      {state.error ? <p role="alert" className={styles.error}>{state.error}</p> : null}
      <div className={styles.actions}><button className={adminStyles.button} disabled={pending}>{pending ? "Salvando…" : "Salvar categoria"}</button>{item ? <Link href="/admin/ferramentas#editor-categoria">Criar outra categoria</Link> : null}</div>
    </form>
  </section>;
}
export function ToolboxToolForm({ item, categories }: { item?: ManagedTool; categories: Pick<ToolboxCategory, "id" | "slug" | "name" | "status">[] }) {
  const [state, action, pending] = useActionState(saveToolboxTool, { error: "" });
  const [reviewed, setReviewed] = useState(false);
  const bind = useFields({ categoryId: item?.categoryId ?? "", name: item?.name ?? "", description: item?.description ?? "", url: item?.url ?? "", conditions: item?.conditions ?? "", status: item?.status ?? "draft", order: String(item?.order ?? 0) });
  return <section className={styles.editor} id="editor-ferramenta" aria-labelledby="tool-editor-title">
    <h2 id="tool-editor-title">{item ? "Editar ferramenta" : "Nova ferramenta"}</h2>
    {!categories.length ? <p>Crie uma categoria para organizar a primeira ferramenta.</p> : null}
    <form action={action} className={adminStyles.catalogueForm} aria-labelledby="tool-editor-title">
      <input type="hidden" name="id" value={item?.id ?? ""} /><input type="hidden" name="version" value={item?.version ?? ""} />
      <label className={adminStyles.field}><span>Nome da ferramenta</span><input required maxLength={100} {...bind("name")} placeholder="Ex.: Google Flow" /></label>
      <label className={adminStyles.field}><span>Categoria da ferramenta</span><select required {...bind("categoryId")}><option value="">Escolha uma categoria</option>{categories.map(category => <option key={category.id} value={category.id}>{category.name}{isRepositoryCategory(category.slug) ? " (Projetos do GitHub)" : ""} · {TOOLBOX_STATUS_LABELS[category.status]}</option>)}</select></label>
      <label className={adminStyles.field}><span>Descrição da ferramenta</span><textarea required maxLength={280} {...bind("description")} placeholder="Explique em uma frase para que serve." /></label>
      <label className={adminStyles.field}><span>Link oficial</span><input type="url" required maxLength={2048} autoComplete="off" {...bind("url")} placeholder="https://" /></label>
      <p className={styles.hint}>Use um link público HTTPS, sem credenciais, tokens ou dados pessoais. A Apogee não fornece contas ou créditos do serviço.</p>
      <label className={adminStyles.field}><span>Condições de uso verificadas (opcional)</span><textarea maxLength={280} {...bind("conditions")} placeholder="Preencha apenas condições que você conferiu no fornecedor." /></label>
      <p className={styles.hint}>Para projetos, comece as condições com “No navegador.”, “Instalação local.”, “Docker ou servidor.” ou “Código e terminal.” e acrescente os primeiros passos conferidos.</p>
      <div className={styles.twoFields}>
        <label className={adminStyles.field}><span>Estado da ferramenta</span><select {...bind("status")}><StatusOptions /></select></label>
        <label className={adminStyles.field}><span>Ordem da ferramenta</span><input type="number" min={0} max={9999} required {...bind("order")} /></label>
      </div>
      <label><input type="checkbox" name="reviewed" checked={reviewed} onChange={event => setReviewed(event.target.checked)} /><span>Conferi esta ficha e o link oficial.</span></label>
      <p className={styles.hint}>A publicação exige conferência. Alterar nome, texto ou link de uma ficha publicada exige nova conferência. A categoria também precisa estar publicada para aparecer ao membro.</p>
      {state.error ? <p role="alert" className={styles.error}>{state.error}</p> : null}
      <div className={styles.actions}><button className={adminStyles.button} disabled={pending || !categories.length}>{pending ? "Salvando…" : "Salvar ferramenta"}</button>{item ? <Link href="/admin/ferramentas#editor-ferramenta">Criar outra ferramenta</Link> : null}</div>
    </form>
  </section>;
}
