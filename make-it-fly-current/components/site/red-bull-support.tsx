import Image from "next/image";
import styles from "./red-bull-support.module.css";

/** Sponsorship of Apogee, confirmed by the user; no claim about OpenAI endorsement. */
export function RedBullSupport() {
  return <aside className={styles.support} aria-label="Apogee energizada por Red Bull, patrocinador oficial">
    <div><p className={styles.brand}>Apogee</p><p className={styles.heading}>Energizados por</p></div>
    <Image src="/partners/red-bull.png" alt="Red Bull" width={520} height={348} sizes="104px" />
    <p className={styles.caption}>Patrocinador oficial<br />da Apogee</p>
  </aside>;
}
