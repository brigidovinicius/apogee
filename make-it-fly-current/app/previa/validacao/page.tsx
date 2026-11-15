import Link from "next/link";
import { notFound } from "next/navigation";
import { localFunctionalReview } from "@/lib/offer-preview";
import styles from "@/components/members/members.module.css";
export const dynamic="force-dynamic";
export const metadata={title:"Validação local por conta | Apogee",robots:{index:false,follow:false}};
export default function FunctionalReviewPage() {
  if(!localFunctionalReview()) notFound();
  return <main className={styles.container}><h1 className={styles.title}>Valide o acesso real por conta.</h1>
    <p>Estas contas e os 12 eventos são fictícios. A autenticação, a gravação das consultas e as regras de acesso usam o código real e um PostgreSQL exclusivo desta prévia.</p>
    <p>Senha de todas as contas locais: <code>RevisaoLocal2026!</code>. Entre com o e-mail abaixo. Para trocar de conta, use Sair na área de membros.</p>
    <ul><li><strong>revisaolivre@example.test</strong>: saldo inicial de 10 eventos. Abra um evento, atualize e reabra para conferir que o saldo permanece.</li>
    <li><strong>revisaolimite@example.test</strong>: 10 eventos já consultados. Os eventos 01 a 10 reabrem; 11 e 12 apresentam a comunidade.</li>
    <li><strong>revisaolegado@example.test</strong>: acesso antigo ao Radar completo, sem consumir consultas.</li>
    <li><strong>revisaoanual@example.test</strong>: período anual pago sintético, com renovação cancelada e acesso preservado até o fim do período.</li></ul>
    <p><Link className={styles.primary} href="/membros/entrar?next=%2Fmembros%2Foportunidades">Entrar para validar o Radar</Link></p>
    <p><Link href="/membros/assinatura">Ver assinatura e renovação</Link> · <Link href="/comunidade#planos">Rever a oferta anual</Link></p>
    <p>Pagamentos são bloqueados nesta prévia. Os testes automatizados validam a integração com respostas Stripe sintéticas; o checkout real em sandbox ainda precisa de validação.</p>
  </main>;
}
