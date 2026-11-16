"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./subscription.module.css";

/** Refreshes server-owned membership state. The checkout URL never grants access. */
export function AnnualPaymentConfirmation() {
  const router = useRouter();
  const [waitingLonger, setWaitingLonger] = useState(false);

  useEffect(() => {
    const refresh = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 3000);
    const timeout = window.setTimeout(() => {
      window.clearInterval(refresh);
      setWaitingLonger(true);
    }, 60000);
    return () => {
      window.clearInterval(refresh);
      window.clearTimeout(timeout);
    };
  }, [router]);

  return <div className={styles.annualConfirmation}>
    <div role="status" aria-live="polite">
      <strong>{waitingLonger ? "A confirmação está levando um pouco mais de tempo." : "Estamos aguardando a confirmação do pagamento."}</strong>
      <p>{waitingLonger
        ? "Seu acesso será liberado automaticamente quando o pagamento for confirmado. Você pode voltar depois ou consultar o suporte. Não é necessário pagar novamente."
        : "Esta página se atualiza automaticamente. Assim que o pagamento for confirmado, você poderá abrir seus recursos por aqui."}</p>
    </div>
    {waitingLonger ? <button type="button" className={styles.annualSecondary} onClick={() => router.refresh()}>Verificar confirmação</button> : null}
  </div>;
}
