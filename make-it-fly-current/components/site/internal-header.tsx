import Image from "next/image";
import Link from "next/link";
import styles from "./internal-shell.module.css";

type InternalHeaderProps = {
  current: "galeria" | "loja";
};

export function InternalHeader({ current }: InternalHeaderProps) {
  return (
    <header className={styles.header}>
      <Link className={styles.brand} href="/" aria-label="Make it fly — início">
        <Image
          src="/brand/apogee-star.svg"
          alt=""
          width={64}
          height={78}
          aria-hidden
        />
        <span>
          <strong>Make it fly</strong>
          <small>By Apogee</small>
        </span>
      </Link>

      <nav className={styles.navigation} aria-label="Navegação principal">
        <Link
          className={current === "galeria" ? styles.active : undefined}
          href="/galeria"
          aria-current={current === "galeria" ? "page" : undefined}
        >
          Galeria
        </Link>
        <Link
          className={current === "loja" ? styles.active : undefined}
          href="/loja"
          aria-current={current === "loja" ? "page" : undefined}
        >
          Loja
        </Link>
      </nav>

      <Link className={styles.backLink} href="/#participar">
        Participar <span aria-hidden>↗</span>
      </Link>
    </header>
  );
}

