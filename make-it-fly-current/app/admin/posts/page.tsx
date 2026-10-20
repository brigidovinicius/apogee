import { interfaceText } from "@/lib/presentation-text.mjs";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { AdminPageHeader, adminStyles as styles } from "@/components/admin/admin-ui";
import { requireAdmin } from "@/lib/admin/access";
import { listAdminPosts } from "@/lib/blog/data";
import { categoryLabel, statusLabel } from "@/lib/blog/shared";
import editorStyles from "./posts.module.css";

export const dynamic = "force-dynamic";

const dateFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Sao_Paulo" });

export default async function AdminPostsPage({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) {
  await requireAdmin("/admin/posts");
  const params = await searchParams;
  const requestedPage = Number(params.pagina);
  const page = Number.isInteger(requestedPage) && requestedPage >= 1 && requestedPage <= 10_000 ? requestedPage : 1;
  const { posts, total, pages } = await listAdminPosts(page);

  return <div className={styles.content}>
    <AdminPageHeader title="Blog" description="Gerencie artigos, rascunhos e publicações agendadas. Somente administradores podem alterar conteúdo." aside={<Link className={styles.button} href="/admin/posts/novo">Novo artigo</Link>} />
    <section className={editorStyles.list} aria-label="Artigos do blog">
      <div className={editorStyles.listHeader}><span>{total} artigo{total === 1 ? "" : "s"}</span><Link href="/blog" target="_blank" rel="noopener noreferrer">Ver blog público <ArrowUpRight aria-hidden="true" size="1em" style={{ display: "inline-block", verticalAlign: "middle" }} /></Link></div>
      {posts.length ? posts.map((post) => <article className={editorStyles.listRow} key={post.id}>
        <div><span className={editorStyles.kicker}>{categoryLabel(post.category)} · {statusLabel(post)}</span><h2><Link href={`/admin/posts/${post.id}`}>{interfaceText(post.title)}</Link></h2><p>{interfaceText(post.excerpt)}</p></div>
        <div className={editorStyles.rowMeta}><time dateTime={post.updatedAt.toISOString()}>Editado em {dateFormat.format(post.updatedAt)}</time><Link href={`/admin/posts/${post.id}`}>Editar →</Link></div>
      </article>) : <p className={editorStyles.empty}>Ainda não há artigos. Crie o primeiro rascunho para começar.</p>}
    </section>
    {pages > 1 ? <nav className={editorStyles.pagination} aria-label="Páginas de artigos">
      {page > 1 ? <Link href={`/admin/posts?pagina=${page - 1}`}>← Anterior</Link> : <span />}
      <span>Página {page} de {pages}</span>
      {page < pages ? <Link href={`/admin/posts?pagina=${page + 1}`}>Próxima →</Link> : <span />}
    </nav> : null}
  </div>;
}
