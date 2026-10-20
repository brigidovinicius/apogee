"use client";

import { Check, Share } from "lucide-react";
import { useId, useRef, useState } from "react";
import styles from "./share-button.module.css";

// Callers provide a canonical public path, never the current URL (which may contain credentials).
type ShareButtonProps = { title: string; path: string };

export function ShareButton({ title, path }: ShareButtonProps) {
  const [status, setStatus] = useState("");
  const [copied, setCopied] = useState(false);
  const [manual, setManual] = useState(false);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const feedbackId = useId();
  const url = new URL(path, "https://www.apogee.community").href;

  async function share() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setStatus("");
    setCopied(false);
    setManual(false);
    try {
      if (navigator.share) {
        try {
          await navigator.share({ title, url });
          // Closing the system sheet doesn't prove delivery to another person.
          return;
        } catch (error) {
          if (error instanceof Error && error.name === "AbortError") return;
        }
      }
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setStatus("Link copiado. Cole onde quiser compartilhar.");
      } catch {
        setManual(true);
        setStatus("Selecione e copie o link abaixo para compartilhar.");
      }
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return <div className={styles.share}>
    <button type="button" className={styles.button} onClick={share} disabled={busy} aria-describedby={feedbackId}>
      {copied ? <Check size={18} aria-hidden="true" /> : <Share size={18} aria-hidden="true" />}
      {busy ? "Abrindo…" : copied ? "Link copiado" : "Compartilhar"}
    </button>
    <p className={styles.feedback} id={feedbackId} role="status" aria-atomic="true">{status || "Compartilha o link público desta página."}</p>
    {manual ? <label className={styles.manual}>Link público
      <input type="url" readOnly value={url} onFocus={(event) => event.currentTarget.select()} />
    </label> : null}
  </div>;
}
