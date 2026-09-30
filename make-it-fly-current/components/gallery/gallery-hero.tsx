"use client";

import { ArrowDownRight } from "lucide-react";
import styles from "./gallery.module.css";

type GalleryHeroProps = {
  gridInView: boolean;
};

export function GalleryHero({ gridInView }: GalleryHeroProps) {
  return (
    <section className={styles.galleryHero} aria-labelledby="gallery-title">
      <div className={styles.heroRule} aria-hidden />

      <div className={styles.heroContent}>
        <p className={styles.heroEdition}>Comunidade Apogee · Evento Make it Fly</p>
        <h1 id="gallery-title">
          Make it <em>Fly</em>
        </h1>

        <div
          className={`${styles.heroDetails} ${gridInView ? styles.heroDetailsMuted : ""}`}
        >
          <p>Fotos da comunidade Apogee</p>
          <a href="#enviar-fotos">
            Incluir minhas fotos
            <ArrowDownRight aria-hidden strokeWidth={1.5} />
          </a>
        </div>
      </div>

      <div className={styles.heroFooter} aria-hidden>
        <span>Olhares</span>
        <span>Encontros</span>
        <span>Bastidores</span>
      </div>
    </section>
  );
}
