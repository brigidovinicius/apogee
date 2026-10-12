"use client";

import { useRef, useState } from "react";
import styles from "./posts.module.css";

export type MediaItem = { id: string; url: string; alt: string; caption: string | null; width: number; height: number };

export function MediaManager({ postId, initialMedia, coverId, onCover, onInsert }: {
  postId: number; initialMedia: MediaItem[]; coverId: string; onCover: (id: string) => void; onInsert: (id: string) => void;
}) {
  const [media, setMedia] = useState(initialMedia);
  const [alt, setAlt] = useState("");
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function upload() {
    const file = fileRef.current?.files?.[0];
    if (!file || alt.trim().length < 3) { setMessage("Selecione uma imagem e descreva seu conteúdo."); return; }
    if (file.size > 5 * 1024 * 1024) { setMessage("A imagem deve ter até 5 MB."); return; }
    setBusy(true); setMessage("");
    try {
      const form = new FormData();
      form.set("image", file); form.set("alt", alt.trim()); form.set("caption", caption.trim());
      const response = await fetch(`/api/admin/posts/${postId}/media`, { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Falha no envio.");
      setMedia((current) => [result.media as MediaItem, ...current]);
      setAlt(""); setCaption("");
      if (fileRef.current) fileRef.current.value = "";
      setMessage("Imagem enviada. Escolha como usá-la e salve o artigo.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Falha no envio."); }
    finally { setBusy(false); }
  }

  async function remove(item: MediaItem) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/posts/${postId}/media?mediaId=${encodeURIComponent(item.id)}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Falha ao excluir.");
      setMedia((current) => current.filter((candidate) => candidate.id !== item.id));
      setMessage("Imagem excluída.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Falha ao excluir."); }
    finally { setBusy(false); }
  }

  return <div className={styles.mediaManager}>
    <h3>Biblioteca deste artigo</h3>
    <p className={styles.help}>JPEG, PNG ou WebP até 5 MB. As imagens são convertidas para WebP. Descreva o que aparece na imagem para acessibilidade.</p>
    <label className={styles.field}>Imagem <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" /></label>
    <label className={styles.field}>Texto alternativo <input value={alt} onChange={(event) => setAlt(event.target.value)} minLength={3} maxLength={160} placeholder="Ex.: estudante lendo em uma biblioteca" /></label>
    <label className={styles.field}>Legenda opcional <input value={caption} onChange={(event) => setCaption(event.target.value)} maxLength={300} /></label>
    <button className={styles.mediaButton} type="button" onClick={upload} disabled={busy}>Enviar imagem</button>
    {message ? <p className={styles.mediaMessage} role="status">{message}</p> : null}
    {media.length ? <ul className={styles.mediaList}>{media.map((item) => <li key={item.id}>
      {/* The image URL points to this site's authenticated/public image route. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={item.url} alt={item.alt} width={item.width} height={item.height} loading="lazy" />
      <div><strong>{item.alt}</strong>{item.caption ? <small>{item.caption}</small> : null}<span>
        <button type="button" onClick={() => onCover(coverId === item.id ? "" : item.id)}>{coverId === item.id ? "Remover capa" : "Usar como capa"}</button>
        <button type="button" onClick={() => onInsert(item.id)}>Inserir no texto</button>
        <button type="button" onClick={() => remove(item)} disabled={busy || coverId === item.id} title={coverId === item.id ? "Remova da capa e salve antes de excluir" : undefined}>Excluir</button>
      </span></div>
    </li>)}</ul> : <p className={styles.help}>Nenhuma imagem enviada para este artigo.</p>}
    <p className={styles.help}>Imagens de rascunhos só abrem para administradores. Após a publicação, as imagens do artigo ficam públicas.</p>
  </div>;
}
