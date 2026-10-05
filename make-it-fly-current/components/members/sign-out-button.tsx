"use client";

import { useState } from "react";
import { useHexclaveApp } from "@hexclave/next";
import styles from "./members.module.css";

export function SignOutButton() {
  const app = useHexclaveApp();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function signOut() {
    setPending(true);
    setError(undefined);
    try {
      await app.signOut({ redirectUrl: "/login" });
    } catch {
      setError("Não foi possível encerrar a sessão. Tente novamente.");
      setPending(false);
    }
  }

  return (
    <span>
      <button className={styles.linkButton} type="button" disabled={pending} onClick={signOut}>
        {pending ? "Saindo…" : "Sair"}
      </button>
      {error ? <span className={styles.formMessage} role="alert">{error}</span> : null}
    </span>
  );
}
