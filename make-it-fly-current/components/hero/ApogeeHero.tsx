import { EarthPosterFallback } from "./EarthPosterFallback";
import { HeroContent } from "./HeroContent";
import styles from "./apogee.module.css";

export function ApogeeHero({ earthReady = false }: { earthReady?: boolean }) {
  return (
    <section id="inicio" data-flight-section data-apogee-hero
      className={styles.hero} aria-labelledby="hero-title">
      <div className={styles.frame}>
        <EarthPosterFallback hidden={earthReady} />
        <div className={styles.scrim} aria-hidden="true" />
        <HeroContent />
      </div>
    </section>
  );
}
