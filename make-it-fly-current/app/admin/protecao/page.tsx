import {notFound} from "next/navigation";
import {requireAdmin} from "@/lib/members/dal";
import {protectionReviewQueue,supervisedRegistrationEnabled} from "@/lib/members/protection";
import {reviewProtectionAction} from "./actions";
import styles from "@/app/membros/protecao/protection.module.css";
export const dynamic='force-dynamic';
export const metadata={title:'Cadastros protegidos'};
const states:Record<string,string>={pending:'Em conferência',approved:'Aprovado',rejected:'Não aprovado',revoked:'Autorização revogada'};
const bands:Record<string,string>={under_12:'Menor de 12 anos','12_15':'De 12 a 15 anos','16_17':'De 16 a 17 anos'};
function ReviewForm({kind,id}:{kind:string;id:string}) {
  return <form action={reviewProtectionAction}><input type="hidden" name="kind" value={kind}/><input type="hidden" name="subjectId" value={id}/>
    <label>Referência interna da conferência<input name="reference" required minLength={8} maxLength={160} autoComplete="off"/></label>
    <p>Registre apenas a referência do atendimento, sem números de documentos, imagens ou outros dados pessoais.</p>
    <label><input name="checks" type="checkbox" required/> Conferi identidade e maioridade por procedimento apropriado. Para dependentes, conferi também faixa etária, responsabilidade legal e autorização. E-mail confirmado e autodeclaração, isoladamente, não são suficientes.</label>
    <label>Decisão<select name="decision" required defaultValue=""><option value="" disabled>Selecione</option><option value="aprovar">Aprovar</option><option value="rejeitar">Não aprovar</option></select></label><button>Registrar decisão</button></form>;
}
export default async function ProtectionAdminPage({searchParams}:{searchParams:Promise<{resultado?:string}>}) {
  if(!supervisedRegistrationEnabled())notFound();
  await requireAdmin('/admin/protecao');const queue=await protectionReviewQueue();const query=await searchParams;
  return <div className={styles.page}><h1>Cadastros protegidos</h1><p>Esta fila registra a decisão humana após conferência. O sistema não autentica documentos nem comprova idade ou filiação automaticamente. Use o procedimento de atendimento validado pela organização antes de aprovar.</p>
    {query.resultado && <p role="status">{query.resultado==='ok'?'Decisão registrada.':'Não foi possível registrar. Confira a autorização, a referência e o estado da solicitação.'}</p>}
    <section><h2>Contas adultas</h2>{!queue.adults.length?<p>Nenhuma solicitação.</p>:queue.adults.map(row=><article key={String(row.user_id)}><h3>{String(row.name)}</h3><p>{String(row.email)} · {states[String(row.status)]}</p><ReviewForm kind="adult" id={String(row.user_id)}/></article>)}</section>
    <section><h2>Vínculos de menores</h2>{!queue.dependents.length?<p>Nenhuma solicitação.</p>:queue.dependents.map(row=><article key={String(row.id)}><h3>{String(row.nickname)}</h3><p>Responsável: {String(row.guardian_email)} · {bands[String(row.age_band)]} · {row.relationship==='parent'?'Pai ou mãe':'Responsável legal'} · {states[String(row.status)]}</p>{row.status!=='revoked' && <ReviewForm kind="dependent" id={String(row.id)}/>}</article>)}</section>
  </div>;
}
