import type { Metadata } from "next";
import Link from "next/link";
import { AdminPageHeader, adminStyles } from "@/components/admin/admin-ui";
import { listCommunityContacts } from "@/lib/admin/community-contacts";
import styles from "./contacts.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Contatos do evento Codex Community" };
const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

export default async function CommunityContactsPage({ searchParams }: { searchParams: Promise<{ pagina?: string | string[] }> }) {
  const params = await searchParams;
  const { rows, total, page, pageCount } = await listCommunityContacts(params.pagina);
  return <div className={adminStyles.content}>
    <AdminPageHeader title="Contatos do evento" description="Pedidos para receber as informações de acesso ao Codex Community. Use os contatos apenas para a finalidade autorizada."
      aside={<span className={adminStyles.dataBadge}>{total} pedidos</span>} />
    <p className={styles.notice}>O pedido não confirma a titularidade do e-mail. Nenhum envio de acesso foi feito automaticamente por este formulário.</p>
    {rows.length ? <div className={styles.list}>{rows.map(row => <article className={styles.contact} key={row.id}>
      <div><h2>{row.name}</h2><p>{row.email}</p></div>
      <time dateTime={row.consented_at.toISOString()}>{dateTime.format(row.consented_at)}</time>
      {row.goal && <details><summary>O que quer fazer com IA</summary><p>{row.goal}</p></details>}
    </article>)}</div> : <p>Nenhum pedido recebido ainda. Os cadastros enviados pela página do evento aparecerão aqui.</p>}
    <nav className={styles.pagination} aria-label="Páginas dos contatos"><p>Página {page} de {pageCount}</p><div>
      {page > 1 && <Link className={adminStyles.secondaryButton} href={`/admin/comunidade?pagina=${page - 1}`}>Anterior</Link>}
      {page < pageCount && <Link className={adminStyles.secondaryButton} href={`/admin/comunidade?pagina=${page + 1}`}>Próxima</Link>}
    </div></nav>
  </div>;
}
