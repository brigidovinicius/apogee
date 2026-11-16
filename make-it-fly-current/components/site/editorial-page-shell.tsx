"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Plus } from "lucide-react";
import { useRef, type ReactNode } from "react";
import { useSiteLegalLinks } from "./site-legal-links";
import styles from "./editorial-page-shell.module.css";

const navigation = [
  { href: "/", label: "Início" },
  { href: "/comunidade", label: "Comunidade", section: "community" },
  { href: "/oportunidades", label: "Radar" },
  { href: "/blog", label: "Blog" },
  { href: "/loja", label: "Loja", section: "store" },
] as const;

/** Scoped to the two pages approved in the local design review. */
export function EditorialPageShell({ current, children, className }: {
  current: "community" | "store"; children: ReactNode; className?: string;
}) {
  const legal = useSiteLegalLinks();
  const menu = useRef<HTMLDetailsElement>(null);
  function closeMenu() { if (menu.current) menu.current.open = false; }

  return <div className={[styles.page, className].filter(Boolean).join(" ")} data-editorial-page={current}>
    <header className={[styles.header, styles.wrap].join(" ")}>
      <Link className={styles.brand} href="/" prefetch={false} aria-label="Apogee - início"><Image src="/brand/apogee-logo-navy.svg" alt="" width={120} height={74} sizes="120px" preload /></Link>
      <nav className={styles.desktopNavigation} aria-label="Navegação principal">{navigation.map(item => <Link key={item.href} href={item.href} prefetch={false} aria-current={"section" in item && item.section === current ? "page" : undefined}>{item.label}</Link>)}</nav>
      <Link className={styles.headerAction} href="/comunidade#comunidade" prefetch={false}>Conhecer a comunidade <ArrowUpRight size={18} aria-hidden="true" /></Link>
      <details ref={menu} className={styles.mobileMenu} onKeyDown={event => {
        if (event.key === "Escape" && menu.current?.open) { closeMenu(); menu.current?.querySelector("summary")?.focus(); }
      }}><summary>Menu <Plus size={16} aria-hidden="true" /></summary><nav aria-label="Navegação móvel">{navigation.map(item => <Link key={item.href} href={item.href} prefetch={false} onClick={closeMenu} aria-current={"section" in item && item.section === current ? "page" : undefined}>{item.label}</Link>)}<Link href="/membros" prefetch={false} onClick={closeMenu}>Membros</Link></nav></details>
    </header>
    {children}
    <footer className={styles.footer}><div className={[styles.wrap, styles.footerMain].join(" ")}>
      <Link href="/" prefetch={false} aria-label="Apogee - início"><Image src="/brand/apogee-logo-white.svg" alt="" width={150} height={93} sizes="150px" /></Link><p>Comunidade, ideias<br />e experiências.</p>
      <nav aria-label="Navegação do rodapé"><Link href="/comunidade" prefetch={false}>Comunidade</Link><Link href="/oportunidades" prefetch={false}>Radar</Link><Link href="/blog" prefetch={false}>Blog</Link><Link href="/loja" prefetch={false}>Loja</Link><Link href="/galeria" prefetch={false}>Galeria</Link><Link href="/evento-openai" prefetch={false}>Evento gratuito</Link><Link href="/membros" prefetch={false}>Membros</Link>{legal.privacy && <Link href="/privacidade">Privacidade</Link>}{legal.terms && <Link href="/termos">Termos de uso</Link>}</nav>
    </div><div className={[styles.wrap, styles.footerBottom].join(" ")}><span translate="no">Building the future.</span><span>Apogee Builders Club · Florianópolis</span></div></footer>
  </div>;
}
