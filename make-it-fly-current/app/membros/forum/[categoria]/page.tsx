import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AvatarInitials } from "@/components/members/avatar-initials";
import { formatDateTime, plural } from "@/components/members/format";
import { MemberBar } from "@/components/members/member-bar";
import styles from "@/components/members/members.module.css";
import { Pagination } from "@/components/members/pagination";
import { requireMember } from "@/lib/members/dal";
import { getCategory, listTopics } from "@/lib/members/forum";
import { parsePage, topicParam } from "@/lib/members/validation";

type Props = {
  params: Promise<{ categoria: string }>;
  searchParams: Promise<{ pagina?: string | string[] }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { categoria } = await params;
  return { title: `Fórum · ${categoria}` };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { categoria } = await params;
  const basePath = `/membros/forum/${categoria}`;
  const member = await requireMember(basePath);
  const category = await getCategory(categoria);
  if (!category) notFound();

  const page = parsePage((await searchParams).pagina);
  const { topics, total, pages } = await listTopics(category.id, page);

  return (
    <div className={styles.container}>
      <MemberBar member={member} current="forum" />
      <ol className={styles.breadcrumbs}>
        <li>
          <Link href="/membros">Fórum</Link>
        </li>
        <li aria-current="page">{category.name}</li>
      </ol>
      <header className={styles.pageHead}>
        <div>
          <h1 className={styles.title}>{category.name}</h1>
          {category.description ? <p className={styles.lead}>{category.description}</p> : null}
        </div>
        <Link className={styles.primaryLight} href={`${basePath}/novo`}>
          Novo tópico <span aria-hidden>+</span>
        </Link>
      </header>

      {total === 0 ? (
        <p className={styles.empty}>Nenhum tópico ainda. Que tal abrir o primeiro?</p>
      ) : (
        <ul className={styles.list}>
          {topics.map((topic) => (
            <li className={styles.listItem} key={topic.id}>
              <div>
                <h2>
                  <Link href={`${basePath}/${topicParam(topic.id, topic.slug)}`}>{topic.title}</Link>
                </h2>
                <p className={styles.meta}>
                  <AvatarInitials name={topic.authorName} size="small" />{" "}
                  {topic.authorUsername ? (
                    <Link href={`/membros/perfil/${topic.authorUsername}`}>{topic.authorName}</Link>
                  ) : (
                    topic.authorName
                  )}{" "}
                  · {formatDateTime(topic.createdAt)}
                </p>
              </div>
              <div className={styles.stats}>
                <span>
                  {plural(topic.replyCount, "resposta", "respostas")}
                  <br />
                  últ. {formatDateTime(topic.lastPostAt)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Pagination basePath={basePath} page={page} pages={pages} />
    </div>
  );
}
