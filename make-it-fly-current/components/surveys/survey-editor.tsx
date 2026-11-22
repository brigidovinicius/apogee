"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { saveSurveyAction } from "@/app/admin/pesquisas/actions";
import { surveyStatuses, surveyStatusLabels, type Survey, type SurveyDefinition, type SurveyQuestion } from "@/lib/surveys/contract";
import styles from "./surveys.module.css";

type EditableQuestion = { id: string; label: string; required: boolean; kind: SurveyQuestion["kind"]; optionsText: string };

export function SurveyEditor({ initial, existing }: { initial: SurveyDefinition; existing?: Pick<Survey, "id" | "revision"> }) {
  const router = useRouter();
  const [version, setVersion] = useState(existing);
  const [questions, setQuestions] = useState<EditableQuestion[]>(initial.questions.map(item => ({
    ...item, optionsText: item.kind === "choice" ? item.options.join("\n") : "",
  })));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  function update(id: string, data: Partial<EditableQuestion>) {
    setQuestions(items => items.map(item => item.id === id ? { ...item, ...data } : item));
  }

  function move(index: number, offset: number) {
    setQuestions(items => {
      const next = [...items];
      const [question] = next.splice(index, 1);
      next.splice(index + offset, 0, question);
      return next;
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const fields = new FormData(event.currentTarget);
    const text = (key: string) => String(fields.get(key) ?? "");
    const retention = text("retentionDays");
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await saveSurveyAction({
        title: text("title"), slug: text("slug"), intro: text("intro"), purpose: text("purpose"),
        retentionDays: retention ? Number(retention) : null, status: text("status"),
        collaboration: fields.has("collaboration"), radar: fields.has("radar"),
        questions: questions.map(({ id, kind, label, required, optionsText }) => ({
          id, label, required, kind, ...(kind === "choice" ? { options: optionsText.split(/\r?\n/).map(text => text.trim()).filter(Boolean) } : {}),
        })),
      }, version);
      if ("error" in result) { setError(result.error); return; }
      setVersion({ id: result.id, revision: result.revision });
      setNotice("Pesquisa salva.");
      if (!version) router.replace(`/admin/pesquisas/${result.id}`);
      else router.refresh();
    } catch {
      setError("Não foi possível salvar. Confira a conexão e tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return <form method="post" onSubmit={submit} className={styles.panel} aria-busy={busy}>
    <fieldset className={styles.outer} disabled={busy}>
      <label className={styles.field}>Título <input name="title" defaultValue={initial.title} required maxLength={140} /></label>
      <label className={styles.field}>Endereço da pesquisa
        <input name="slug" defaultValue={initial.slug} required maxLength={80} pattern="[a-z0-9]+(-[a-z0-9]+)*" />
      </label>
      <label className={styles.field}>Apresentação <textarea name="intro" defaultValue={initial.intro} maxLength={1000} rows={2} /></label>
      <label className={styles.field}>Finalidade
        <span>Complete «A Apogee usará suas respostas para…»</span>
        <textarea name="purpose" defaultValue={initial.purpose} required maxLength={300} rows={2} />
      </label>
      <div className={styles.row}>
        <label className={styles.field}>Retenção em dias
          <input name="retentionDays" type="number" min={1} max={730} defaultValue={initial.retentionDays ?? ""} />
        </label>
        <label className={styles.field}>Estado
          <select name="status" defaultValue={initial.status}>{surveyStatuses.map(status => <option value={status} key={status}>{surveyStatusLabels[status]}</option>)}</select>
        </label>
      </div>
      <div className={styles.choices}>
        <label><input type="checkbox" name="collaboration" defaultChecked={initial.collaboration} /> Incluir convite para colaborar</label>
        <label><input type="checkbox" name="radar" defaultChecked={initial.radar} /> Perguntar sobre a medição opcional do Radar</label>
      </div>
      <h2>Perguntas</h2>
      {questions.map((item, index) => <fieldset className={styles.question} key={item.id}>
        <legend>Pergunta {index + 1}</legend>
        <label className={styles.field}>Enunciado
          <input required maxLength={220} value={item.label} onChange={event => update(item.id, { label: event.target.value })} />
        </label>
        <label className={styles.field}>Tipo
          <select value={item.kind} onChange={event => update(item.id, { kind: event.target.value as EditableQuestion["kind"] })}>
            <option value="text">Resposta aberta</option>
            <option value="score">Nota de 0 a 10</option>
            <option value="choice">Escolha única</option>
          </select>
        </label>
        {item.kind === "choice" && <label className={styles.field}>Opções, uma por linha
          <textarea rows={3} required value={item.optionsText} onChange={event => update(item.id, { optionsText: event.target.value })} />
        </label>}
        <label><input type="checkbox" checked={item.required} onChange={event => update(item.id, { required: event.target.checked })} /> Obrigatória</label>
        <div className={styles.actions}>
          <button type="button" data-ap-button="secondary" aria-label={`Subir pergunta ${index + 1}`} disabled={!index} onClick={() => move(index, -1)}>Subir</button>
          <button type="button" data-ap-button="secondary" aria-label={`Descer pergunta ${index + 1}`} disabled={index === questions.length - 1} onClick={() => move(index, 1)}>Descer</button>
          <button type="button" data-ap-button="secondary" aria-label={`Remover pergunta ${index + 1}`} disabled={questions.length < 2} onClick={() => setQuestions(items => items.filter(q => q.id !== item.id))}>Remover</button>
        </div>
      </fieldset>)}
      {error && <p role="alert" className={styles.error}>{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <div className={styles.actions}>
        <button type="button" data-ap-button="secondary" disabled={questions.length >= 12} onClick={() => setQuestions(items => [
          ...items, { id: crypto.randomUUID(), label: "", kind: "text", required: false, optionsText: "" },
        ])}>Adicionar pergunta</button>
        <button type="submit" data-ap-button="primary">{busy ? "Salvando…" : "Salvar pesquisa"}</button>
      </div>
    </fieldset>
  </form>;
}
