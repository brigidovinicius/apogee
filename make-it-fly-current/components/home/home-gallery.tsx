"use client";

import Link from "next/link";
import { useCommunityPhotos } from "@/components/gallery/use-community-photos";
import styles from "./editorial-home.module.css";

export function HomeGallery() {
  const { photos, loading, error } = useCommunityPhotos();
  const photo = photos[0];
  return <figure className={styles.communityPhoto} data-home-reveal>
    <div className={styles.photoFrame}>
      {photo ? <>
        {/* Keep the existing gallery URL: deletion/withdrawal is never defeated by a static copy. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.src} alt="Registro de um encontro Make It Fly da comunidade Apogee" width={photo.width} height={photo.height} loading="lazy" />
      </> : <div className={styles.galleryFallback}>
        <p>{loading ? "Carregando os registros da comunidade…" : error ? "Os registros estão indisponíveis neste momento." : "Os próximos encontros também vão ficar por aqui."}</p>
        <Link prefetch={false} href="/galeria">Explorar a galeria <span aria-hidden="true">↗</span></Link>
      </div>}
    </div>
    <figcaption>{photo ? `Make It Fly · ${photo.anonymous ? "Foto enviada anonimamente" : `Foto de ${photo.author}`}` : "Galeria da comunidade Apogee"}</figcaption>
  </figure>;
}
