"use client";

import { useCommunityPhotos } from "./use-community-photos";
import styles from "@/components/landing/make-it-fly-v2.module.css";

export function GalleryHomepagePreview() {
  const { photos, loading, error } = useCommunityPhotos();
  const featured = photos.slice(0, 3);

  if (featured.length === 0) {
    return (
      <div className={styles.galleryPreviewEmpty} aria-live="polite">
        <span aria-hidden>✦</span>
        <p>{error ? "As fotos estão indisponíveis agora." : loading ? "Carregando fotos da comunidade…" : "As primeiras fotos da comunidade Apogee aparecerão aqui."}</p>
      </div>
    );
  }

  return (
    <div className={styles.galleryPreviewPhotos} aria-label="Fotos da comunidade Apogee">
      {featured.map((photo) => (
        <figure key={photo.id} className={styles.galleryPreviewPhoto}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.src} alt={photo.anonymous ? "Foto do Make It Fly enviada anonimamente" : `Foto do Make It Fly enviada por ${photo.author}`} loading="lazy" />
          <figcaption><strong>{photo.author}</strong>{!photo.anonymous && <span>@{photo.instagram}</span>}</figcaption>
        </figure>
      ))}
    </div>
  );
}
