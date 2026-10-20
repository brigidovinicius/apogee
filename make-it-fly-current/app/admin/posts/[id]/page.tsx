import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminPageHeader, adminStyles as styles } from "@/components/admin/admin-ui";
import { requireAdmin } from "@/lib/admin/access";
import { getAdminPost, listPostEvents, listPostMedia } from "@/lib/blog/data";
import { blogMediaUrl } from "@/lib/blog/media";
import { isPublicPost } from "@/lib/blog/shared";
import { PostEditor } from "../post-editor";
import editorStyles from "../posts.module.css";

export const dynamic = "force-dynamic";

const dateFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Sao_Paulo" });
const actionLabel: Record<string, string> = {
  criado: "Criou o rascunho", editado: "Editou o artigo", publish: "Publicou",
  schedule: "Agendou", unpublish: "Retirou do ar", archive: "Arquivou",
};

export default async function AdminEditPostPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ salvo?: string }>;
}) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id < 1) notFound();
  await requireAdmin(`/admin/posts/${id}`);
  const [post, events, images, query] = await Promise.all([getAdminPost(id), listPostEvents(id), listPostMedia(id), searchParams]);
  if (!post) notFound();

  return <div className={styles.content}>
    <AdminPageHeader title="Editar artigo" description="Altere o conteúdo e escolha como ele deve aparecer no blog." aside={<Link className={styles.secondaryButton} href="/admin/posts">Todos os artigos</Link>} />
    {query.salvo === "1" ? <p className={editorStyles.success} role="status">Alterações salvas.</p> : null}
    {isPublicPost(post) ? <p className={editorStyles.publicLink}><Link href={`/blog/${post.slug}`} target="_blank" rel="noopener noreferrer">Ver artigo publicado <ArrowUpRight aria-hidden="true" size="1em" style={{ display: "inline-block", verticalAlign: "middle" }} /></Link></p> : null}
    <PostEditor post={post} media={images.map((image) => ({ id: image.id, url: blogMediaUrl(image.id), alt: image.alt, caption: image.caption, width: image.width, height: image.height }))} />
    <section className={editorStyles.history} aria-labelledby="history-title">
      <h2 id="history-title">Histórico recente</h2>
      <ol>{events.map((event) => <li key={event.id}><span>{actionLabel[event.action] ?? event.action} · {event.actorName}</span><time dateTime={event.createdAt.toISOString()}>{dateFormat.format(event.createdAt)}</time></li>)}</ol>
    </section>
  </div>;
}
