"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type FormEvent } from "react";
import { collaborationLabels, collaborationNotice, radarNotice, researchNotice, type Survey, type SurveyQuestion } from "@/lib/surveys/contract";
import styles from "./surveys.module.css";

const subscribe = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

function Question({ item, onAnswer }: { item: SurveyQuestion; onAnswer: (id: string, value: string) => void }) {
  const id = `question-${item.id}`;
  const label = item.required ? item.label : `${item.label} (opcional)`;
  if (item.kind === "text") return <label className={styles.field} htmlFor={id}>
    {label}
    <textarea id={id} name={id} rows={3} maxLength={1000} required={item.required} onChange={event => onAnswer(item.id, event.target.value)} />
  </label>;
  const options = item.kind === "score" ? Array.from({ length: 11 }, (_, value) => String(value)) : item.options;
  return <fieldset className={styles.question}>
    <legend>{label}</legend>
    <div className={item.kind === "score" ? styles.scale : styles.choices}>
      {options.map((option, index) => <label key={option}>
        <input type="radio" name={id} value={option} required={index === 0 && item.required} onChange={() => onAnswer(item.id, option)} /> {option}
      </label>)}
      {!item.required && <label><input type="radio" name={id} value="" onChange={() => onAnswer(item.id, "")} /> Sem resposta</label>}
    </div>
  </fieldset>;
}

function SurveyProgress({ answered, total, complete = false }: { answered: number; total: number; complete?: boolean }) {
  const percentage = complete ? 100 : Math.round(answered / total * 100);
  const count = total === 1 ? `${answered} de 1 pergunta respondida` : `${answered} de ${total} perguntas respondidas`;
  const label = complete ? "Pesquisa concluída" : count;

  return <div className={styles.progress}>
    <div className={styles.progressHeader}>
      <span>Seu progresso</span>
      <span className={styles.progressPercent} aria-hidden="true">{percentage}%</span>
    </div>
    <div role="progressbar" aria-label="Progresso da pesquisa" aria-valuenow={percentage} aria-valuetext={label} className={styles.route} style={{ "--survey-progress": `${percentage}%` } as CSSProperties}>
      <div className={styles.routeTrack} />
      <div className={styles.routeFill} />
      <div className={styles.rocket}>
        <Image src="/brand/rocket-progress.webp" alt="" width={64} height={64} unoptimized />
      </div>
    </div>
    <p className={styles.progressCount}>{label}</p>
  </div>;
}

