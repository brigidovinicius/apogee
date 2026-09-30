"use client";

import { ArrowDownRight } from "lucide-react";
import type { CommunityPhoto } from "@/lib/gallery-types";
import styles from "./gallery.module.css";

type PhotoGridProps = {
  photos: CommunityPhoto[];
  loading: boolean;
  error: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
};

const cardStyles = [
  styles.photoWide,
  styles.photoTall,
  styles.photoPortrait,
  styles.photoSquare,
  styles.photoLandscape,
];

export function PhotoGrid({ photos, loading, error, hasMore, loadingMore, onLoadMore }: PhotoGridProps) {
  return (
    <section
      id="mural-da-comunidade"
      className={styles.gallerySection}
      aria-labelledby="event-gallery-title"
    >
      <div className={styles.galleryHeading}>
        <p>Registros da comunidade Apogee</p>
        <h2 id="event-gallery-title">Quem mostra o que acontece são vocês.</h2>
        <span aria-hidden>↓</span>
      </div>

      {photos.length > 0 ? (
        <>
          <div className={styles.photoGrid} aria-label="Fotos publicadas pela comunidade Apogee">
            {photos.map((photo, index) => (
            <figure
              className={`${styles.photoCard} ${cardStyles[index % cardStyles.length]}`}
              key={photo.id}
              style={{ animationDelay: `${(index % 4) * 80}ms` }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.src} alt={photo.anonymous ? "Foto do evento Make It Fly enviada anonimamente" : `Foto do evento Make It Fly enviada por ${photo.author}`} loading="lazy" />
              <figcaption>
                <span>
                  <strong>{photo.author}</strong>
                  {!photo.anonymous && <small>@{photo.instagram}</small>}
                </span>
              </figcaption>
            </figure>
            ))}
          </div>
          {hasMore && <button className={styles.loadMore} type="button" disabled={loadingMore} onClick={onLoadMore}>{loadingMore ? "Carregando…" : "Ver mais fotos"}</button>}
          {error && <p className={styles.moreError}>Não foi possível carregar mais fotos. Tente novamente.</p>}
        </>
      ) : (
        <div className={styles.emptyGallery}>
          <div aria-hidden className={styles.emptyGalleryMark}>✦</div>
          <div>
            <strong>{error ? "Não foi possível carregar as fotos agora." : loading ? "Carregando os registros da comunidade…" : "A galeria da Apogee começa com registros reais."}</strong>
            <p>
              Compartilhe suas fotos do Make It Fly com créditos ou anonimamente.
              Elas aparecerão aqui depois do envio.
            </p>
          </div>
          <a href="#enviar-fotos">
            Incluir minhas fotos <ArrowDownRight aria-hidden strokeWidth={1.5} />
          </a>
        </div>
      )}
    </section>
  );
}
