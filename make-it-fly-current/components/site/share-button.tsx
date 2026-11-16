"use client";

import { Check, Copy } from "lucide-react";
import { useId, useRef, useState } from "react";
import styles from "./share-button.module.css";

// Callers provide a canonical public path, never the current URL (which may contain credentials).
type ShareButtonProps = { title: string; path: string; compact?: boolean };

export function ShareButton({ title, path, compact = false }: ShareButtonProps) {
  const [status, setStatus] = useState("");
  const [copied, setCopied] = useState(false);
  const [manual, setManual] = useState(false);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const feedbackId = useId();
  const url = new URL(path, "https://www.apogee.community").href;

  async function copyLink() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setStatus("");
    setCopied(false);
    setManual(false);
    try {
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setStatus("Link copiado.");
      } catch {
        setManual(true);
        setStatus("Selecione e copie o link.");
      }
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return <div className={`${styles.share}${compact ? ` ${styles.compact}` : ""}`}>
    <button type="button" className={styles.button} onClick={copyLink} disabled={busy} aria-label={`Copiar link de ${title}`} aria-describedby={feedbackId}>
      {copied ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}
      {busy ? "Copiando…" : copied ? "Link copiado" : "Copiar link"}
    </button>
    <p className={styles.feedback} id={feedbackId} role="status" aria-atomic="true">{status}</p>
    {manual ? <label className={styles.manual}>Link público
      <input type="url" readOnly value={url} onFocus={(event) => event.currentTarget.select()} />
    </label> : null}
  </div>;
}
