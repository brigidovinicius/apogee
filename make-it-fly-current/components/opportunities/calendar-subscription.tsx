"use client";
import { useActionState } from "react";
import { createFeed } from "@/app/membros/meu-calendario/actions";
import styles from "./calendar.module.css";
export function CalendarSubscription() {
  const [state,action,pending]=useActionState(createFeed,{url:"",error:""});
  return <section><h2>Receber na sua agenda</h2><p>Assine o link no Google Agenda, Apple Calendar ou Outlook. A frequência de atualização depende do aplicativo.</p>
    <form action={action}><button className={styles.action} disabled={pending}>{pending?"Criando…":"Gerar novo link privado"}</button></form>
    <p>Um novo link desativa o anterior. Guarde o link e compartilhe apenas com seu aplicativo de agenda.</p>
    {state.url && <label>Link privado<input style={{display:"block",width:"100%"}} readOnly value={typeof window==="undefined"?state.url:new URL(state.url,window.location.origin).toString()} onFocus={e=>e.target.select()}/></label>}
    {state.error && <p role="alert">{state.error}</p>}
  </section>;
}
