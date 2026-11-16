import Link from "next/link";
import { getCurrentMember } from "@/lib/members/dal";
import { MemberBar } from "@/components/members/member-bar";
import styles from "@/components/members/members.module.css";
export const metadata = { title: "Suporte e próximos passos" };
export default async function SupportPage() {
  // Help remains available when the visitor is signed out, blocked or the
  // authentication provider is temporarily unavailable. No private data is read.
  const member = await getCurrentMember().catch(() => null);
  return <div className={styles.container}>{member ? <MemberBar member={member} current="suporte" /> : null}<header className={styles.pageHead}><div><p className={styles.eyebrow}>Ajuda com acesso e conta</p><h1 className={styles.title}>Como podemos ajudar?</h1></div></header>
    <section className={styles.panel}><h2>Suporte da Apogee</h2><p>Envie sua dúvida para <a href="mailto:contato@apogee.community">contato@apogee.community</a>, canal informado nos termos da plataforma. Se já tem conta, use o e-mail cadastrado e descreva a dificuldade.</p><p>Você pode pedir ajuda sem entrar na plataforma, inclusive para recuperação de acesso, assinatura, benefício ou solicitação sobre seus dados. Para interromper avisos solicitados, informe a finalidade, como evento ou novidades dos drops.</p><p>Não envie senha, código de autenticação, dados completos de cartão ou documentos de menores. Se necessário, a equipe orientará a confirmação de identidade.</p><p>Abrir seu aplicativo de e-mail não confirma o envio. Esta página não conclui cancelamento, reembolso ou solicitação sobre dados.</p></section>
    <section className={styles.panel}><h2>Gerenciar acesso e conta</h2><p><Link href="/membros/assinatura">Assinatura, faturas e cancelamento da renovação</Link></p><p><Link href="/membros/protecao">Verificação e cadastro protegido</Link></p><p><Link href="/membros/trilha">Próximo passo da Trilha</Link> · <Link href="/membros#forum">Conversas da comunidade</Link></p></section>
    {!member ? <p><Link href="/membros/entrar">Entrar na minha conta</Link> · <Link href="/membros/esqueci-senha">Recuperar senha</Link></p> : null}
  </div>;
}
