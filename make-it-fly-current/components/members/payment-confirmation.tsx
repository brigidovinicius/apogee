"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Atualiza só a apresentação. O servidor decide o direito pelo webhook/banco.
export function PaymentConfirmation() {
  const router = useRouter();
  const [waiting, setWaiting] = useState(true);
  useEffect(() => {
    let attempts = 0;
    const timer = setInterval(() => {
      router.refresh();
      if (++attempts >= 30) { clearInterval(timer); setWaiting(false); }
    }, 2000);
    return () => clearInterval(timer);
  }, [router]);
  return <p role="status">{waiting
    ? "Aguardando a confirmação do pagamento. Seu acesso será liberado automaticamente quando ela chegar. Não é necessário pagar novamente."
    : "A confirmação ainda não chegou. Você pode verificar seu acesso novamente mais tarde. Não pague novamente."}</p>;
}
