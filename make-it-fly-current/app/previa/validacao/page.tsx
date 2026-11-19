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
    <ul><li><strong>revisaopendente@example.test</strong>: conta gratuita com e-mail e conferência pendentes. Conhece a plataforma com prévias bloqueadas, sem ler conteúdo privado.</li>
    <li><strong>revisaolivre@example.test</strong>: 10 consultas em cada área. Abra e reabra um detalhe do Radar. Em seguida, confira que o saldo de Benefícios continua em 10.</li>
    <li><strong>revisaonove@example.test</strong>: nove detalhes liberados em cada área. Pode abrir mais um em cada catálogo.</li>
    <li><strong>revisaocancelada@example.test</strong>: renovação cancelada, mantendo o acesso anual no período pago.</li>
    <li><strong>revisaolimite@example.test</strong>: duas cotas esgotadas. Os detalhes iniciais reabrem; itens novos continuam bloqueados.</li>
    <li><strong>revisaoherdado@example.test</strong>: um detalhe liberado antes da mudança e as duas cotas mensais intactas.</li>
    <li><strong>revisaolegado@example.test</strong>: acesso antigo ao Radar completo, sem consumir consultas.</li>
    <li><strong>revisaoanual@example.test</strong>: período anual pago sintético ativo; Radar, caixa e Trilha disponíveis.</li>
    <li><strong>revisaoadmin@example.test</strong>: curadoria da caixa de ferramentas e prévia administrativa. O papel administrativo é apenas desta conta fictícia local.</li>
    <li><strong>revisaoexpirado@example.test</strong>: assinatura com período pago encerrado; caixa de ferramentas bloqueada.</li>
    <li><strong>revisaoreembolso@example.test</strong>: fatura anual integralmente reembolsada; caixa de ferramentas bloqueada.</li></ul>
    <p><Link className={styles.primary} href="/membros/entrar?next=%2Fmembros%2Foportunidades">Entrar para validar o Radar</Link></p>
    <p><Link href="/membros/assinatura">Ver assinatura e renovação</Link> · <Link href="/comunidade#planos">Rever a oferta anual</Link></p>
    <p><Link className={styles.primary} href="/membros/ferramentas">Abrir a caixa de ferramentas</Link> · <Link href="/admin/ferramentas">Abrir a curadoria administrativa</Link></p>
    <p>O exemplo publicado nesta prévia é Vídeo → Google Flow. As demais categorias estão vazias e aparecem apenas na curadoria. Alterações aqui ficam neste banco local, sem publicar em produção.</p>
    <p><Link href="/membros/trilha">Trilha inicial com três atividades reais para revisão</Link> · <Link href="/membros/beneficios">Testar Benefícios</Link> · <Link href="/membros/suporte">Suporte</Link></p>
    {process.env.APOGEE_BENEFITS_REVIEW === "1" ? <p>Benefícios nesta prévia: ofertas sintéticas publicadas para testar busca, categorias, salvos e histórico. Ofertas reais pesquisadas, quando fornecidas pelo manifesto privado, ficam em rascunho na <Link href="/admin/beneficios">curadoria de Benefícios</Link>. Nenhuma oferta desta prévia concede uma vantagem real.</p> : null}
    <p>O exercício inicial é material original preparado para revisão editorial; não representa uma formação completa. Benefícios aguardam acordos comprovados.</p>
    <p>Pagamentos e envio de e-mail são bloqueados nesta prévia. Nenhuma assinatura ou concessão aqui representa uma cobrança real.</p>
  </main>;
}
