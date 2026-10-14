"use client";
import { useState } from "react";
export function AlertTokenForm({token,action}:{token:string;action:"confirm"|"unsubscribe"}) {
  const [message,setMessage]=useState("");const [busy,setBusy]=useState(false);const [done,setDone]=useState(false);
  return <form onSubmit={async(event)=>{event.preventDefault();setBusy(true);
    try {const response=await fetch("/api/radar/alerts",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,token})});const result=await response.json();setMessage(response.ok?action==="confirm"?"Acompanhamento confirmado. Você receberá avisos quando houver mudanças.":"Acompanhamento cancelado.":result.error ?? "Não foi possível concluir.");setDone(response.ok);}catch{setMessage("Não foi possível concluir. Tente novamente.");}finally{setBusy(false);}}}>
    <button disabled={busy||done}>{action==="confirm"?"Confirmar acompanhamento":"Cancelar acompanhamento"}</button>
    {message?<p role="status">{message}</p>:null}
  </form>;
}
