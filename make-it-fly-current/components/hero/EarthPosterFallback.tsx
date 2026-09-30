import styles from "./apogee.module.css";

export function EarthPosterFallback({ hidden }: { hidden: boolean }) {
  return (
    <picture className={styles.poster} data-hidden={hidden ? "true" : undefined}>
      <source media="(max-width: 767px)" srcSet="/earth/earth-poster-mobile.avif" />
      {/* Native picture keeps the decorative fallback available before React/WebGL. */}
      <img src="/earth/earth-poster-desktop.avif" width="1440" height="900" alt="" loading="eager" decoding="async" />
    </picture>
  );
}
