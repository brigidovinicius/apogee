import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AvatarInitials } from "@/components/members/avatar-initials";
import { formatDateTime, formatMonthYear, plural } from "@/components/members/format";
import { MemberBar } from "@/components/members/member-bar";
import styles from "@/components/members/members.module.css";
import { requireMember } from "@/lib/members/dal";
import { getProfile } from "@/lib/members/forum";
import { topicParam, usernameSchema } from "@/lib/members/validation";

type Props = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  return { title: `@${decodeURIComponent(username)}` };
}

export default async function ProfilePage({ params }: Props) {
  const { username } = await params;
  const member = await requireMember(`/membros/perfil/${username}`);
  const handle = usernameSchema.safeParse(decodeURIComponent(username));
  const profile = handle.success ? await getProfile(handle.data) : null;
  if (!profile) notFound();

  const isOwn = profile.id === member.id;

  return (
    <div className={styles.container}>
      <MemberBar member={member} current={isOwn ? "perfil" : undefined} />
      <header className={styles.pageHead}>
        <div className={styles.profileHead}>
          <AvatarInitials name={profile.name} size="large" />
          <div>
            <h1 className={styles.title}>{profile.name}</h1>
            <p className={styles.eyebrow} style={{ margin: "0.6rem 0 0" }}>
              @{profile.username} · membro desde {formatMonthYear(profile.createdAt)}
            </p>
          </div>
        </div>
        {isOwn ? (
          <Link className={styles.primaryLight} href="/membros/perfil/editar">
            Editar perfil
          </Link>
        ) : null}
      </header>
      {profile.bio ? <p className={styles.bio}>{profile.bio}</p> : null}

      <section className={styles.section} aria-labelledby="topicos">
        <h2 className={styles.sectionTitle} id="topicos">
          {plural(profile.topicCount, "tópico", "tópicos")}
        </h2>
        {profile.topics.length === 0 ? (
          <p className={styles.empty}>Nenhum tópico ainda.</p>
        ) : (
          <ul className={styles.list}>
            {profile.topics.map((topic) => (
              <li className={styles.listItem} key={topic.id}>
                <div>
                  <h3>
                    <Link href={`/membros/forum/${topic.categorySlug}/${topicParam(topic.id, topic.slug)}`}>
                      {topic.title}
                    </Link>
                  </h3>
                  <p className={styles.meta}>{formatDateTime(topic.createdAt)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.section} aria-labelledby="respostas">
        <h2 className={styles.sectionTitle} id="respostas">
          {plural(profile.replyCount, "resposta", "respostas")}
        </h2>
        {profile.replies.length === 0 ? (
          <p className={styles.empty}>Nenhuma resposta ainda.</p>
        ) : (
          <ul className={styles.list}>
            {profile.replies.map((reply) => (
              <li className={styles.listItem} key={reply.id}>
                <div>
                  <h3>
                    <Link href={`/membros/forum/${reply.categorySlug}/${topicParam(reply.topicId, reply.topicSlug)}`}>
                      {reply.topicTitle}
                    </Link>
                  </h3>
                  <p>{reply.body.length > 180 ? `${reply.body.slice(0, 180)}…` : reply.body}</p>
                  <p className={styles.meta}>{formatDateTime(reply.createdAt)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
