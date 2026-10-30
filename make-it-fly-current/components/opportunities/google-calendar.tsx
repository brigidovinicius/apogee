"use client";
import { useFormStatus } from "react-dom";
import { connectGoogleCalendarAction,disconnectGoogleCalendarAction,syncGoogleCalendarAction } from "@/app/membros/meu-calendario/google-actions";
import styles from "./calendar.module.css";
const errors: Record<string,string> = {
  reconnect:"A conexão expirou. Conecte sua conta Google novamente.",
  permission:"O Google não autorizou o acesso ao calendário. Reconecte e revise a permissão.",
  quota:"O Google limitou as atualizações por enquanto. Tentaremos novamente.",
  unavailable:"Não foi possível atualizar agora. Seus eventos anteriores foram preservados.",
  invalid_response:"Não foi possível confirmar a resposta do Google. Tente novamente.",
  access:"A sincronização exige acesso ativo ao Radar.",
};
function Submit({children}: {children:React.ReactNode}) {
  const { pending } = useFormStatus();
  return <button className={styles.action} disabled={pending}>{pending?"Aguarde…":children}</button>;
}
export function GoogleCalendar({status,result}: {
  status:{configured:boolean;connected:boolean;lastSync:string|null;error:string|null};
  result?:string;
}) {
  const message = status.error ? errors[status.error] : result === "synced" ? "Calendário atualizado." :
    result === "pending" ? "Atualização em andamento. As próximas etapas serão sincronizadas em breve." :
    result === "denied" ? "A autorização foi cancelada. Você pode tentar novamente." :
    result === "failed" ? "Não foi possível concluir a conexão ou atualização. Tente novamente." : null;
  return <section className={styles.subscription} aria-labelledby="google-calendar-heading">
    <h2 id="google-calendar-heading">Google Agenda</h2>
    <p>Receba as etapas das oportunidades salvas em um calendário separado do Apogee. Novas datas e cancelamentos são atualizados automaticamente enquanto a conexão estiver ativa.</p>
    <p><a href="/privacidade#google-agenda">Como seus dados são usados na conexão Google</a></p>
    {!status.configured ? <><p>A conexão com o Google Agenda ainda precisa ser configurada neste ambiente.</p><button className={styles.action} disabled>Conectar Google Agenda</button></> : <>
      <p>O Apogee solicita acesso somente aos calendários que ele cria.</p>
      {message && <p role="status">{message}</p>}
      {status.connected ? <>
        <p>Conta conectada.{status.lastSync && <> Última atualização: <time dateTime={status.lastSync}>{new Date(status.lastSync).toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo"})} (Brasília).</time></>}</p>
        <form action={syncGoogleCalendarAction}><Submit>Sincronizar agora</Submit></form>
        {status.error === "permission" && <form action={connectGoogleCalendarAction}><Submit>Revisar autorização Google</Submit></form>}
        <form action={disconnectGoogleCalendarAction}><Submit>Desconectar Google Agenda</Submit></form>
        <p>Ao desconectar, as atualizações param. O calendário já criado permanece no Google e pode ser removido por você.</p>
      </> : <form action={connectGoogleCalendarAction}><Submit>{status.error === "reconnect"?"Reconectar Google Agenda":"Conectar Google Agenda"}</Submit></form>}
    </>}
  </section>;
}
