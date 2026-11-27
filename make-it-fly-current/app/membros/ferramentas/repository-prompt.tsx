"use client";

import { useId, useRef, useState } from "react";
import { Check, Copy, Sparkles, X } from "lucide-react";
import styles from "./toolbox.module.css";

export function RepositoryPrompt({ name, prompt }: { name: string; prompt: string }) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const [feedback, setFeedback] = useState<"idle" | "copied" | "selected">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(prompt);
      setFeedback("copied");
    } catch {
      field.current?.focus();
      field.current?.select();
      setFeedback("selected");
    }
  }

  return <>
    <button data-ap-button="primary" type="button" className={styles.useAi} aria-haspopup="dialog"
      onClick={() => { setFeedback("idle"); dialog.current?.showModal(); }}>
      <Sparkles size={16} aria-hidden="true" />
      Usar na minha IA<span className="sr-only"> com {name}</span>
    </button>
    <dialog ref={dialog} className={styles.promptDialog} aria-labelledby={id} aria-describedby={`${id}-help`}>
      <div className={styles.promptHead}>
        <h3 id={id}>Experimente {name} com sua IA</h3>
        <form method="dialog">
          <button type="submit" data-ap-button="secondary" aria-label="Fechar">
            <X size={18} aria-hidden="true" />
          </button>
        </form>
      </div>
      <p id={`${id}-help`}>Copie o prompt e cole na IA que você já usa. Ela vai te guiar a partir do link oficial.</p>
      <label className={styles.promptLabel}>
        Prompt para copiar
        <textarea ref={field} value={prompt} readOnly rows={9} />
      </label>
      <div className={styles.promptActions}>
        <button type="button" data-ap-button="primary" onClick={copy}>
          {feedback === "copied" ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
          {feedback === "copied" ? "Copiado" : "Copiar prompt"}
        </button>
        <span role="status">{feedback === "copied" ? "Cole no ChatGPT, no Claude ou na IA que você preferir."
          : feedback === "selected" ? "Texto selecionado. Use a opção Copiar do seu dispositivo." : ""}</span>
      </div>
    </dialog>
  </>;
}
