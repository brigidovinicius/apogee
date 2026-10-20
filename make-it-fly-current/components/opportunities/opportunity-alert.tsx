"use client";
import { interfaceText } from "@/lib/presentation-text.mjs";
import { useState } from "react";
import styles from "./opportunities.module.css";
export function OpportunityAlert({id,title,available}:{id:string;title:string;available:boolean}) {
  const [message,setMessage]=useState(""); const [busy,setBusy]=useState(false);
  if (!available) return <p className={styles.alertHint}>Avisos por e-mail em preparação.</p>;
  return <details className={styles.alertForm}><summary>Avisar-me sobre mudanças</summary>
    <p>Receba novidades desta oportunidade, como prazo definido, mudança nas inscrições ou cancelamento.</p>
    <form onSubmit={async(event)=>{ event.preventDefault();const form=event.currentTarget;const data=new FormData(form);setBusy(true);setMessage("");
      try { const response=await fetch("/api/radar/alerts",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"subscribe",opportunityId:id.replace(/^radar-/,""),email:data.get("email"),consent:data.get("consent")==="on"})});
        const result=await response.json();setMessage(response.ok?"Confira seu e-mail e confirme o acompanhamento. O envio pode levar alguns minutos.":result.error ?? "Não foi possível cadastrar. Tente novamente.");if(response.ok)form.reset();
      } catch {setMessage("Não foi possível cadastrar. Tente novamente.");} finally{setBusy(false);} }}>
      <label>E-mail para acompanhar {interfaceText(title)}<input name="email" type="email" autoComplete="email" maxLength={254} required disabled={busy}/></label>
      <label className={styles.alertConsent}><input name="consent" type="checkbox" required disabled={busy}/>Quero receber avisos desta oportunidade. Posso cancelar pelo link em cada e-mail.</label>
      <small>Seu e-mail será usado somente para este acompanhamento. Cadastros não confirmados expiram; os dados são removidos em até 30 dias após o fim ou cancelamento.</small>
      <button type="submit" disabled={busy}>{busy?"Cadastrando…":"Receber avisos"}</button>
      {message?<p role="status">{message}</p>:null}
    </form>
  </details>;
}
