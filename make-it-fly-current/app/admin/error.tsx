"use client";

import Link from "next/link";
import { useEffect } from "react";
import { adminStyles as styles } from "@/components/admin/admin-ui";

export default function AdminError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("[admin] falha ao renderizar rota", error.digest ?? "sem digest");
  }, [error]);

  return (
    <section className={styles.errorState} role="alert">
      <div className={styles.stateCard}>
        <p className={styles.eyebrow}>Falha de carregamento</p>
        <h1>Não foi possível abrir esta tela administrativa.</h1>
        <p>Tente novamente. Nenhuma ação administrativa foi confirmada por esta tentativa.</p>
        <div className={styles.stateActions}>
          <button className={styles.button} type="button" onClick={retry}>Tentar novamente</button>
          <Link className={styles.secondaryButton} href="/membros">Voltar para membros</Link>
        </div>
      </div>
    </section>
  );
}
