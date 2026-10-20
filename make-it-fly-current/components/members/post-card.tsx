import { interfaceText } from "@/lib/presentation-text.mjs";
import Link from "next/link";
import { AvatarInitials } from "./avatar-initials";
import { formatDateTime } from "./format";
import styles from "./members.module.css";
import { PostTools } from "./post-tools";

type PostCardProps = {
  post: {
    id: number;
    body: string;
    isOpening: boolean;
    createdAt: Date;
    editedAt: Date | null;
    authorId: string;
    authorName: string;
    authorUsername: string | null;
    authorImage: string | null;
  };
  canEdit: boolean;
  category: string;
  last?: boolean;
};

export function PostCard({ post, canEdit, category, last }: PostCardProps) {
  return (
    <article
      className={post.isOpening ? `${styles.post} ${styles.postOpening}` : styles.post}
      id={last ? "fim" : `post-${post.id}`}
    >
      <AvatarInitials name={post.authorName} userId={post.authorId} image={post.authorImage} />
      <div className={styles.postContent}>
        <header className={styles.postHead}>
          {post.authorUsername ? (
            <Link href={`/membros/perfil/${post.authorUsername}`}>{interfaceText(post.authorName)}</Link>
          ) : (
            <strong>{interfaceText(post.authorName)}</strong>
          )}
          <span className={styles.meta}>
            <time dateTime={post.createdAt.toISOString()}>{formatDateTime(post.createdAt)}</time>
            {post.editedAt ? " · editado" : null}
          </span>
        </header>
        <p className={styles.postBody}>{interfaceText(post.body)}</p>
        {canEdit ? <PostTools postId={post.id} body={post.body} category={category} isOpening={post.isOpening} /> : null}
      </div>
    </article>
  );
}
