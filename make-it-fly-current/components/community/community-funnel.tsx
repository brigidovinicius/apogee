"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Plus } from "lucide-react";
import { COMMUNITY_SIGNUP_PATH } from "@/content/community-offer";
import { useSiteLegalLinks } from "@/components/site/site-legal-links";
import styles from "./community-sales-page.module.css";

export function FunnelHeader({ page }: { page: "community" | "recording" }) {
  return <header className={styles.header}>
    <Link className={styles.brand} href="/comunidade" prefetch={false} aria-label="Comunidade Apogee - início"><Image src="/brand/apogee-star.svg" alt="" width={24} height={30} /><span>Apogee<small>{page === "community" ? "Comunidade" : "Codex Community"}</small></span></Link>
    <nav className={styles.navigation} aria-label="Navegação principal">
      <Link href={page === "community" ? "#comunidade" : "/comunidade"} prefetch={false}>A comunidade</Link>
      <Link href={page === "community" ? "#learn" : "#como-funciona"}>{page === "community" ? "Learn" : "O que aprender"}</Link>
      <Link href={page === "community" ? "#planos" : "#duvidas"}>{page === "community" ? "Planos" : "Dúvidas"}</Link>
    </nav><Link className={styles.previewBadge} href="/">Conheça a Apogee</Link>
  </header>;
}

export function CommunityJoinButton({ label = "Criar conta gratuita", secondary = false, preview = false, signedIn = false, next }: { label?: string; secondary?: boolean; preview?: boolean; signedIn?: boolean; next?: string }) {
  const href = signedIn ? next ?? "/membros" : preview ? "/previa/entrada" : next ? `/membros/cadastro?next=${encodeURIComponent(next)}` : COMMUNITY_SIGNUP_PATH;
  return <Link className={secondary ? styles.secondary : styles.primary} href={href} prefetch={false}>{signedIn ? "Continuar com minha conta" : label}<ArrowUpRight size={18} aria-hidden="true" /></Link>;
}

export function FunnelFaq({ id, title, items }: { id: string; title: string; items: readonly { question: string; answer: string }[] }) {
  return <section className={[styles.section, styles.faqSection].join(" ")} id={id} aria-labelledby={`${id}-title`}><div><p className={styles.eyebrow}>Perguntas frequentes</p><h2 id={`${id}-title`}>{title}</h2></div><div className={styles.faqList}>{items.map(item => <details key={item.question}><summary>{item.question}<Plus size={18} aria-hidden="true" /></summary><p>{item.answer}</p></details>)}</div></section>;
}

export function FunnelFooter() {
  const legal = useSiteLegalLinks();
  return <footer className={styles.footer}>
    <Link className={styles.brand} href="/" prefetch={false} aria-label="Apogee - página inicial"><Image src="/brand/apogee-star.svg" alt="" width={24} height={30} /><span>Apogee<small>Conhecimento e oportunidades</small></span></Link>
    <nav aria-label="Navegação do rodapé"><Link href="/comunidade" prefetch={false}>Comunidade</Link><Link href="/evento-openai" prefetch={false}>Evento gratuito</Link><Link href="/oportunidades" prefetch={false}>Radar</Link><Link href="/blog" prefetch={false}>Blog</Link>{legal.privacy && <Link href="/privacidade">Privacidade</Link>}{legal.terms && <Link href="/termos">Termos de uso</Link>}</nav>
    <p>Conhecimento, oportunidades e gente para colocar ideias em movimento.</p>
  </footer>;
}
