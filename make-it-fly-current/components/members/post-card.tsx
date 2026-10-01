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
    authorName: string;
    authorUsername: string | null;
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
      <AvatarInitials name={post.authorName} />
      <div className={styles.postContent}>
        <header className={styles.postHead}>
          {post.authorUsername ? (
            <Link href={`/membros/perfil/${post.authorUsername}`}>{post.authorName}</Link>
          ) : (
            <strong>{post.authorName}</strong>
          )}
          <span className={styles.meta}>
            <time dateTime={post.createdAt.toISOString()}>{formatDateTime(post.createdAt)}</time>
            {post.editedAt ? " · editado" : null}
          </span>
        </header>
        <p className={styles.postBody}>{post.body}</p>
        {canEdit ? <PostTools postId={post.id} body={post.body} category={category} isOpening={post.isOpening} /> : null}
      </div>
    </article>
  );
}
