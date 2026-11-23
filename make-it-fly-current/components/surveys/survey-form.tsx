"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type FormEvent } from "react";
import { collaborationLabels, collaborationNotice, radarNotice, researchNotice, visibleSurveyQuestions, type Survey, type SurveyQuestion } from "@/lib/surveys/contract";
import styles from "./surveys.module.css";

const subscribe = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

type DraftAnswer = { value: string; none?: boolean };

function Question({ item, answer, onAnswer }: {
  item: SurveyQuestion;
  answer?: DraftAnswer;
  onAnswer: (answer: DraftAnswer) => void;
}) {
  const id = `question-${item.id}`;
  const hintId = item.hint ? `${id}-hint` : undefined;
  const hint = item.hint && <p id={hintId} className={styles.questionHint}>{item.hint}</p>;
  const label = item.required ? item.label : `${item.label} (opcional)`;
  if (item.kind === "text") {
    const value = answer?.value ?? "";
    const none = answer?.none ?? false;
    return <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      {hint}
      <textarea id={id} name={id} rows={3} maxLength={1000} required={item.required && !none}
        aria-describedby={hintId} disabled={none} value={value} onChange={event => onAnswer({ value: event.target.value })} />
      {item.noneOption && <div className={styles.choices}>
        <label><input type="checkbox" checked={none} onChange={event => onAnswer({ value, none: event.target.checked })} /> {item.noneOption}</label>
      </div>}
    </div>;
  }
  const options = item.kind === "score" ? Array.from({ length: 11 }, (_, value) => String(value)) : item.options;
  return <fieldset className={styles.question} aria-describedby={hintId}>
    <legend>{label}</legend>
    {hint}
    <div className={item.kind === "score" ? styles.scale : styles.choices}>
      {options.map((option, index) => <label key={option}>
        <input type="radio" name={id} value={option} required={index === 0 && item.required}
          checked={answer?.value === option} onChange={() => onAnswer({ value: option })} /> {option}
      </label>)}
      {!item.required && <label><input type="radio" name={id} value="" checked={answer?.value === ""} onChange={() => onAnswer({ value: "" })} /> Sem resposta</label>}
    </div>
  </fieldset>;
}

function SurveyProgress({ answered, total, complete = false }: { answered: number; total: number; complete?: boolean }) {
  const percentage = complete ? 100 : Math.round(answered / total * 100);
  const count = total === 1 ? `${answered} de 1 pergunta respondida` : `${answered} de ${total} perguntas respondidas`;
  const label = complete ? "Pesquisa concluída" : count;

  return <div className={styles.progress} data-ap-card="">
    <div className={styles.progressHeader}>
      <span>Seu progresso</span>
      <span className={styles.progressPercent} aria-hidden="true">{percentage}%</span>
    </div>
    <div role="progressbar" aria-label="Progresso da pesquisa" aria-valuenow={percentage} aria-valuetext={label} className={styles.route} style={{ "--survey-progress": `${percentage}%` } as CSSProperties}>
      <div className={styles.routeTrack} />
      <div className={styles.routeFill} />
      <div className={styles.rocket}>
        <Image src="/brand/rocket-progress.webp" alt="" width={72} height={72} unoptimized />
      </div>
    </div>
    <p className={styles.progressCount}>{label}</p>
  </div>;
}

export function SurveyForm({ survey, preview = false }: { survey: Survey; preview?: boolean }) {
  const hydrated = useSyncExternalStore(subscribe, clientReady, serverReady);
  const [research, setResearch] = useState<"allow" | "deny" | null>(null);
  const [draft, setDraft] = useState<ReadonlyMap<string, DraftAnswer>>(() => new Map());
  const [collaboration, setCollaboration] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [complete, setComplete] = useState(false);
  const receipt = useRef<HTMLDivElement>(null);
  const request = useRef<{ id: string; payload: string } | null>(null);

  useEffect(() => { if (complete) receipt.current?.focus(); }, [complete]);

  const questions = visibleSurveyQuestions(survey.questions, id => draft.get(id)?.none === true);
  const answered = questions.filter(item => {
    const answer = draft.get(item.id);
    return answer?.none || answer?.value.trim();
  }).length;

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
    const answers: Record<string, string | number | null> = {};
    if (allowed) for (const question of questions) {
      const value = String(form.get(`question-${question.id}`) ?? "").trim();
      if (draft.get(question.id)?.none) answers[question.id] = null;
      else if (value) answers[question.id] = question.kind === "score" ? Number(value) : value;
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

  const showProgress = research !== "deny" && questions.length > 0;
  if (complete) return <div className={styles.receipt} data-ap-card="" tabIndex={-1} ref={receipt} role="status">
    {showProgress && <SurveyProgress answered={answered} total={questions.length} complete />}
    <h2 data-ap-title="">Obrigado pelo seu tempo.</h2>
    <p>{preview ? "Prévia concluída. Nenhuma resposta foi gravada." : "Você concluiu a pesquisa."}</p>
  </div>;

  return <form className={styles.form} data-has-progress={showProgress} data-preview={preview} method="post" onSubmit={submit} aria-busy={busy}>
    {showProgress && <div className={styles.progressPosition}>
      <SurveyProgress answered={answered} total={questions.length} />
    </div>}
    <fieldset className={styles.formFields} disabled={!hydrated || busy}>
      <div className={styles.formCard} data-ap-card="">
        <fieldset className={styles.question}>
          <legend>Você autoriza o uso das suas respostas para esta pesquisa?</legend>
          <p>{researchNotice(survey)} <Link href="/privacidade" prefetch={false}>Política de Privacidade</Link></p>
          <div className={styles.choices}>
            <label><input type="radio" name="research" value="allow" required onChange={() => setResearch("allow")} /> Sim, autorizo.</label>
            <label><input type="radio" name="research" value="deny" onChange={() => { setResearch("deny"); setCollaboration(""); setDraft(new Map()); }} /> Não autorizo.</label>
          </div>
        </fieldset>
      </div>
      {research === "allow" && <div className={styles.formCard} data-ap-card="">
        {questions.map(item => <Question item={item} key={item.id} answer={draft.get(item.id)}
          onAnswer={answer => setDraft(current => new Map(current).set(item.id, answer))} />)}
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
      </div>}
      {research && survey.radar && <div className={styles.formCard} data-ap-card="">
        <fieldset className={styles.question}>
          <legend>Você autoriza a medição opcional do seu uso futuro do Radar?</legend>
          <p>{radarNotice} <Link href="/privacidade#radar-amplitude" prefetch={false}>Saiba mais sobre a medição</Link></p>
          <div className={styles.choices}>
            <label><input type="radio" name="radar" value="allow" /> Sim, após confirmar nas preferências da minha conta.</label>
            <label><input type="radio" name="radar" value="deny" /> Não autorizo.</label>
            <label><input type="radio" name="radar" value="" /> Prefiro decidir depois.</label>
          </div>
        </fieldset>
      </div>}
      {message && <p role="alert" className={styles.error}>{message}</p>}
      <button type="submit" data-ap-button="primary">{busy ? "Enviando…" : preview ? "Testar envio" : research === "deny" ? "Concluir" : "Enviar respostas"}</button>
    </fieldset>
  </form>;
}
