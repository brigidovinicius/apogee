import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { MemberBar } from "@/components/members/member-bar";
import styles from "@/components/members/members.module.css";
import { Pagination } from "@/components/members/pagination";
import { PostCard } from "@/components/members/post-card";
import { ReplyForm } from "@/components/members/reply-form";
import { requireMember } from "@/lib/members/dal";
import { getTopic, listPosts } from "@/lib/members/forum";
import { parsePage, parseTopicParam, topicParam } from "@/lib/members/validation";

type Props = {
  params: Promise<{ categoria: string; topico: string }>;
  searchParams: Promise<{ pagina?: string | string[] }>;
};

export const metadata: Metadata = { title: "Tópico" };

export default async function TopicPage({ params, searchParams }: Props) {
  const { categoria, topico } = await params;
  const member = await requireMember(`/membros/forum/${categoria}/${topico}`);
  const topicId = parseTopicParam(topico);
  const topic = topicId ? await getTopic(topicId) : null;
  if (!topic) notFound();

  const canonicalParam = topicParam(topic.id, topic.slug);
  const basePath = `/membros/forum/${topic.categorySlug}/${canonicalParam}`;
  if (categoria !== topic.categorySlug || topico !== canonicalParam) redirect(basePath);

  const page = parsePage((await searchParams).pagina);
  const { posts, pages } = await listPosts(topic.id, page);

  return (
    <div className={styles.container}>
      <MemberBar member={member} current="forum" />
      <ol className={styles.breadcrumbs}>
        <li>
          <Link href="/membros">Fórum</Link>
        </li>
        <li>
          <Link href={`/membros/forum/${topic.categorySlug}`}>{topic.categoryName}</Link>
        </li>
      </ol>
      <header className={styles.pageHead}>
        <h1 className={styles.title}>{topic.title}</h1>
      </header>

      <div>
        {posts.map((post, index) => (
          <PostCard
            key={post.id}
            post={post}
            canEdit={post.authorId === member.id}
            category={topic.categorySlug}
            last={page === pages && index === posts.length - 1}
          />
        ))}
      </div>
      <Pagination basePath={basePath} page={page} pages={pages} />

      <section className={styles.section} aria-labelledby="responder">
        <h2 className={styles.sectionTitle} id="responder">
          Responder
        </h2>
        <div className={styles.panel}>
          <ReplyForm topic={String(topic.id)} />
        </div>
      </section>
    </div>
  );
}
