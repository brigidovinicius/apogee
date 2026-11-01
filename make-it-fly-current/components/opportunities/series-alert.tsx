'use client';
import { useState } from 'react';
import styles from './opportunities.module.css';
export function SeriesAlert({id,name,available}:{id:string;name:string;available:boolean}) {
  const [message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  if(!available)return <p>Avisos por e-mail em preparação.</p>;
  return <details className={styles.alertForm}><summary>Avisar sobre próximas edições</summary>
    <p>Receba um aviso quando uma nova edição com inscrições abertas for validada no Radar, inclusive se a edição atual já terminou.</p>
    <form onSubmit={async event=>{event.preventDefault();const form=event.currentTarget,data=new FormData(form);setBusy(true);setMessage('');
      try {
        const response=await fetch('/api/radar/alerts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'subscribeSeries',targetId:id,email:data.get('email'),consent:data.get('consent')==='on'})});
        const result=await response.json();
        setMessage(response.ok?'Confira seu e-mail e confirme o acompanhamento.':result.error??'Não foi possível cadastrar.');
        if(response.ok)form.reset();
      }catch{setMessage('Não foi possível cadastrar. Tente novamente.');}finally{setBusy(false);}
    }}>
      <label>E-mail para acompanhar {name}<input type="email" name="email" maxLength={254} autoComplete="email" required disabled={busy}/></label>
      <label className={styles.alertConsent}><input type="checkbox" name="consent" required disabled={busy}/>Quero receber avisos de novas edições desta competição até cancelar pelo link em cada e-mail.</label>
      <small>Este acompanhamento é separado dos avisos de mudanças de uma edição. Após cancelar, os dados são removidos em até 30 dias.</small>
      <button type="submit" disabled={busy}>{busy?'Cadastrando…':'Acompanhar próximas edições'}</button>
      {message&&<p role="status">{message}</p>}
    </form>
  </details>;
}
