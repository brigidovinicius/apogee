import Image from "next/image";
import styles from "./red-bull-support.module.css";

/** The can artwork and wording approved for Make It Fly, shared across Apogee. */
export function RedBullSupport() {
  return <aside className={styles.support} aria-label="Energizados por Red Bull">
    <p className={styles.heading}>Energizados por Red Bull</p>
    <Image src="/partners/red-bull-can-white.png" alt="Ilustração de uma lata Red Bull" width={1726} height={4918} sizes="(max-width: 540px) 30px, 36px" />
  </aside>;
}
