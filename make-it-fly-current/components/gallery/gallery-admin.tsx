"use client";

import { useState } from "react";
import type { CommunityPhoto } from "@/lib/gallery-types";
import styles from "./gallery-admin.module.css";

type GalleryResponse = { photos?: CommunityPhoto[]; error?: string };

export function GalleryAdmin() {
  const [token, setToken] = useState("");
  const [photos, setPhotos] = useState<CommunityPhoto[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function loadPhotos() {
    setLoading(true);
    setStatus("");
    try {
      const response = await fetch("/api/gallery/admin", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token.trim()}` },
      });
      const body = await response.json() as GalleryResponse;
      if (!response.ok || !Array.isArray(body.photos)) throw new Error(body.error || "Acesso negado.");
      setPhotos(body.photos);
      setStatus(body.photos.length ? `${body.photos.length} foto(s) publicada(s).` : "Nenhuma foto publicada.");
    } catch (error) {
      setPhotos([]);
      setStatus(error instanceof Error ? error.message : "Não foi possível carregar a galeria.");
    } finally {
      setLoading(false);
    }
  }

  async function removePhoto(photo: CommunityPhoto) {
    const label = photo.anonymous ? "esta foto anônima" : `a foto de ${photo.author}`;
    if (!window.confirm(`Excluir definitivamente ${label}?`)) return;
    setDeleting(photo.id);
    setStatus("");
    try {
      const response = await fetch("/api/gallery/admin", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token.trim()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: photo.id }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "Não foi possível excluir a foto.");
      setPhotos((current) => current.filter((item) => item.id !== photo.id));
      setStatus("Foto excluída da galeria e do armazenamento.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Não foi possível excluir a foto.");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p>Make It Fly · administração</p>
        <h1>Gerenciar galeria</h1>
        <span>Liste as publicações e exclua somente o item selecionado.</span>
      </header>

      <section className={styles.access} aria-labelledby="access-title">
        <div>
          <h2 id="access-title">Acesso protegido</h2>
          <p>A credencial fica apenas nesta aba e não é salva no navegador.</p>
        </div>
        <label>
          <span>Credencial administrativa</span>
          <input
            type="password"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <button type="button" onClick={() => void loadPhotos()} disabled={loading || token.trim().length !== 64}>
          {loading ? "Carregando…" : "Abrir galeria"}
        </button>
      </section>

      {status && <p className={styles.status} role="status">{status}</p>}

      <section className={styles.grid} aria-label="Fotos publicadas">
        {photos.map((photo) => (
          <article key={photo.id} className={styles.card}>
            <img src={photo.src} alt={photo.anonymous ? "Publicação anônima" : `Publicação de ${photo.author}`} />
            <div className={styles.cardBody}>
              <div>
                <strong>{photo.anonymous ? "Anônimo" : photo.author}</strong>
                <span>{photo.anonymous ? "Modo anônimo" : `@${photo.instagram}`}</span>
                <time dateTime={photo.createdAt}>{new Date(photo.createdAt).toLocaleString("pt-BR")}</time>
              </div>
              <button type="button" onClick={() => void removePhoto(photo)} disabled={deleting === photo.id}>
                {deleting === photo.id ? "Excluindo…" : "Excluir foto"}
              </button>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
