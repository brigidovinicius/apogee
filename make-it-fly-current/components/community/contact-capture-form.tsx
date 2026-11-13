"use client";

import Link from "next/link";
import { ArrowUpRight, Check } from "lucide-react";
import { useEffect, useId, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { COMMUNITY_CONTACT_CONSENT, type ContactCampaign } from "@/lib/community/consent";
import styles from "./community-sales-page.module.css";

type Errors = { name?: string; email?: string; consent?: string };
const subscribeToHydration = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

export function ContactCaptureForm() {
  const campaign: ContactCampaign = "codex";
  const hydrated = useSyncExternalStore(subscribeToHydration, clientSnapshot, serverSnapshot);
  const id = useId();
  const [errors, setErrors] = useState<Errors>({});
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState("");
  const confirmation = useRef<HTMLDivElement>(null);

  useEffect(() => { if (submitted) confirmation.current?.focus(); }, [submitted]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const name = form.elements.namedItem("name") as HTMLInputElement;
    const email = form.elements.namedItem("email") as HTMLInputElement;
    const consent = form.elements.namedItem("consent") as HTMLInputElement;
    const next: Errors = {};
    if (name.value.trim().length < 2) next.name = "Digite seu nome para continuar.";
    if (!email.value.trim() || email.validity.typeMismatch) next.email = "Digite um e-mail válido, como nome@exemplo.com.";
    if (!consent.checked) next.consent = "Autorize o aviso por e-mail para continuar.";
    setErrors(next);
    setFailure("");
    if (next.name || next.email || next.consent) { (next.name ? name : next.email ? email : consent).focus(); return; }
    const data = new FormData(form);
    setPending(true);
    try {
      const response = await fetch("/api/comunidade/contatos", {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "omit", referrerPolicy: "no-referrer",
        body: JSON.stringify({ campaign, name: data.get("name"), email: data.get("email"), goal: data.get("goal") ?? "", consent: true, website: data.get("website") ?? "" }),
        signal: AbortSignal.timeout(15_000),
      });
      const result = await response.json();
      if (!response.ok || result.ok !== true) throw new Error(typeof result.message === "string" ? result.message : "Não foi possível salvar seu pedido agora.");
      form.reset();
      setSubmitted(true);
    } catch (error) {
      setFailure(error instanceof Error && error.name === "Error" ? error.message : "Não foi possível confirmar seu cadastro. Tente novamente.");
    } finally { setPending(false); }
  }

  if (submitted) return <div ref={confirmation} tabIndex={-1} className={styles.captureConfirmation} role="status" aria-labelledby={`${id}-confirmation`}>
    <span className={styles.confirmationIcon}><Check size={24} aria-hidden="true" /></span><p className={styles.eyebrow}>Inscrição registrada</p>
    <h2 id={`${id}-confirmation`}>Você deu o primeiro passo.</h2>
    <p>Seu contato foi registrado. As orientações de acesso ao evento serão enviadas para o e-mail informado.</p>
    <p className={styles.formPurpose}>Este cadastro não cria uma conta nem inscreve você em outros comunicados.</p>
    <Link className={styles.subtleLink} href="/comunidade" prefetch={false}>Conhecer a comunidade gratuita<ArrowUpRight size={16} aria-hidden="true" /></Link>
  </div>;

  return <form className={styles.captureForm} noValidate onSubmit={submit} aria-labelledby={`${id}-title`} aria-busy={pending}>
    <p className={styles.eyebrow}>Codex Community · acesso gratuito</p>
    <h2 id={`${id}-title`}>Inscreva-se gratuitamente.</h2>
    <p className={styles.formLead}>Cadastre-se para receber por e-mail as orientações de acesso ao evento e descobrir aplicações de IA para o trabalho e a rotina.</p>
    <fieldset className={styles.captureFields} disabled={!hydrated || pending}>
      <div className={styles.field}><label htmlFor={`${id}-name`}>Nome</label><input id={`${id}-name`} name="name" type="text" autoComplete="given-name" maxLength={100} required aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? `${id}-name-error` : undefined} placeholder="Como você quer ser chamado?" />{errors.name && <p className={styles.fieldError} id={`${id}-name-error`}>{errors.name}</p>}</div>
      <div className={styles.field}><label htmlFor={`${id}-email`}>E-mail</label><input id={`${id}-email`} name="email" type="email" autoComplete="email" inputMode="email" maxLength={254} required aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? `${id}-email-error` : undefined} placeholder="nome@exemplo.com" />{errors.email && <p className={styles.fieldError} id={`${id}-email-error`}>{errors.email}</p>}</div>
      <div className={styles.field}><label htmlFor={`${id}-goal`}>O que você quer fazer com IA? <span>Opcional</span></label><textarea id={`${id}-goal`} name="goal" rows={2} maxLength={600} placeholder="Uma tarefa do trabalho ou da sua rotina…" /></div>
      <div className={styles.honeypot} aria-hidden="true"><label htmlFor={`${id}-website`}>Website</label><input id={`${id}-website`} name="website" type="text" autoComplete="off" tabIndex={-1} /></div>
      <label className={styles.consent} htmlFor={`${id}-consent`}><input id={`${id}-consent`} name="consent" type="checkbox" required aria-invalid={Boolean(errors.consent)} aria-describedby={errors.consent ? `${id}-consent-error` : undefined} /><span>{COMMUNITY_CONTACT_CONSENT[campaign]}</span></label>
      {errors.consent && <p className={styles.fieldError} id={`${id}-consent-error`}>{errors.consent}</p>}
      <button className={styles.primary} type="submit">{pending ? "Salvando pedido…" : "Quero assistir gratuitamente"}<ArrowUpRight size={18} aria-hidden="true" /></button>
    </fieldset>
    {failure && <p className={styles.fieldError} role="alert">{failure}</p>}
    <p className={styles.formPurpose}>Usaremos seu contato apenas para o aviso solicitado. Você pode pedir a exclusão pelo canal da <Link href="/privacidade">Política de Privacidade</Link>.</p>
    <noscript><p>Ative o JavaScript para enviar seu pedido.</p></noscript>
  </form>;
}
