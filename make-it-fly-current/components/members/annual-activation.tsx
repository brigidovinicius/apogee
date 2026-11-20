"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import styles from "./members.module.css";

export function AnnualActivation({ verified }: { verified: boolean }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const started = useRef(false);
  useEffect(() => {
    const restore = (event: PageTransitionEvent) => { if (event.persisted) { setPending(false); setMessage(""); } };
    window.addEventListener("pageshow", restore);
    return () => window.removeEventListener("pageshow", restore);
  }, []);
  async function activate() {
    setPending(true); setMessage("Vinculando sua assinatura…");
    try {
      const response = await fetch("/api/comunidade/assinatura/ativar", { method: "POST" });
      const result = await response.json();
      if (response.ok && typeof result.url === "string" && result.url.startsWith("/membros/assinatura?")) window.location.assign(result.url);
      else { setMessage(result.message ?? "Não foi possível ativar sua assinatura agora."); setPending(false); }
    } catch { setMessage("Não foi possível confirmar sua assinatura. Tente novamente."); setPending(false); }
  }
  useEffect(() => { if (verified && !started.current) { started.current = true; void activate(); } }, [verified]);
  async function verify() {
    setPending(true);
    try {
      const response = await fetch("/api/members/verification", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ next: "/membros/ativar-assinatura" }) });
      setMessage(response.ok ? "Confira seu e-mail. O link de confirmação traz você de volta para ativar a assinatura." : "Não foi possível enviar a confirmação. Aguarde e tente novamente.");
    } catch { setMessage("Não foi possível enviar a confirmação agora."); }
    finally { setPending(false); }
  }
  return <>
    <p>{verified ? "Vamos localizar sua compra pelo e-mail confirmado desta conta." : "Confirme o mesmo e-mail usado no checkout para vincular sua compra."}</p>
    <p role="status" aria-live="polite">{message}</p>
    <button className={styles.primary} disabled={pending} onClick={verified ? activate : verify}>{pending ? "Aguarde…" : verified ? "Tentar ativar novamente" : "Confirmar meu e-mail"}</button>
    <p><Link href="/membros/assinatura">Ver minha assinatura</Link></p>
    <p><Link href="/membros/suporte">Preciso de ajuda com a compra</Link></p>
  </>;
}
