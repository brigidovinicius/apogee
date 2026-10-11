import "server-only";

import { and, count, desc, eq, lte, or, sql } from "drizzle-orm";
import { getDb } from "@/lib/members/db";
import { blogPost, blogPostEvent } from "@/lib/members/schema";
import type { BlogCategory, BlogStatus } from "./shared";

const PAGE_SIZE = 12;

function publicCondition(now: Date) {
  return or(
    and(eq(blogPost.status, "published"), lte(blogPost.publishedAt, now)),
    and(eq(blogPost.status, "scheduled"), lte(blogPost.scheduledAt, now)),
  )!;
}

const visibleAt = sql<Date>`coalesce(${blogPost.publishedAt}, ${blogPost.scheduledAt})`;

export async function listPublicPosts(category: BlogCategory | null, page: number) {
  const where = category ? and(publicCondition(new Date()), eq(blogPost.category, category)) : publicCondition(new Date());
  const db = getDb();
  const [posts, [{ total }]] = await Promise.all([
    db.select().from(blogPost).where(where)
      .orderBy(desc(blogPost.featured), desc(visibleAt), desc(blogPost.id))
      .limit(PAGE_SIZE).offset((page - 1) * PAGE_SIZE),
    db.select({ total: count() }).from(blogPost).where(where),
  ]);
  return { posts, total, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function getPublicPost(slug: string) {
  const [post] = await getDb().select().from(blogPost)
    .where(and(eq(blogPost.slug, slug), publicCondition(new Date()))).limit(1);
  return post ?? null;
}

export async function listPublicPostUrls() {
  return getDb().select({ slug: blogPost.slug, updatedAt: blogPost.updatedAt })
    .from(blogPost).where(publicCondition(new Date())).orderBy(desc(blogPost.updatedAt));
}

export async function listAdminPosts(page: number) {
  const db = getDb();
  const [posts, [{ total }]] = await Promise.all([
    db.select().from(blogPost).orderBy(desc(blogPost.updatedAt), desc(blogPost.id))
      .limit(30).offset((page - 1) * 30),
    db.select({ total: count() }).from(blogPost),
  ]);
  return { posts, total, pages: Math.max(1, Math.ceil(total / 30)) };
}

export async function getAdminPost(id: number) {
  const [post] = await getDb().select().from(blogPost).where(eq(blogPost.id, id)).limit(1);
  return post ?? null;
}

export async function listPostEvents(id: number) {
  return getDb().select().from(blogPostEvent).where(eq(blogPostEvent.postId, id))
    .orderBy(desc(blogPostEvent.createdAt), desc(blogPostEvent.id)).limit(15);
}

export type BlogPostRow = typeof blogPost.$inferSelect;

export async function savePost(input: {
  id: number | null;
  revision: number | null;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  category: BlogCategory;
  featured: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  intent: "save" | "publish" | "schedule" | "unpublish" | "archive";
  scheduledAt: Date | null;
  actorId: string;
  actorName: string;
}): Promise<{ id: number; slug: string } | "conflict"> {
  return getDb().transaction(async (tx) => {
    const now = new Date();
    const current = input.id === null ? null : (await tx.select().from(blogPost).where(eq(blogPost.id, input.id)).limit(1))[0];
    if (input.id !== null && (!current || current.revision !== input.revision)) return "conflict";

    let status: BlogStatus = current?.status ?? "draft";
    let publishedAt = current?.publishedAt ?? null;
    let scheduledAt = current?.scheduledAt ?? null;
    if (input.intent === "publish") { status = "published"; publishedAt = now; scheduledAt = null; }
    if (input.intent === "schedule") { status = "scheduled"; scheduledAt = input.scheduledAt; publishedAt = null; }
    if (input.intent === "unpublish") { status = "draft"; publishedAt = null; scheduledAt = null; }
    if (input.intent === "archive") { status = "archived"; publishedAt = null; scheduledAt = null; }
    if (input.intent === "save" && status === "archived") status = "draft";

    const fields = {
      slug: input.slug, title: input.title, excerpt: input.excerpt, body: input.body,
      category: input.category, featured: input.featured, seoTitle: input.seoTitle,
      seoDescription: input.seoDescription, status, publishedAt, scheduledAt, updatedAt: now,
    };
    const [post] = current
      ? await tx.update(blogPost).set({ ...fields, revision: current.revision + 1 })
        .where(and(eq(blogPost.id, current.id), eq(blogPost.revision, current.revision)))
        .returning({ id: blogPost.id, slug: blogPost.slug })
      : await tx.insert(blogPost).values({ ...fields, authorId: input.actorId, authorName: input.actorName })
        .returning({ id: blogPost.id, slug: blogPost.slug });
    if (!post) return "conflict";
    await tx.insert(blogPostEvent).values({
      postId: post.id, actorId: input.actorId, actorName: input.actorName,
      action: input.intent === "save" ? (current ? "editado" : "criado") : input.intent,
    });
    return post;
  });
}
