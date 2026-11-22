import Link from "next/link";
import { getCurrentMember } from "@/lib/members/dal";
import { MemberWorkspace } from "@/components/members/member-workspace";
import styles from "@/components/members/members.module.css";
export const metadata = { title: "Suporte e próximos passos" };
export default async function SupportPage() {
  // Help remains available when the visitor is signed out, blocked or the
  // authentication provider is temporarily unavailable. No private data is read.
  const member = await getCurrentMember().catch(() => null);
  return <MemberWorkspace member={member} current="suporte"><div className={styles.container}><header className={styles.pageHead}><div><p className={styles.eyebrow}>Ajuda com acesso e conta</p><h1 className={styles.title}>Como podemos ajudar?</h1></div></header>
    <section className={styles.panel}><h2 data-ap-heading="">Fale com a Apogee</h2><p>Escreva para <a href="mailto:contato@apogee.community">contato@apogee.community</a>. Se já tem conta, use o e-mail cadastrado e descreva a dificuldade.</p><p>Ajuda com acesso, assinatura, benefícios, cancelamento, reembolso ou seus dados, mesmo sem entrar na plataforma. Para interromper avisos, indique quais deseja cancelar.</p><p>Não envie senhas, códigos de autenticação, dados completos de cartão ou documentos de menores.</p></section>
    <section className={styles.panel}><h2 data-ap-heading="">Gerenciar acesso e conta</h2><p><Link href="/membros/assinatura">Assinatura, faturas e cancelamento da renovação</Link></p><p><Link href="/membros/protecao">Verificação e cadastro protegido</Link></p><p><Link href="/membros#forum">Conversas da comunidade</Link></p></section>
    {!member ? <p><Link href="/membros/entrar">Entrar na minha conta</Link> · <Link href="/membros/esqueci-senha">Recuperar senha</Link></p> : null}
  </div></MemberWorkspace>;
}
