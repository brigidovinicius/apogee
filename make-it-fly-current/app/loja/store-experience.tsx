"use client";

import Image from "next/image";
import { ArrowUp, ArrowUpRight, Plus, X } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { SiteHeader } from "@/components/site/site-header";
import { products, type StoreProduct } from "@/lib/store/products";
import { DROP_CONSENT_TEXT } from "@/lib/store/drop-consent";
import styles from "./loja.module.css";

function ProductGallery({ product }: { product: StoreProduct }) {
  const [active, setActive] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const photo = product.photos[active];
  return (
    <article className={styles.product} aria-labelledby={`title-${product.slug}`}>
      <button className={styles.mainPhoto} type="button" onClick={() => dialog.current?.showModal()} aria-label={`Ampliar foto de ${product.name}`} aria-haspopup="dialog">
        <Image src={photo.src} alt={photo.alt} width={photo.width} height={photo.height} sizes="(max-width: 700px) 100vw, 50vw" preload={active === 0} />
        <span className={styles.enlarge} aria-hidden="true">Ampliar <Plus size={14} aria-hidden="true" /></span>
      </button>
      <div className={styles.thumbnails} role="group" aria-label={`Fotos de ${product.name}`}>
        {product.photos.map((item, index) => (
          <button type="button" key={item.src} onClick={() => setActive(index)} aria-pressed={index === active} aria-label={item.alt}>
            <Image src={item.src} alt="" width={80} height={80} sizes="64px" />
          </button>
        ))}
        <span>{active + 1} / {product.photos.length}</span>
      </div>
      <div className={styles.productHeading}><h2 id={`title-${product.slug}`}>{product.name}</h2><span>{product.detail}</span></div>
      <p>{product.description}</p>
      <a className={styles.productLink} href="#novos-drops">Receber novidades dos drops <ArrowUpRight size={18} aria-hidden="true" /></a>
      <dialog ref={dialog} className={styles.photoDialog} aria-label={`Foto ampliada de ${product.name}`} onClick={(event) => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
        <button className={styles.closePhoto} type="button" autoFocus onClick={() => dialog.current?.close()}>Fechar <X size={18} aria-hidden="true" /></button>
        <Image src={photo.src} alt={photo.alt} width={photo.width} height={photo.height} sizes="90vw" />
      </dialog>
    </article>
  );
}

function DropSignup() {
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const submitting = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    submitting.current = true;
    setStatus("sending");
    setMessage("");
    try {
      const response = await fetch("/api/loja/novidades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: data.get("name"), phone: data.get("phone"), email: data.get("email"), consent: data.get("consent") === "on", website: data.get("website") }),
        signal: AbortSignal.timeout(15_000),
      });
      const result = await response.json();
      if (!response.ok || result.ok !== true) throw new Error(result.message || "Não foi possível cadastrar agora. Tente novamente.");
      setStatus("success");
      setMessage("Cadastro recebido! Você está na lista para receber novidades dos próximos drops.");
      form.reset();
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error && error.name === "Error" ? error.message : "Não foi possível confirmar seu cadastro. Tente novamente.");
    } finally {
      submitting.current = false;
    }
  }

  return (
    <section id="novos-drops" className={styles.signup} aria-labelledby="signup-title">
      <div className={styles.signupCopy}><span>Novos drops</span><h2 id="signup-title">O próximo drop<br />começa por aqui.</h2><p>Deixe seu contato para receber novidades dos produtos e dos próximos lançamentos da Apogee.</p></div>
      <form className={styles.form} onSubmit={submit} aria-busy={status === "sending"}>
        <div className={styles.fields}>
          <label htmlFor="drop-name">Nome<input id="drop-name" name="name" autoComplete="name" required minLength={2} maxLength={120} placeholder="Seu nome" /></label>
          <label htmlFor="drop-phone">Telefone<input id="drop-phone" name="phone" type="tel" autoComplete="tel" required maxLength={32} placeholder="(11) 99999-9999" /></label>
          <label htmlFor="drop-email">E-mail<input id="drop-email" name="email" type="email" autoComplete="email" required maxLength={254} placeholder="voce@exemplo.com" /></label>
        </div>
        <div className={styles.honeypot} aria-hidden="true"><label>Site<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
        <label className={styles.consent}><input name="consent" type="checkbox" required /><span>{DROP_CONSENT_TEXT}</span></label>
        <button className={styles.submit} type="submit" disabled={status === "sending"}>{status === "sending" ? "Cadastrando…" : "Quero receber novidades"}</button>
        <p className={styles.feedback} role={status === "error" ? "alert" : "status"} data-state={status}>{message}</p>
      </form>
    </section>
  );
}

export function StoreExperience() {
  return (
    <div className={styles.page}>
      <SiteHeader current="store" tone="light" />
      <main id="experiencia">
        <section className={styles.intro} aria-labelledby="store-title">
          <div><p>Apogee Builders Club</p><h1 id="store-title">Vista o que<br />você cria.</h1></div>
          <div className={styles.introCopy}><p>Building the future. Made to create.</p><p>Conheça as peças da Apogee e acompanhe os próximos drops.</p><a href="#novos-drops">Receber novidades <ArrowUpRight size={18} aria-hidden="true" /></a></div>
        </section>
        <section className={styles.collection} aria-label="Produtos Apogee" id="produtos">
          {products.map(product => <ProductGallery key={product.slug} product={product} />)}
        </section>
        <DropSignup />
      </main>
      <footer className={styles.footer}><Link href="/" aria-label="Apogee - início"><Image src="/brand/apogee-logo-navy.svg" alt="Apogee" width={112} height={69} /></Link><p>Building the future.</p><a href="#produtos">Voltar aos produtos <ArrowUp size={16} aria-hidden="true" /></a></footer>
    </div>
  );
}
