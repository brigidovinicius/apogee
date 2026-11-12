"use client";

import Link from "next/link";
import { ArrowUpRight, Check, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { CommunityJoinButton } from "./community-funnel";
import styles from "./community-sales-page.module.css";

type Errors = { name?: string; email?: string };
const subscribeToHydration = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

/** Preview only: intentionally no action, request, storage or real registration. */
export function RecordingCaptureForm() {
  const hydrated = useSyncExternalStore(subscribeToHydration, clientSnapshot, serverSnapshot);
  const [errors, setErrors] = useState<Errors>({});
  const [submitted, setSubmitted] = useState(false);
  const confirmation = useRef<HTMLDivElement>(null);

  useEffect(() => { if (submitted) confirmation.current?.focus(); }, [submitted]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const name = form.elements.namedItem("name") as HTMLInputElement;
    const email = form.elements.namedItem("email") as HTMLInputElement;
    const next: Errors = {};
    if (!name.value.trim()) next.name = "Digite seu nome para continuar.";
    if (!email.value.trim() || email.validity.typeMismatch) next.email = "Digite um e-mail válido, como nome@exemplo.com.";
    setErrors(next);
    if (next.name || next.email) { (next.name ? name : email).focus(); return; }
    form.reset();
    setSubmitted(true);
  }

  if (submitted) return <div ref={confirmation} tabIndex={-1} className={styles.captureConfirmation} role="status" aria-labelledby="capture-confirmation-title">
    <span className={styles.confirmationIcon}><Check size={24} aria-hidden="true" /></span><p className={styles.eyebrow}>Demonstração do próximo passo</p><h2 id="capture-confirmation-title">A conversa continua<br />com a Apogee.</h2>
    <p>Na versão publicada, você receberá um aviso por e-mail quando a gravação estiver disponível.</p><p className={styles.previewNote}>Esta foi apenas uma demonstração local. Nenhum cadastro foi salvo e nenhum e-mail foi enviado.</p>
    <CommunityJoinButton label="Conhecer o grupo gratuito" />
    <Link className={styles.subtleLink} href="/comunidade" prefetch={false}>Explorar a comunidade <ArrowUpRight size={16} aria-hidden="true" /></Link>
    <button className={styles.resetButton} type="button" onClick={() => { setSubmitted(false); setErrors({}); }}><RotateCcw size={15} aria-hidden="true" /> Testar formulário novamente</button>
  </div>;

  return <form className={styles.captureForm} noValidate onSubmit={submit} autoComplete="off" aria-labelledby="capture-form-title" aria-describedby="capture-preview-note" data-preview-capture>
    <p className={styles.eyebrow}>Gravação gratuita</p><h2 id="capture-form-title">Receba o aviso<br />quando estiver pronta.</h2><p className={styles.formLead}>Deixe seu e-mail para acompanhar a liberação da gravação do encontro.</p>
    <fieldset className={styles.captureFields} disabled={!hydrated}>
    <div className={styles.field}><label htmlFor="recording-name">Nome</label><input id="recording-name" name="name" type="text" maxLength={100} required aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? "recording-name-error" : undefined} placeholder="Como você quer ser chamado?" />{errors.name && <p className={styles.fieldError} id="recording-name-error">{errors.name}</p>}</div>
    <div className={styles.field}><label htmlFor="recording-email">E-mail</label><input id="recording-email" name="email" type="email" inputMode="email" maxLength={254} required aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "recording-email-error" : undefined} placeholder="nome@exemplo.com" />{errors.email && <p className={styles.fieldError} id="recording-email-error">{errors.email}</p>}</div>
    <div className={styles.field}><label htmlFor="recording-goal">O que você quer fazer com IA? <span>Opcional</span></label><textarea id="recording-goal" name="goal" rows={2} maxLength={600} placeholder="Uma tarefa do trabalho ou da sua rotina…" /></div>
    <button className={styles.primary} type="submit">Receber aviso da gravação <ArrowUpRight size={18} aria-hidden="true" /></button>
    </fieldset>
    <p className={styles.formPurpose}>Seu e-mail será usado para avisar sobre a gravação. Entrar no WhatsApp será uma escolha sua.</p>
    <p id="capture-preview-note" className={styles.previewNote}>Demonstração local: nenhum dado será enviado ou salvo.</p>
    <noscript><p>Ative o JavaScript para testar o formulário demonstrativo.</p></noscript>
  </form>;
}
