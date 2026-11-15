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
    <li><strong>revisaoanual@example.test</strong>: período anual pago sintético, com renovação cancelada; Radar e caixa de ferramentas disponíveis até o fim do período.</li>
    <li><strong>revisaoadmin@example.test</strong>: curadoria da caixa de ferramentas e prévia administrativa. O papel administrativo é apenas desta conta fictícia local.</li>
    <li><strong>revisaoexpirado@example.test</strong>: assinatura com período pago encerrado; caixa de ferramentas bloqueada.</li>
    <li><strong>revisaoreembolso@example.test</strong>: fatura anual integralmente reembolsada; caixa de ferramentas bloqueada.</li></ul>
    <p><Link className={styles.primary} href="/membros/entrar?next=%2Fmembros%2Foportunidades">Entrar para validar o Radar</Link></p>
    <p><Link href="/membros/assinatura">Ver assinatura e renovação</Link> · <Link href="/comunidade#planos">Rever a oferta anual</Link></p>
    <p><Link className={styles.primary} href="/membros/ferramentas">Abrir a caixa de ferramentas</Link> · <Link href="/admin/ferramentas">Abrir a curadoria administrativa</Link></p>
    <p>O exemplo publicado nesta prévia é Vídeo → Google Flow. As demais categorias estão vazias e aparecem apenas na curadoria. Alterações aqui ficam neste banco local, sem publicar em produção.</p>
    <p>Pagamentos e envio de e-mail são bloqueados nesta prévia. Nenhuma assinatura ou concessão aqui representa uma cobrança real.</p>
  </main>;
}
