import Link from "next/link";
import {notFound,redirect} from "next/navigation";
import {getCurrentMember} from "@/lib/members/dal";
import {adultAccess,protectionOverview,supervisedRegistrationEnabled} from "@/lib/members/protection";
import {MemberBar} from "@/components/members/member-bar";
import {requestAdultAction,requestDependentAction,revokeDependentAction,sendProtectionVerificationAction} from "./actions";
import styles from "./protection.module.css";
export const dynamic='force-dynamic';
export const metadata={title:'Cadastro protegido',robots:{index:false,follow:false}};
const statuses:Record<string,string>={pending:'Em conferência',approved:'Aprovado',rejected:'Não aprovado',revoked:'Autorização revogada'};
const ages:Record<string,string>={under_12:'Menor de 12 anos','12_15':'De 12 a 15 anos','16_17':'De 16 a 17 anos'};
export default async function ProtectionPage({searchParams}:{searchParams:Promise<{resultado?:string}>}) {
  if(!supervisedRegistrationEnabled())notFound();
  const member=await getCurrentMember();if(!member)redirect('/membros/entrar?next=%2Fmembros%2Fprotecao');
  const overview=await protectionOverview(member.id);const approved=await adultAccess(member.id);const query=await searchParams;
  return <div className={styles.page}><MemberBar member={member}/><h1>Cadastro protegido</h1>
    <p>A conta de acesso pertence a um adulto. Menores de 18 anos, inclusive menores de 16, participam por vínculo privado com o responsável. O menor não recebe login próprio, perfil público ou acesso ao fórum.</p>
    <p><Link href="/privacidade#menores">Privacidade de crianças e adolescentes</Link></p>
    {query.resultado && <p role="status">{query.resultado==='ok'?'Solicitação registrada.':'Não foi possível concluir. Confira os dados e a confirmação de e-mail ou procure a equipe.'}</p>}
    {!overview.emailVerified && <section><h2>Confirme seu e-mail</h2><p>Antes da conferência da conta, confirme o endereço de e-mail. Isso comprova o controle da caixa, não sua idade ou vínculo com um menor.</p><form action={sendProtectionVerificationAction}><button>Enviar confirmação de e-mail</button></form></section>}
    {!approved ? <section><h2>Verificação da conta adulta</h2><p>Situação: {overview.status?statuses[overview.status]:'Ainda não solicitada'}.</p><p>A equipe fará a conferência de maioridade pelo atendimento em <a href="mailto:contato@apogee.community">contato@apogee.community</a>. Não envie documentos pelo formulário. A comunidade e a sincronização Google ficam disponíveis após aprovação.</p>
      {overview.emailVerified && overview.status!=='pending' && <form action={requestAdultAction}><label><input type="checkbox" name="adultDeclared" required/> Tenho 18 anos ou mais e solicito a verificação da minha conta.</label><button>Solicitar verificação da conta</button></form>}
    </section>:<><section><h2>Vincular criança ou adolescente</h2><p>Use apenas um apelido e a faixa etária. Não informe nome completo, CPF, documentos, escola ou data de nascimento. A equipe verificará também sua condição de pai, mãe ou responsável legal antes de aprovar o vínculo.</p>
      <form action={requestDependentAction}>
        <label>Apelido do dependente<input name="nickname" minLength={2} maxLength={40} required autoComplete="off"/></label>
        <label>Faixa etária<select name="ageBand" required defaultValue=""><option value="" disabled>Selecione</option>{Object.entries(ages).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
        <label>Seu vínculo<select name="relationship" required defaultValue=""><option value="" disabled>Selecione</option><option value="parent">Pai ou mãe</option><option value="legal_guardian">Responsável legal</option></select></label>
        <label><input type="checkbox" name="consent" required/> Sou pai, mãe ou responsável legal, li a Política de Privacidade e autorizo este cadastro privado e o acompanhamento de oportunidades em benefício do menor.</label>
        <button>Solicitar vínculo protegido</button>
      </form></section><p>As oportunidades salvas e a conexão Google Agenda permanecem na sua conta. O vínculo não concede acesso pago, não compartilha sua senha e pode ser revogado aqui.</p><Link href="/membros/meu-calendario">Abrir meu calendário</Link></>}
    <section><h2>Meus vínculos</h2>{!overview.dependents.length?<p>Nenhum vínculo registrado.</p>:<ul>{overview.dependents.map(row=><li key={String(row.id)}><strong>{String(row.nickname)}</strong> · {ages[String(row.age_band)]} · {statuses[String(row.status)]}{row.status!=='revoked' && <form action={revokeDependentAction}><input type="hidden" name="dependentId" value={String(row.id)}/><button>Revogar autorização de {String(row.nickname)}</button></form>}</li>)}</ul>}</section>
  </div>;
}
