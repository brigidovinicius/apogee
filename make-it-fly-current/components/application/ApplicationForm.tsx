"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import Link from "next/link";
import { flushJourneyEvents, getJourneyId, trackJourney } from "@/components/analytics/journey-client";
import { readAttribution, validateStep, type ApplicationValues, type FieldErrors } from "./application-client";
import styles from "./application.module.css";

const steps = ["Seu perfil", "Sua ideia", "Seu dia a dia"];
const initialValues: ApplicationValues = {
  name: "", email: "", phone: "", age: "", profession: "", hasIdea: null,
  ideaDescription: "", hasLaptop: null, usesPaidAI: null, website: "",
};
const subscribeToHydration = () => () => {};

function Choice({ name, value, onChange, error }: {
  name: "hasIdea" | "hasLaptop" | "usesPaidAI";
  value: boolean | null;
  onChange: (value: boolean) => void;
  error?: string;
}) {
  return <div className={styles.choices}>{[true, false].map(option => (
    <label key={String(option)} className={`${styles.choice} ${value === option ? styles.choiceSelected : ""}`}>
      <input type="radio" name={name} value={String(option)} checked={value === option} onChange={() => onChange(option)} required aria-describedby={error ? `${name}-error` : undefined} />
      <span>{option ? "Sim" : "Não"}</span>
    </label>
  ))}</div>;
}