export function SurveyForm({ survey, preview = false }: { survey: Survey; preview?: boolean }) {
  const hydrated = useSyncExternalStore(subscribe, clientReady, serverReady);
  const [research, setResearch] = useState<"allow" | "deny" | null>(null);
  const [answered, setAnswered] = useState<ReadonlySet<string>>(() => new Set());
  const [collaboration, setCollaboration] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [complete, setComplete] = useState(false);
  const receipt = useRef<HTMLDivElement>(null);
  const request = useRef<{ id: string; payload: string } | null>(null);

  useEffect(() => { if (complete) receipt.current?.focus(); }, [complete]);

  function recordAnswer(id: string, value: string) {
    const hasAnswer = value.trim().length > 0;
    setAnswered(current => {
      if (current.has(id) === hasAnswer) return current;
      const next = new Set(current);
      if (hasAnswer) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !research) return;
    const form = new FormData(event.currentTarget);
    const allowed = research === "allow";
    const radar = form.get("radar") || null;
    if (preview || !allowed && !radar) {
      setComplete(true);
      return;
    }
    const answers: Record<string, string | number> = {};
    if (allowed) for (const question of survey.questions) {
      const value = String(form.get(`question-${question.id}`) ?? "").trim();
      if (value) answers[question.id] = question.kind === "score" ? Number(value) : value;
    }
    const email = allowed && collaboration ? String(form.get("email") ?? "").trim() : null;
    const values = { revision: survey.revision, research: allowed, answers, collaboration: allowed && collaboration || null, email, radar };
    const payload = JSON.stringify(values);
    if (request.current?.payload !== payload) request.current = { payload, id: crypto.randomUUID() };
    setMessage("");
    setBusy(true);
    try {
      const result = await fetch(`/api/pesquisas/${survey.slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: request.current.id, ...values }),
        credentials: "omit",
        referrerPolicy: "no-referrer",
        signal: AbortSignal.timeout(15_000),
      });
      if (result.ok) setComplete(true);
      else if (result.status === 409) setMessage("A pesquisa foi atualizada. Recarregue a página para responder à nova versão.");
      else if (result.status === 404) setMessage("Esta pesquisa foi encerrada.");
      else if (result.status === 429) setMessage("Aguarde alguns minutos antes de tentar novamente.");
      else if (result.status === 400) setMessage("Confira as respostas antes de enviar.");
      else setMessage("Não foi possível enviar agora. Tente novamente.");
    } catch {
      setMessage("Não foi possível enviar agora. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  const showProgress = research !== "deny" && survey.questions.length > 0;
  if (complete) return <div className={styles.receipt} data-ap-card="" tabIndex={-1} ref={receipt} role="status">
    {showProgress && <SurveyProgress answered={answered.size} total={survey.questions.length} complete />}
    <h2>Obrigado pelo seu tempo.</h2>
    <p>{preview ? "Prévia concluída. Nenhuma resposta foi gravada." : "Você concluiu a pesquisa."}</p>
  </div>;

  return <form className={styles.form} data-has-progress={showProgress} data-preview={preview} method="post" onSubmit={submit} aria-busy={busy}>
    {showProgress && <div className={styles.progressPosition}>
      <SurveyProgress answered={answered.size} total={survey.questions.length} />
    </div>}
    <fieldset className={styles.formFields} data-ap-card="" disabled={!hydrated || busy}>
      <fieldset className={styles.question}>
        <legend>Você autoriza o uso das suas respostas para esta pesquisa?</legend>
        <p>{researchNotice(survey)} <Link href="/privacidade">Política de Privacidade</Link></p>
        <div className={styles.choices}>
          <label><input type="radio" name="research" value="allow" required onChange={() => setResearch("allow")} /> Sim, autorizo.</label>
          <label><input type="radio" name="research" value="deny" onChange={() => { setResearch("deny"); setCollaboration(""); setAnswered(new Set()); }} /> Não autorizo.</label>
        </div>
      </fieldset>
      {research === "allow" && <>
        {survey.questions.map(item => <Question item={item} key={item.id} onAnswer={recordAnswer} />)}
        {survey.collaboration && <fieldset className={styles.question}>
          <legend>Você gostaria de receber um convite para colaborar? (opcional)</legend>
          <p>{collaborationNotice}</p>
          <label className={styles.field}>Como gostaria de ajudar?
            <select name="collaboration" value={collaboration} onChange={event => setCollaboration(event.target.value)}>
              <option value="">Prefiro só responder à pesquisa</option>
              {Object.entries(collaborationLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
            </select>
          </label>
          {collaboration && <label className={styles.field}>Qual e-mail podemos usar para esse convite?
            <input type="email" name="email" autoComplete="email" maxLength={254} required />
          </label>}
        </fieldset>}
      </>}
      {research && survey.radar && <fieldset className={styles.question}>
        <legend>Você autoriza a medição opcional do seu uso futuro do Radar?</legend>
        <p>{radarNotice} <Link href="/privacidade#radar-amplitude">Saiba mais sobre a medição</Link></p>
        <div className={styles.choices}>
          <label><input type="radio" name="radar" value="allow" /> Sim, após confirmar nas preferências da minha conta.</label>
          <label><input type="radio" name="radar" value="deny" /> Não autorizo.</label>
          <label><input type="radio" name="radar" value="" /> Prefiro decidir depois.</label>
        </div>
      </fieldset>}
      {message && <p role="alert" className={styles.error}>{message}</p>}
      <button type="submit" data-ap-button="primary">{busy ? "Enviando…" : preview ? "Testar envio" : research === "deny" ? "Concluir" : "Enviar respostas"}</button>
    </fieldset>
  </form>;
}
