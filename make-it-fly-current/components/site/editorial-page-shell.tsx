"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { SiteHeader } from "./site-header";
import { useSiteLegalLinks } from "./site-legal-links";
import styles from "./editorial-page-shell.module.css";

export function EditorialPageShell({ current, children, className }: {
  current: "community" | "store"; children: ReactNode; className?: string;
}) {
  const legal = useSiteLegalLinks();
  return <div className={[styles.page, className].filter(Boolean).join(" ")} data-editorial-page={current}>
    <SiteHeader current={current} tone="light" adaptive prefetch={false} />
    {children}
    <footer className={styles.footer}><div className={[styles.wrap, styles.footerMain].join(" ")}>
      <Link href="/" prefetch={false} aria-label="Apogee - início"><Image src="/brand/apogee-logo-white.svg" alt="" width={150} height={93} sizes="150px" /></Link><p>Comunidade, ideias<br />e experiências.</p>
      <nav aria-label="Navegação do rodapé"><Link href="/comunidade" prefetch={false}>Comunidade</Link><Link href="/oportunidades" prefetch={false}>Radar</Link><Link href="/blog" prefetch={false}>Blog</Link><Link href="/loja" prefetch={false}>Loja</Link><Link href="/galeria" prefetch={false}>Galeria</Link><Link href="/evento-openai" prefetch={false}>Evento gratuito</Link><Link href="/membros" prefetch={false}>Membros</Link>{legal.privacy && <Link href="/privacidade">Privacidade</Link>}{legal.terms && <Link href="/termos">Termos de uso</Link>}</nav>
    </div><div className={[styles.wrap, styles.footerBottom].join(" ")}><span translate="no">Building the future.</span><span>Apogee Builders Club · Florianópolis</span></div></footer>
  </div>;
}
