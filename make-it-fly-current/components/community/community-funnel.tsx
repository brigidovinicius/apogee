"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, MessageCircle, Plus, X } from "lucide-react";
import { useId, useRef } from "react";
import { useSiteLegalLinks } from "@/components/site/site-legal-links";
import styles from "./community-sales-page.module.css";

export function FunnelHeader({ page }: { page: "community" | "recording" }) {
  return <header className={styles.header}>
    <Link className={styles.brand} href="/comunidade" prefetch={false} aria-label="Comunidade Apogee — início"><Image src="/brand/apogee-star.svg" alt="" width={24} height={30} /><span>Apogee<small>{page === "community" ? "Comunidade" : "Codex Community"}</small></span></Link>
    <nav className={styles.navigation} aria-label="Navegação principal">
      <Link href={page === "community" ? "#comunidade" : "/comunidade"} prefetch={false}>A comunidade</Link>
      <Link href={page === "community" ? "#cursos" : "#como-funciona"}>{page === "community" ? "Cursos de IA" : "Como funciona"}</Link>
      <Link href={page === "community" ? "/gravacao" : "#duvidas"} prefetch={false}>{page === "community" ? "Gravação do evento" : "Dúvidas"}</Link>
    </nav><span className={styles.previewBadge}>Prévia local</span>
  </header>;
}

export function CommunityJoinButton({ label = "Participar gratuitamente", secondary = false }: { label?: string; secondary?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  return <>
    <button className={secondary ? styles.secondary : styles.primary} type="button" onClick={() => dialog.current?.showModal()} aria-haspopup="dialog" aria-controls={id}>{label}<ArrowUpRight size={18} aria-hidden="true" /></button>
    <dialog ref={dialog} id={id} className={styles.dialog} aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} onClick={event => { if (event.target === event.currentTarget) event.currentTarget.close(); }}>
      <button type="button" className={styles.closeButton} aria-label="Fechar convite da comunidade" onClick={() => dialog.current?.close()}><X size={20} aria-hidden="true" /></button>
      <MessageCircle className={styles.dialogIcon} size={32} strokeWidth={1.3} aria-hidden="true" /><p className={styles.eyebrow}>Comunidade Apogee · gratuita</p><h2 id={`${id}-title`}>A conversa começa<br />no WhatsApp.</h2>
      <p id={`${id}-description`}>O grupo está sendo preparado. O convite será disponibilizado aqui quando a entrada estiver aberta.</p>
      <p className={styles.dialogNote}>Nesta prévia, você pode conhecer o percurso da gravação do evento. Nenhum grupo ou cadastro real é aberto.</p>
      <Link className={styles.primary} href="/gravacao#inscricao" prefetch={false} onClick={() => dialog.current?.close()}>Conhecer a gravação <ArrowUpRight size={18} aria-hidden="true" /></Link>
    </dialog>
  </>;
}

export function FunnelFaq({ id, title, items }: { id: string; title: string; items: readonly { question: string; answer: string }[] }) {
  return <section className={[styles.section, styles.faqSection].join(" ")} id={id} aria-labelledby={`${id}-title`}><div><p className={styles.eyebrow}>Perguntas frequentes</p><h2 id={`${id}-title`}>{title}</h2></div><div className={styles.faqList}>{items.map(item => <details key={item.question}><summary>{item.question}<Plus size={18} aria-hidden="true" /></summary><p>{item.answer}</p></details>)}</div></section>;
}

export function FunnelFooter() {
  const legal = useSiteLegalLinks();
  return <footer className={styles.footer}>
    <Link className={styles.brand} href="/" prefetch={false} aria-label="Apogee — página inicial"><Image src="/brand/apogee-star.svg" alt="" width={24} height={30} /><span>Apogee<small>Conhecimento e oportunidades</small></span></Link>
    <nav aria-label="Navegação do rodapé"><Link href="/comunidade" prefetch={false}>Comunidade</Link><Link href="/gravacao" prefetch={false}>Gravação do evento</Link><Link href="/oportunidades" prefetch={false}>Radar</Link><Link href="/blog" prefetch={false}>Blog</Link>{legal.privacy && <Link href="/privacidade">Privacidade</Link>}{legal.terms && <Link href="/termos">Termos de uso</Link>}</nav>
    <p>Prévia local para revisão. Inscrições e convites ainda não estão ativos.</p>
  </footer>;
}
