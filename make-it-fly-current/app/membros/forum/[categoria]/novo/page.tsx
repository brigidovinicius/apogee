import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MemberBar } from "@/components/members/member-bar";
import styles from "@/components/members/members.module.css";
import { TopicForm } from "@/components/members/topic-form";
import { requireMember } from "@/lib/members/dal";
import { getCategory } from "@/lib/members/forum";

export const metadata: Metadata = { title: "Novo tópico" };

export default async function NewTopicPage({ params }: { params: Promise<{ categoria: string }> }) {
  const { categoria } = await params;
  const member = await requireMember(`/membros/forum/${categoria}/novo`);
  const category = await getCategory(categoria);
  if (!category) notFound();

  return (
    <div className={styles.container}>
      <MemberBar member={member} current="forum" />
      <ol className={styles.breadcrumbs}>
        <li>
          <Link href="/membros">Fórum</Link>
        </li>
        <li>
          <Link href={`/membros/forum/${category.slug}`}>{category.name}</Link>
        </li>
        <li aria-current="page">Novo tópico</li>
      </ol>
      <h1 className={styles.title}>Novo tópico</h1>
      <div className={styles.panel} style={{ marginTop: "2rem" }}>
        <TopicForm category={category.slug} />
      </div>
    </div>
  );
}
