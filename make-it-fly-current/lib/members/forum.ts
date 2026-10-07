import "server-only";
import { and, asc, count, desc, eq, sql } from "drizzle-orm";
import { getDb } from "./db";
import { forumCategory, forumPost, forumTopic, user } from "./schema";
import { POSTS_PAGE_SIZE, TOPICS_PAGE_SIZE, slugify } from "./validation";

// Camada de dados do fórum. Só expõe campos públicos dos autores (nunca e-mail).

const authorFields = {
  authorName: user.name,
  authorUsername: user.username,
};

export async function listCategories() {
  const db = getDb();
  const topicStats = db
    .select({
      categoryId: forumTopic.categoryId,
      topics: count().as("topics"),
      replies: sql<number>`coalesce(sum(${forumTopic.replyCount}), 0)::int`.as("replies"),
      lastPostAt: sql<Date | null>`max(${forumTopic.lastPostAt})`.as("last_post_at"),
    })
    .from(forumTopic)
    .groupBy(forumTopic.categoryId)
    .as("topic_stats");

  return db
    .select({
      id: forumCategory.id,
      slug: forumCategory.slug,
      name: forumCategory.name,
      description: forumCategory.description,
      topics: sql<number>`coalesce(${topicStats.topics}, 0)::int`,
      replies: sql<number>`coalesce(${topicStats.replies}, 0)::int`,
      lastPostAt: topicStats.lastPostAt,
    })
    .from(forumCategory)
    .leftJoin(topicStats, eq(topicStats.categoryId, forumCategory.id))
    .orderBy(asc(forumCategory.position), asc(forumCategory.name));
}

export async function getCategory(slug: string) {
  const [category] = await getDb().select().from(forumCategory).where(eq(forumCategory.slug, slug)).limit(1);
  return category ?? null;
}

export async function listTopics(categoryId: number, page: number) {
  const db = getDb();
  const [topics, [{ total }]] = await Promise.all([
    db
      .select({
        id: forumTopic.id,
        slug: forumTopic.slug,
        title: forumTopic.title,
        replyCount: forumTopic.replyCount,
        createdAt: forumTopic.createdAt,
        lastPostAt: forumTopic.lastPostAt,
        ...authorFields,
      })
      .from(forumTopic)
      .innerJoin(user, eq(user.id, forumTopic.authorId))
      .where(eq(forumTopic.categoryId, categoryId))
      .orderBy(desc(forumTopic.lastPostAt), desc(forumTopic.id))
      .limit(TOPICS_PAGE_SIZE)
      .offset((page - 1) * TOPICS_PAGE_SIZE),
    db.select({ total: count() }).from(forumTopic).where(eq(forumTopic.categoryId, categoryId)),
  ]);
  return { topics, total, pages: Math.max(1, Math.ceil(total / TOPICS_PAGE_SIZE)) };
}

export async function getTopic(id: number) {
  const [topic] = await getDb()
    .select({
      id: forumTopic.id,
      slug: forumTopic.slug,
      title: forumTopic.title,
      replyCount: forumTopic.replyCount,
      createdAt: forumTopic.createdAt,
      authorId: forumTopic.authorId,
      categoryId: forumCategory.id,
      categorySlug: forumCategory.slug,
      categoryName: forumCategory.name,
      ...authorFields,
    })
    .from(forumTopic)
    .innerJoin(forumCategory, eq(forumCategory.id, forumTopic.categoryId))
    .innerJoin(user, eq(user.id, forumTopic.authorId))
    .where(eq(forumTopic.id, id))
    .limit(1);
  return topic ?? null;
}

export async function listPosts(topicId: number, page: number) {
  const db = getDb();
  const [posts, [{ total }]] = await Promise.all([
    db
      .select({
        id: forumPost.id,
        body: forumPost.body,
        isOpening: forumPost.isOpening,
        createdAt: forumPost.createdAt,
        editedAt: forumPost.editedAt,
        authorId: forumPost.authorId,
        ...authorFields,
      })
      .from(forumPost)
      .innerJoin(user, eq(user.id, forumPost.authorId))
      .where(eq(forumPost.topicId, topicId))
      .orderBy(asc(forumPost.createdAt), asc(forumPost.id))
      .limit(POSTS_PAGE_SIZE)
      .offset((page - 1) * POSTS_PAGE_SIZE),
    db.select({ total: count() }).from(forumPost).where(eq(forumPost.topicId, topicId)),
  ]);
  return { posts, total, pages: Math.max(1, Math.ceil(total / POSTS_PAGE_SIZE)) };
}

