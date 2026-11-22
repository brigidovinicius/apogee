"use client";

import Image from "next/image";
import Link from "next/link";
import { Plus } from "lucide-react";
import { COMMUNITY_SIGNUP_PATH } from "@/content/community-offer";
import styles from "./community-sales-page.module.css";

export function FunnelHeader({ page }: { page: "community" | "recording" }) {
  return <header className={styles.header}>
    <Link className={styles.brand} href="/comunidade" prefetch={false} aria-label="Comunidade Apogee - início"><Image src="/brand/apogee-star.svg" alt="" width={24} height={30} /><span>Apogee<small>{page === "community" ? "Comunidade" : "Codex Community"}</small></span></Link>
    <nav className={styles.navigation} aria-label="Navegação principal">
      <Link href={page === "community" ? "#comunidade" : "/comunidade"} prefetch={false}>A comunidade</Link>
      {page === "recording" && <Link href="#como-funciona">O que aprender</Link>}
      <Link href={page === "community" ? "#planos" : "#duvidas"}>{page === "community" ? "Planos" : "Dúvidas"}</Link>
    </nav><Link className={styles.previewBadge} href="/">Conheça a Apogee</Link>
  </header>;
}

export function CommunityJoinButton({ label = "Criar conta gratuita", secondary = false, preview = false, signedIn = false, next }: { label?: string; secondary?: boolean; preview?: boolean; signedIn?: boolean; next?: string }) {
  const href = signedIn ? next ?? "/membros" : preview ? "/previa/entrada" : next ? `/membros/cadastro?next=${encodeURIComponent(next)}` : COMMUNITY_SIGNUP_PATH;
  return <Link data-ap-button={secondary ? "secondary" : "primary"} className={secondary ? styles.secondary : styles.primary} href={href} prefetch={false}>{signedIn ? "Continuar com minha conta" : label}</Link>;
}

export function FunnelFaq({ id, title, items }: { id: string; title: string; items: readonly { question: string; answer: string }[] }) {
  return <section className={[styles.section, styles.faqSection].join(" ")} id={id} aria-labelledby={`${id}-title`}><div><p className={styles.eyebrow}>Perguntas frequentes</p><h2 id={`${id}-title`}>{title}</h2></div><div className={styles.faqList}>{items.map(item => <details key={item.question}><summary>{item.question}<Plus size={18} aria-hidden="true" /></summary><p>{item.answer}</p></details>)}</div></section>;
}