export function ApplicationForm() {
  const hydrated = useSyncExternalStore(subscribeToHydration, () => true, () => false);
  const [step, setStep] = useState(0);
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [errorMessage, setErrorMessage] = useState("");
  const [errorAttempt, setErrorAttempt] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);
  const started = useRef(false);
  const requestRef = useRef<{ signature: string; key: string } | null>(null);
  const inFlight = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (firstRender.current) firstRender.current = false;
    else headingRef.current?.focus();
  }, [step, submitted]);
  useEffect(() => { if (errorAttempt) errorRef.current?.focus(); }, [errorAttempt]);
  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(() => { trackJourney("form_view", "application_form", 1); }, []);

  function change<K extends keyof ApplicationValues>(field: K, value: ApplicationValues[K]) {
    if (!started.current && field !== "website") {
      started.current = true;
      trackJourney("form_started", "first_interaction", step + 1);
    }
    setValues(current => ({ ...current, [field]: value, ...(field === "hasIdea" && value === false ? { ideaDescription: "" } : {}) }));
    setErrors(current => ({ ...current, [field]: undefined }));
  }

  function showErrors(nextErrors: FieldErrors, message = "Confira os campos abaixo para continuar.") {
    setErrors(nextErrors);
    setErrorMessage(message);
    setErrorAttempt(current => current + 1);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || submitted) return;
    const validation = validateStep(values, step);
    if (Object.keys(validation).length) {
      trackJourney("form_validation_error", Object.keys(validation).sort().join(","), step + 1);
      showErrors(validation);
      return;
    }
    setErrors({});
    setErrorMessage("");
    if (step < 2) {
      trackJourney("form_step_completed", step === 0 ? "profile" : "idea", step + 1);
      setStep(step + 1);
      return;
    }
    for (let previous = 0; previous < 2; previous++) {
      const previousErrors = validateStep(values, previous);
      if (Object.keys(previousErrors).length) {
        trackJourney("form_validation_error", Object.keys(previousErrors).sort().join(","), previous + 1);
        setStep(previous);
        showErrors(previousErrors);
        return;
      }
    }

    trackJourney("form_step_completed", "structure_and_ai", 3);
    trackJourney("form_submit_started", "application", 3);
    void flushJourneyEvents();
    inFlight.current = true;
    setSubmitting(true);
    const controller = new AbortController();
    abortRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 20000);
    try {
      const payload = {
        name: values.name.trim(), email: values.email.trim(), phone: values.phone.trim(),
        age: Number(values.age), profession: values.profession.trim(),
        hasIdea: values.hasIdea, ideaDescription: values.hasIdea ? values.ideaDescription.trim() : "",
        hasLaptop: values.hasLaptop, usesPaidAI: values.usesPaidAI, journeyId: getJourneyId(), website: values.website, ...readAttribution(),
      };
      const signature = JSON.stringify(payload);
      // A retry reuses its key, including after an uncertain network timeout.
      if (requestRef.current?.signature !== signature) requestRef.current = { signature, key: crypto.randomUUID() };
      const response = await fetch("/api/applications", {
        method: "POST", headers: { "Content-Type": "application/json", "Accept": "application/json" },
        credentials: "same-origin", cache: "no-store", signal: controller.signal,
        body: JSON.stringify({ ...payload, idempotencyKey: requestRef.current.key }),
      });
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        if (response.status === 400 && result && typeof result === "object" && "fieldErrors" in result && result.fieldErrors && typeof result.fieldErrors === "object") {
          const fields: FieldErrors = {};
          for (const field of Object.keys(initialValues) as (keyof ApplicationValues)[]) {
            const value = (result.fieldErrors as Record<string, unknown>)[field];
            if (typeof value === "string") fields[field] = value.slice(0, 250);
          }
          if (fields.name || fields.email || fields.phone || fields.age || fields.profession) setStep(0);
          else if (fields.hasIdea || fields.ideaDescription) setStep(1);
          showErrors(fields, "Confira suas respostas e tente enviar novamente.");
        } else showErrors({}, response.status === 429
          ? "Recebemos muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente. Suas respostas continuam aqui."
          : "Não conseguimos confirmar o envio agora. Suas respostas continuam aqui. Tente novamente em instantes.");
        trackJourney("form_submit_failed", `http_${response.status}`, 3);
        return;
      }
      if (!result || typeof result !== "object" || !("received" in result) || result.received !== true) throw new Error("Invalid response");
      trackJourney("form_submit_succeeded", "application", 3);
      setSubmitted(true);
    } catch {
      trackJourney("form_submit_failed", "network_or_invalid_response", 3);
      showErrors({}, "Não conseguimos confirmar o envio. Confira sua conexão e tente novamente. Suas respostas continuam aqui.");
    } finally {
      window.clearTimeout(timeout);
      abortRef.current = null;
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  function fieldError(field: keyof ApplicationValues) {
    return errors[field] ? <p className={styles.fieldError} id={`${field}-error`}>{errors[field]}</p> : null;
  }

  if (submitted) return (
    <section className={`${styles.panel} ${styles.result}`} aria-labelledby="result-title">
      <span className={styles.resultSymbol} aria-hidden="true">✦</span>
      <p className={styles.panelEyebrow}>Aplicação recebida</p>
      <h2 ref={headingRef} tabIndex={-1} id="result-title">Recebemos sua aplicação.</h2>
      <div role="status" aria-live="polite">
        <p>Vamos revisar seu perfil e suas respostas com atenção.</p>
        <p className={styles.resultNote}>Se sua participação for aprovada, enviaremos o link do ingresso pelo contato informado. O envio desta aplicação ainda não garante uma vaga.</p>
      </div>
      <Link href="/" className={styles.secondary}>Voltar ao evento <span aria-hidden="true">↗</span></Link>
      <p className={styles.resultSignature}>Give your ideas wings.</p>
    </section>
  );

  return (
    <section className={styles.panel} aria-labelledby="form-title">
      <ol className={styles.steps} aria-label="Etapas da aplicação">
        {steps.map((label, index) => <li key={label} aria-current={step === index ? "step" : undefined} data-complete={step > index}><span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>{label}<span className={styles.srOnly}>{step > index ? ", concluída" : ""}</span></li>)}
      </ol>
      <form onSubmit={submit} method="post" action="/api/applications" noValidate aria-busy={submitting}>
        <fieldset disabled={submitting || !hydrated} className={styles.formBody}>
          <div className={styles.formHeading}>
            <p className={styles.panelEyebrow}>Etapa {step + 1} de 3</p>
            <h2 id="form-title" ref={headingRef} tabIndex={-1}>{step === 0 ? "Vamos nos conhecer." : step === 1 ? "O que você quer colocar no mundo?" : "Sua estrutura e rotina."}</h2>
            <p>{step === 0 ? "Conte um pouco sobre você e como podemos manter contato." : step === 1 ? "Não precisa estar pronta. Toda ideia tem um começo." : "Duas últimas informações antes de enviar sua aplicação."}</p>
          </div>
          {errorMessage && <div ref={errorRef} role="alert" tabIndex={-1} className={styles.errorSummary}>{errorMessage}</div>}
          {step === 0 && <div className={styles.fields}>
            <div className={styles.field}><label htmlFor="name">Seu nome <span>(obrigatório)</span></label><input id="name" name="name" autoComplete="name" maxLength={120} required value={values.name} onChange={e => change("name", e.target.value)} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? "name-error" : undefined} />{fieldError("name")}</div>
            <div className={styles.field}><label htmlFor="email">Seu e-mail <span>(obrigatório)</span></label><input id="email" name="email" type="email" autoComplete="email" inputMode="email" maxLength={254} required value={values.email} onChange={e => change("email", e.target.value)} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "email-error" : undefined} />{fieldError("email")}</div>
            <div className={styles.field}><label htmlFor="phone">WhatsApp ou telefone <span>(obrigatório)</span></label><input id="phone" name="phone" type="tel" autoComplete="tel" inputMode="tel" maxLength={32} required value={values.phone} onChange={e => change("phone", e.target.value)} aria-invalid={Boolean(errors.phone)} aria-describedby={`phone-hint${errors.phone ? " phone-error" : ""}`} /><p id="phone-hint" className={styles.hint}>Inclua o DDD. Para outro país, inclua também o código do país.</p>{fieldError("phone")}</div>
            <div className={styles.field}><label htmlFor="age">Sua idade <span>(obrigatório)</span></label><input id="age" name="age" type="number" inputMode="numeric" min={1} max={120} step={1} required value={values.age} onChange={e => change("age", e.target.value)} aria-invalid={Boolean(errors.age)} aria-describedby={`age-hint${errors.age ? " age-error" : ""}`} /><p id="age-hint" className={styles.hint}>Informe sua idade em anos completos.</p>{fieldError("age")}</div>
            <div className={styles.field}><label htmlFor="profession">Profissão ou área de atuação <span>(obrigatório)</span></label><input id="profession" name="profession" autoComplete="organization-title" maxLength={160} required value={values.profession} onChange={e => change("profession", e.target.value)} aria-invalid={Boolean(errors.profession)} aria-describedby={`profession-hint${errors.profession ? " profession-error" : ""}`} /><p id="profession-hint" className={styles.hint}>Se você estuda ou está em transição, conte também o curso ou a área de interesse.</p>{fieldError("profession")}</div>
          </div>}
          {step === 1 && <div className={styles.fields}>
            <fieldset className={styles.question}><legend>Você tem uma ideia ou projeto que gostaria de tirar do papel? <span>(obrigatório)</span></legend><Choice name="hasIdea" value={values.hasIdea} onChange={v => change("hasIdea", v)} error={errors.hasIdea} />{fieldError("hasIdea")}</fieldset>
            {values.hasIdea === true && <div className={styles.field}><label htmlFor="ideaDescription">Conta pra gente, em poucas palavras, qual é essa ideia. <span>(opcional)</span></label><textarea id="ideaDescription" name="ideaDescription" rows={4} maxLength={2000} value={values.ideaDescription} onChange={e => change("ideaDescription", e.target.value)} aria-describedby={`idea-hint${errors.ideaDescription ? " ideaDescription-error" : ""}`} aria-invalid={Boolean(errors.ideaDescription)} /><p id="idea-hint" className={styles.hint}>Essa descrição não define sua participação. Até 2.000 caracteres.</p>{fieldError("ideaDescription")}</div>}
          </div>}
          {step === 2 && <div className={styles.fields}><fieldset className={styles.question}><legend>Você tem notebook ou computador portátil que possa levar no dia do evento? <span>(obrigatório)</span></legend><Choice name="hasLaptop" value={values.hasLaptop} onChange={v => change("hasLaptop", v)} error={errors.hasLaptop} />{fieldError("hasLaptop")}</fieldset><fieldset className={styles.question}><legend>Você assina alguma ferramenta de IA e utiliza IA no seu dia a dia? <span>(obrigatório)</span></legend><Choice name="usesPaidAI" value={values.usesPaidAI} onChange={v => change("usesPaidAI", v)} error={errors.usesPaidAI} />{fieldError("usesPaidAI")}</fieldset><div className={styles.nextStepNote}><span aria-hidden="true">✦</span><p>Depois do envio, nossa equipe analisa sua aplicação. Se aprovada, você receberá o link do ingresso pelo contato informado.</p></div></div>}
          <div className={styles.honeypot} aria-hidden="true"><label htmlFor="website">Deixe este campo em branco</label><input id="website" name="website" tabIndex={-1} autoComplete="off" value={values.website} onChange={e => change("website", e.target.value)} /></div>
          <div className={styles.actions}>
            {step > 0 && <button type="button" className={styles.backButton} onClick={() => { setStep(step - 1); setErrors({}); setErrorMessage(""); }}><span aria-hidden="true">←</span> Voltar</button>}
            <button type="submit" className={styles.primary}>{submitting ? "Enviando sua aplicação…" : step === 2 ? "Enviar aplicação" : "Continuar"}<span aria-hidden="true">{submitting ? "…" : "↗"}</span></button>
          </div>
        </fieldset>
        <p className={styles.privacy}>Seus dados serão usados pela Apogee para avaliar sua participação, organizar esta edição e manter contato sobre próximas experiências. Nesta sessão, também registramos as etapas percorridas e eventuais erros técnicos, sem copiar o conteúdo das suas respostas para esses eventos. Não exibimos suas respostas publicamente. O envio não reserva uma vaga.</p>
      </form>
      <noscript><p className={styles.errorSummary}>Ative o JavaScript no navegador para preencher e enviar sua aplicação.</p></noscript>
    </section>
  );
}