export async function getProfile(username: string) {
  const db = getDb();
  const [profile] = await db
    .select({ id: user.id, name: user.name, username: user.username, bio: user.bio, createdAt: user.createdAt })
    .from(user)
    .where(eq(user.username, username))
    .limit(1);
  if (!profile) return null;

  const [topics, replies, [{ topicCount }], [{ postCount }]] = await Promise.all([
    db
      .select({
        id: forumTopic.id,
        slug: forumTopic.slug,
        title: forumTopic.title,
        createdAt: forumTopic.createdAt,
        categorySlug: forumCategory.slug,
      })
      .from(forumTopic)
      .innerJoin(forumCategory, eq(forumCategory.id, forumTopic.categoryId))
      .where(eq(forumTopic.authorId, profile.id))
      .orderBy(desc(forumTopic.createdAt))
      .limit(10),
    db
      .select({
        id: forumPost.id,
        body: forumPost.body,
        createdAt: forumPost.createdAt,
        topicId: forumTopic.id,
        topicSlug: forumTopic.slug,
        topicTitle: forumTopic.title,
        categorySlug: forumCategory.slug,
      })
      .from(forumPost)
      .innerJoin(forumTopic, eq(forumTopic.id, forumPost.topicId))
      .innerJoin(forumCategory, eq(forumCategory.id, forumTopic.categoryId))
      .where(and(eq(forumPost.authorId, profile.id), eq(forumPost.isOpening, false)))
      .orderBy(desc(forumPost.createdAt))
      .limit(10),
    db.select({ topicCount: count() }).from(forumTopic).where(eq(forumTopic.authorId, profile.id)),
    db
      .select({ postCount: count() })
      .from(forumPost)
      .where(and(eq(forumPost.authorId, profile.id), eq(forumPost.isOpening, false))),
  ]);

  return { ...profile, topics, replies, topicCount, replyCount: postCount };
}

export async function createTopic(input: { authorId: string; categoryId: number; title: string; body: string }) {
  return getDb().transaction(async (tx) => {
    const [topic] = await tx
      .insert(forumTopic)
      .values({
        categoryId: input.categoryId,
        authorId: input.authorId,
        title: input.title,
        slug: slugify(input.title),
      })
      .returning({ id: forumTopic.id, slug: forumTopic.slug });
    await tx.insert(forumPost).values({
      topicId: topic.id,
      authorId: input.authorId,
      body: input.body,
      isOpening: true,
    });
    return topic;
  });
}

export async function createReply(input: { authorId: string; topicId: number; body: string }) {
  return getDb().transaction(async (tx) => {
    const [post] = await tx
      .insert(forumPost)
      .values({ topicId: input.topicId, authorId: input.authorId, body: input.body })
      .returning({ id: forumPost.id });
    await tx
      .update(forumTopic)
      .set({ replyCount: sql`${forumTopic.replyCount} + 1`, lastPostAt: sql`now()` })
      .where(eq(forumTopic.id, input.topicId));
    return post;
  });
}

/** Edita apenas se o post for do autor. Retorna false quando nada foi alterado. */
export async function editOwnPost(input: { authorId: string; postId: number; body: string }) {
  const rows = await getDb()
    .update(forumPost)
    .set({ body: input.body, editedAt: sql`now()` })
    .where(and(eq(forumPost.id, input.postId), eq(forumPost.authorId, input.authorId)))
    .returning({ id: forumPost.id });
  return rows.length > 0;
}

type DeleteResult =
  | { status: "not-found" }
  | { status: "has-replies" }
  | { status: "deleted"; topicDeleted: boolean; topicId: number };

/**
 * Apaga um post do próprio autor. Apagar a mensagem de abertura remove o tópico,
 * mas só enquanto ninguém respondeu (para não apagar conteúdo de outras pessoas).
 */
export async function deleteOwnPost(input: { authorId: string; postId: number }): Promise<DeleteResult> {
  return getDb().transaction(async (tx) => {
    const [post] = await tx
      .select({ id: forumPost.id, topicId: forumPost.topicId, isOpening: forumPost.isOpening })
      .from(forumPost)
      .where(and(eq(forumPost.id, input.postId), eq(forumPost.authorId, input.authorId)))
      .limit(1);
    if (!post) return { status: "not-found" };

    if (post.isOpening) {
      // O lock no tópico serializa com createReply, que também atualiza essa linha.
      const [topic] = await tx
        .select({ replyCount: forumTopic.replyCount })
        .from(forumTopic)
        .where(eq(forumTopic.id, post.topicId))
        .for("update");
      if (!topic || topic.replyCount > 0) return { status: "has-replies" };
      await tx.delete(forumTopic).where(eq(forumTopic.id, post.topicId));
      return { status: "deleted", topicDeleted: true, topicId: post.topicId };
    }
    await tx.delete(forumPost).where(eq(forumPost.id, post.id));
    await tx
      .update(forumTopic)
      .set({ replyCount: sql`greatest(${forumTopic.replyCount} - 1, 0)` })
      .where(eq(forumTopic.id, post.topicId));
    return { status: "deleted", topicDeleted: false, topicId: post.topicId };
  });
}

export async function updateProfile(input: { userId: string; name: string; bio: string }) {
  await getDb()
    .update(user)
    .set({ name: input.name, bio: input.bio || null, updatedAt: sql`now()` })
    .where(eq(user.id, input.userId));
}

export async function getOwnProfile(userId: string) {
  const [profile] = await getDb()
    .select({ name: user.name, username: user.username, bio: user.bio })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  return profile ?? null;
}
