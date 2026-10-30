import Image from "next/image";
import Link from "next/link";
import { privacyPolicyReady } from "@/lib/privacy-policy";
import { termsOfUseReady } from "@/lib/terms-of-use";
import styles from "./site-shell.module.css";

export function SiteFooter() {
  const preview = process.env.APOGEE_LOCAL_PREVIEW === "1";
  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <div className={styles.footerBrand}>
          <Image
            src="/brand/apogee-logo-white.svg"
            alt="Apogee"
            width={1595}
            height={986}
            sizes="112px"
          />
          <p>Comunidade e experiências para tirar ideias do papel</p>
        </div>
        <nav aria-label="Navegação do rodapé">
          <Link href="/">Início</Link>
          <Link href="/oportunidades">Oportunidades</Link>
          <Link href="/blog">Blog</Link>
          <Link href="/galeria">Galeria</Link>
          <Link href="/loja">Loja</Link>
          <Link href="/makeitfly">Make It Fly</Link>
          <Link href="/membros">Membros</Link>
          {(preview || privacyPolicyReady()) && <Link href="/privacidade">Privacidade</Link>}
          {(preview || termsOfUseReady()) && <Link href="/termos">Termos de Uso</Link>}
        </nav>
      </div>
    </footer>
  );
}
