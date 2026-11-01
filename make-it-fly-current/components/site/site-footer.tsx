"use client";

import Image from "next/image";
import Link from "next/link";
import { useSiteLegalLinks } from "./site-legal-links";
import styles from "./site-shell.module.css";

export function SiteFooter() {
  const legalLinks = useSiteLegalLinks();
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
          {legalLinks.privacy && <Link href="/privacidade">Privacidade</Link>}
          {legalLinks.terms && <Link href="/termos">Termos de Uso</Link>}
        </nav>
      </div>
    </footer>
  );
}
