import Link from "next/link";
import { requireSignedInMember } from "@/lib/members/dal";
import { MemberBar } from "@/components/members/member-bar";
import styles from "@/components/members/members.module.css";
export const metadata = { title: "Suporte e próximos passos" };
export default async function SupportPage() {
  const member = await requireSignedInMember("/membros/suporte");
  return <div className={styles.container}><MemberBar member={member} current="suporte" /><header className={styles.pageHead}><div><p className={styles.eyebrow}>Sua conta</p><h1 className={styles.title}>Como podemos ajudar?</h1></div></header>
    <section className={styles.panel}><h2>Suporte da Apogee</h2><p>Envie sua dúvida para <a href="mailto:contato@apogee.community">contato@apogee.community</a>, canal informado nos termos da plataforma. Use o e-mail da sua conta e descreva a dificuldade.</p><p>Não envie senha, código de autenticação, dados completos de cartão ou documentos de menores. Se necessário, a equipe orientará a confirmação de identidade.</p><p>O contato abre uma solicitação de atendimento. Esta página não confirma envio de mensagem, cancelamento ou reembolso.</p></section>
    <section className={styles.panel}><h2>Gerenciar acesso e conta</h2><p><Link href="/membros/assinatura">Assinatura, faturas e cancelamento da renovação</Link></p><p><Link href="/membros/protecao">Verificação e cadastro protegido</Link></p><p><Link href="/membros/trilha">Próximo passo da Trilha</Link> · <Link href="/membros#forum">Conversas da comunidade</Link></p></section>
  </div>;
}
