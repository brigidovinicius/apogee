"use client";

import { useRef, useState } from "react";
import { Download } from "lucide-react";
import { adminStyles } from "@/components/admin/admin-ui";
import styles from "./drops.module.css";

export function DropExportButton({ search, disabled }: { search: string; disabled: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);

  async function download() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/loja/drops/exportar?${new URLSearchParams({ busca: search })}`, {
        cache: "no-store", signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.message || "Não foi possível exportar. Tente novamente.");
      }
      if (!response.headers.get("content-type")?.startsWith("text/csv")) throw new Error("Não foi possível exportar. Entre novamente e tente outra vez.");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = "cadastros-drops-apogee.csv";
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) {
      setError(cause instanceof Error && cause.name === "Error" ? cause.message : "Não foi possível exportar. Tente novamente.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return <div className={styles.export}>
    <button className={adminStyles.secondaryButton} type="button" onClick={download} disabled={disabled || busy} aria-busy={busy}>
      <Download size={18} aria-hidden="true" />{busy ? "Preparando planilha…" : "Exportar para planilha"}
    </button>
    <p>{search ? "CSV com todos os resultados da busca." : "CSV com todos os cadastros."}</p>
    {error ? <p role="alert">{error}</p> : null}
  </div>;
}
