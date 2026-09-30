import Image from "next/image";
import Link from "next/link";
import styles from "./internal-shell.module.css";

export function InternalFooter() {
  return (
    <footer className={styles.footer}>
      <div>
        <Image
          className={styles.wordmark}
          src="/brand/make-it-fly-wordmark.png"
          alt="Make it fly — Building the future"
          width={2097}
          height={523}
        />
        <p>Um encontro para ideias que precisam ganhar o mundo.</p>
      </div>
      <nav aria-label="Navegação do rodapé">
        <Link href="/">Início</Link>
        <Link href="/galeria">Galeria</Link>
        <Link href="/loja">Loja</Link>
      </nav>
      <Image
        className={styles.apogeeLogo}
        src="/brand/apogee-logo-white.svg"
        alt="Apogee"
        width={1595}
        height={986}
      />
    </footer>
  );
}

