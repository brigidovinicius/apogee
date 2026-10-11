"use client";

import { useActionState, type ReactNode } from "react";
import type { BlogPostRow } from "@/lib/blog/data";
import { BLOG_CATEGORIES, statusLabel } from "@/lib/blog/shared";
import { saveBlogPost, type EditorState } from "./actions";
import styles from "./posts.module.css";

const initialState: EditorState = {};

function brasiliaInput(date: Date | null): string {
  if (!date) return "";
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(date).replace(" ", "T");
}

function Submit({ intent, children, tone = "secondary", disabled }: {
  intent: string; children: ReactNode; tone?: "primary" | "secondary" | "danger"; disabled: boolean;
}) {
  return <button className={styles[tone]} type="submit" name="intent" value={intent} disabled={disabled}>{children}</button>;
}

export function PostEditor({ post }: { post: BlogPostRow | null }) {
  const [state, action, pending] = useActionState(saveBlogPost.bind(null, post?.id ?? null), initialState);
  const lockedSlug = !!(post?.publishedAt || post?.scheduledAt);
  return <form className={styles.editor} action={action} key={state.attempt ?? "initial"}>
    <input type="hidden" name="revision" value={post?.revision ?? ""} />
    <section className={styles.canvas} aria-labelledby="content-title">
      <div className={styles.sectionHeading}><span>01 / Conteúdo</span><h2 id="content-title">O que você quer compartilhar?</h2></div>
      {state.message ? <p className={styles.errorSummary} role="alert">{state.message}</p> : null}
      <label className={styles.field}>Título <input name="title" required minLength={5} maxLength={140} defaultValue={state.values?.title ?? post?.title ?? ""} placeholder="Um título claro para o artigo" aria-describedby={state.errors?.title ? "title-error" : undefined} /></label>
      {state.errors?.title ? <p className={styles.fieldError} id="title-error">{state.errors.title}</p> : null}
      <label className={styles.field}>Endereço do artigo <span className={styles.hint}>/blog/</span><input name="slug" maxLength={90} defaultValue={state.values?.slug ?? post?.slug ?? ""} placeholder="Gerado pelo título se ficar vazio" readOnly={lockedSlug} /></label>
      {lockedSlug ? <p className={styles.help}>O endereço permanece fixo após agendar ou publicar para preservar os links.</p> : null}
      {state.errors?.slug ? <p className={styles.fieldError}>{state.errors.slug}</p> : null}
      <label className={styles.field}>Resumo <textarea name="excerpt" required minLength={20} maxLength={400} rows={3} defaultValue={state.values?.excerpt ?? post?.excerpt ?? ""} placeholder="Uma introdução curta para a listagem do blog" /></label>
      {state.errors?.excerpt ? <p className={styles.fieldError}>{state.errors.excerpt}</p> : null}
      <label className={styles.field}>Artigo <textarea name="body" required minLength={50} maxLength={60000} rows={18} defaultValue={state.values?.body ?? post?.body ?? ""} placeholder="Escreva em texto simples. Separe parágrafos com uma linha em branco." /></label>
      <p className={styles.help}>Texto simples: linhas em branco criam parágrafos. O conteúdo aparece sem código HTML executável.</p>
      {state.errors?.body ? <p className={styles.fieldError}>{state.errors.body}</p> : null}
    </section>
    <aside className={styles.inspector} aria-label="Configurações do artigo">
      <div className={styles.sectionHeading}><span>02 / Publicação</span><h2>Configurações</h2></div>
      <p className={styles.status}>Estado atual: <strong>{post ? statusLabel(post) : "Novo rascunho"}</strong></p>
      <label className={styles.field}>Tema <select name="category" defaultValue={state.values?.category ?? post?.category ?? "estudos"}>{BLOG_CATEGORIES.map((category) => <option value={category.value} key={category.value}>{category.label}</option>)}</select></label>
      {state.errors?.category ? <p className={styles.fieldError}>{state.errors.category}</p> : null}
      <label className={styles.check}><input type="checkbox" name="featured" defaultChecked={state.values ? state.values.featured === "on" : post?.featured ?? false} /> Destacar na listagem</label>
      <div className={styles.rule} />
      <label className={styles.field}>Título para buscadores <input name="seoTitle" maxLength={70} defaultValue={state.values?.seoTitle ?? post?.seoTitle ?? ""} placeholder="Opcional: usa o título do artigo" /></label>
      {state.errors?.seoTitle ? <p className={styles.fieldError}>{state.errors.seoTitle}</p> : null}
      <label className={styles.field}>Descrição para buscadores <textarea name="seoDescription" maxLength={160} rows={3} defaultValue={state.values?.seoDescription ?? post?.seoDescription ?? ""} placeholder="Opcional: usa o resumo" /></label>
      {state.errors?.seoDescription ? <p className={styles.fieldError}>{state.errors.seoDescription}</p> : null}
      <div className={styles.rule} />
      <label className={styles.field}>Agendar para <input type="datetime-local" name="scheduledAt" defaultValue={state.values?.scheduledAt ?? brasiliaInput(post?.scheduledAt ?? null)} /></label>
      <p className={styles.help}>Horário de Brasília. Para agendar, preencha a data e escolha “Agendar”.</p>
      {state.errors?.scheduledAt ? <p className={styles.fieldError}>{state.errors.scheduledAt}</p> : null}
      <div className={styles.actions} aria-label="Ações de publicação">
        <Submit intent="save" tone="primary" disabled={pending}>{post?.status === "archived" ? "Restaurar rascunho" : "Salvar alterações"}</Submit>
        <Submit intent="publish" disabled={pending}>Publicar agora</Submit>
        <Submit intent="schedule" disabled={pending}>Agendar</Submit>
        {post && post.status !== "draft" && post.status !== "archived" ? <Submit intent="unpublish" disabled={pending}>Retirar do ar</Submit> : null}
        {post && post.status !== "archived" ? <Submit intent="archive" tone="danger" disabled={pending}>Arquivar</Submit> : null}
      </div>
      {pending ? <p className={styles.help} role="status">Salvando…</p> : null}
    </aside>
  </form>;
}
