"use client";

import { useActionState, useRef, useState, type ReactNode } from "react";
import type { BlogPostRow } from "@/lib/blog/data";
import { analyzeSeo } from "@/lib/blog/seo";
import { BLOG_CATEGORIES, statusLabel } from "@/lib/blog/shared";
import { saveBlogPost, type EditorState } from "./actions";
import { MediaManager, type MediaItem } from "./media-manager";
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

export function PostEditor({ post, media = [] }: { post: BlogPostRow | null; media?: MediaItem[] }) {
  const [state, action, pending] = useActionState(saveBlogPost.bind(null, post?.id ?? null), initialState);
  const lockedSlug = !!(post?.publishedAt || post?.scheduledAt);
  const [seoDraft, setSeoDraft] = useState({
    title: post?.title ?? "", slug: post?.slug ?? "", excerpt: post?.excerpt ?? "",
    body: post?.body ?? "", seoTitle: post?.seoTitle ?? "",
    seoDescription: post?.seoDescription ?? "", focusKeyword: post?.focusKeyword ?? "",
  });
  const updateSeo = (field: keyof typeof seoDraft, value: string) => setSeoDraft((current) => ({ ...current, [field]: value }));
  const [coverId, setCoverId] = useState(post?.coverMediaId ?? "");
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  function insertMedia(id: string) {
    const textarea = bodyRef.current;
    const marker = `\n\n[[media:${id}]]\n\n`;
    if (!textarea) { updateSeo("body", `${seoDraft.body}${marker}`); return; }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    updateSeo("body", `${seoDraft.body.slice(0, start)}${marker}${seoDraft.body.slice(end)}`);
    requestAnimationFrame(() => { textarea.focus(); textarea.setSelectionRange(start + marker.length, start + marker.length); });
  }
  const seo = analyzeSeo(seoDraft);
  return <form className={styles.editor} action={action}>
    <input type="hidden" name="revision" value={post?.revision ?? ""} />
    <section className={styles.canvas} aria-labelledby="content-title">
      <div className={styles.sectionHeading}><span>01 / Conteúdo</span><h2 id="content-title">O que você quer compartilhar?</h2></div>
      {state.message ? <p className={styles.errorSummary} role="alert">{state.message}</p> : null}
      <label className={styles.field}>Título <input name="title" required minLength={5} maxLength={140} defaultValue={state.values?.title ?? post?.title ?? ""} onChange={(event) => updateSeo("title", event.target.value)} placeholder="Um título claro para o artigo" aria-describedby={state.errors?.title ? "title-error" : undefined} /></label>
      {state.errors?.title ? <p className={styles.fieldError} id="title-error">{state.errors.title}</p> : null}
      <label className={styles.field}>Endereço do artigo <span className={styles.hint}>/blog/</span><input name="slug" maxLength={90} defaultValue={state.values?.slug ?? post?.slug ?? ""} onChange={(event) => updateSeo("slug", event.target.value)} placeholder="Gerado pelo título se ficar vazio" readOnly={lockedSlug} /></label>
      {lockedSlug ? <p className={styles.help}>O endereço permanece fixo após agendar ou publicar para preservar os links.</p> : null}
      {state.errors?.slug ? <p className={styles.fieldError}>{state.errors.slug}</p> : null}
      <label className={styles.field}>Resumo <textarea name="excerpt" required minLength={20} maxLength={400} rows={3} defaultValue={state.values?.excerpt ?? post?.excerpt ?? ""} onChange={(event) => updateSeo("excerpt", event.target.value)} placeholder="Uma introdução curta para a listagem do blog" /></label>
      {state.errors?.excerpt ? <p className={styles.fieldError}>{state.errors.excerpt}</p> : null}
      <label className={styles.field}>Artigo <textarea ref={bodyRef} name="body" required minLength={50} maxLength={60000} rows={18} value={seoDraft.body} onChange={(event) => updateSeo("body", event.target.value)} placeholder="Escreva em texto simples. Separe parágrafos com uma linha em branco." /></label>
      <p className={styles.help}>Texto simples: linhas em branco criam parágrafos. O conteúdo aparece sem código HTML executável.</p>
      {state.errors?.body ? <p className={styles.fieldError}>{state.errors.body}</p> : null}
      <div className={styles.mediaSection}><div className={styles.sectionHeading}><span>02 / Mídias</span><h2>Imagens do artigo</h2></div>
        {post ? <MediaManager postId={post.id} initialMedia={media} coverId={coverId} onCover={setCoverId} onInsert={insertMedia} /> : <p className={styles.help}>Salve o rascunho para enviar imagens e escolher uma capa.</p>}
      </div>
    </section>
    <aside className={styles.inspector} aria-label="Configurações do artigo">
      <div className={styles.sectionHeading}><span>03 / Publicação</span><h2>Configurações</h2></div>
      <input type="hidden" name="coverMediaId" value={coverId} />
      <p className={styles.status}>Estado atual: <strong>{post ? statusLabel(post) : "Novo rascunho"}</strong></p>
      <label className={styles.field}>Tema <select name="category" defaultValue={state.values?.category ?? post?.category ?? "estudos"}>{BLOG_CATEGORIES.map((category) => <option value={category.value} key={category.value}>{category.label}</option>)}</select></label>
      {state.errors?.category ? <p className={styles.fieldError}>{state.errors.category}</p> : null}
      <label className={styles.check}><input type="checkbox" name="featured" defaultChecked={state.values ? state.values.featured === "on" : post?.featured ?? false} /> Destacar na listagem</label>
      <label className={styles.field}>Vídeo por link <input type="url" name="videoUrl" maxLength={300} defaultValue={state.values?.videoUrl ?? post?.videoUrl ?? ""} placeholder="https://www.youtube.com/watch?v=..." /></label>
      <p className={styles.help}>Aceita links HTTPS do YouTube e Vimeo. O vídeo aparece após o texto.</p>
      {state.errors?.videoUrl ? <p className={styles.fieldError}>{state.errors.videoUrl}</p> : null}
      <div className={styles.rule} />
      <label className={styles.field}>Palavra-chave foco <input name="focusKeyword" maxLength={80} defaultValue={state.values?.focusKeyword ?? post?.focusKeyword ?? ""} onChange={(event) => updateSeo("focusKeyword", event.target.value)} placeholder="Ex.: bolsas de estudo" /></label>
      <p className={styles.help}>Usada na análise editorial abaixo. Não gera a tag “meta keywords”, ignorada pelo Google.</p>
      {state.errors?.focusKeyword ? <p className={styles.fieldError}>{state.errors.focusKeyword}</p> : null}
      <label className={styles.field}>Título para buscadores <input name="seoTitle" maxLength={70} defaultValue={state.values?.seoTitle ?? post?.seoTitle ?? ""} onChange={(event) => updateSeo("seoTitle", event.target.value)} placeholder="Opcional: usa o título do artigo" /></label>
      {state.errors?.seoTitle ? <p className={styles.fieldError}>{state.errors.seoTitle}</p> : null}
      <label className={styles.field}>Descrição para buscadores <textarea name="seoDescription" maxLength={160} rows={3} defaultValue={state.values?.seoDescription ?? post?.seoDescription ?? ""} onChange={(event) => updateSeo("seoDescription", event.target.value)} placeholder="Opcional: usa o resumo" /></label>
      {state.errors?.seoDescription ? <p className={styles.fieldError}>{state.errors.seoDescription}</p> : null}
      <label className={styles.check}><input type="checkbox" name="seoNoIndex" defaultChecked={state.values ? state.values.seoNoIndex === "on" : post?.seoNoIndex ?? false} /> Não indexar este artigo em buscadores</label>
      <div className={styles.seoPreview} aria-label="Prévia de busca"><span>Prévia de busca</span><strong>{seo.previewTitle || "Título do artigo"}</strong><small>apogee.community/blog/{seoDraft.slug || "endereco-do-artigo"}</small><p>{seo.previewDescription || "O resumo do artigo aparece aqui."}</p></div>
      <div className={styles.seoChecks} aria-live="polite"><strong>Revisão da palavra-chave</strong>{seoDraft.focusKeyword.trim() ? <ul>{seo.checks.map((check) => <li key={check.label} data-passed={check.passed}>{check.passed ? "✓" : "○"} {check.label}</li>)}</ul> : <p>Defina a palavra-chave foco para ver sugestões.</p>}<small>Estas verificações orientam a revisão; não garantem posição nas buscas.</small></div>
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
