import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  customType,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer }>({ dataType: () => "bytea" });

// Tabelas exigidas pelo Better Auth (core + plugin username + rate limit em banco).
// As chaves TS precisam bater com os nomes de campo do Better Auth.

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  username: text("username").unique(),
  bio: text("bio"),
  canManageAdmins: boolean("can_manage_admins").notNull().default(false),
  blocked: boolean("blocked").notNull().default(false),
  nameNeedsConfirmation: boolean("name_needs_confirmation").notNull().default(false),
  role: text("role", { enum: ["member", "admin"] }).notNull().default("member"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// A foto é armazenada no banco: o container da aplicação não possui volume
// persistente para uploads. user.image guarda apenas a URL interna versionada.
export const memberAvatar = pgTable(
  "member_avatar",
  {
    userId: text("user_id").primaryKey().references(() => user.id, { onDelete: "cascade" }),
    image: bytea("image").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [check("member_avatar_size_check", sql`octet_length(${table.image}) between 1 and 262144`)],
);

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_user_id_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("account_user_id_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const rateLimit = pgTable("rate_limit", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});

// Fórum

export const forumCategory = pgTable("forum_category", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const forumTopic = pgTable(
  "forum_topic",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    categoryId: integer("category_id")
      .notNull()
      .references(() => forumCategory.id, { onDelete: "restrict" }),
    authorId: text("author_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    replyCount: integer("reply_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastPostAt: timestamp("last_post_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("forum_topic_category_last_post_idx").on(table.categoryId, table.lastPostAt.desc()),
    index("forum_topic_author_idx").on(table.authorId, table.createdAt.desc()),
  ],
);

export const forumPost = pgTable(
  "forum_post",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    topicId: integer("topic_id")
      .notNull()
      .references(() => forumTopic.id, { onDelete: "cascade" }),
    authorId: text("author_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    // O primeiro post de cada tópico é o conteúdo de abertura.
    isOpening: boolean("is_opening").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    editedAt: timestamp("edited_at", { withTimezone: true }),
  },
  (table) => [
    index("forum_post_topic_created_idx").on(table.topicId, table.createdAt),
    index("forum_post_author_created_idx").on(table.authorId, table.createdAt.desc()),
    uniqueIndex("forum_post_one_opening_per_topic")
      .on(table.topicId)
      .where(sql`${table.isOpening}`),
  ],
);

// Publicações editoriais. A visibilidade pública também depende da data,
// para que agendamentos entrem no ar sem um job ou atualização manual.
export const blogPost = pgTable(
  "blog_post",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    excerpt: text("excerpt").notNull(),
    body: text("body").notNull(),
    category: text("category").notNull(),
    status: text("status", { enum: ["draft", "scheduled", "published", "archived"] }).notNull().default("draft"),
    featured: boolean("featured").notNull().default(false),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    focusKeyword: text("focus_keyword"),
    seoNoIndex: boolean("seo_noindex").notNull().default(false),
    coverMediaId: text("cover_media_id"),
    videoUrl: text("video_url"),
    authorId: text("author_id").references(() => user.id, { onDelete: "set null" }),
    authorName: text("author_name").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    revision: integer("revision").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("blog_post_status_published_idx").on(table.status, table.publishedAt.desc()),
    index("blog_post_status_scheduled_idx").on(table.status, table.scheduledAt.desc()),
    index("blog_post_category_idx").on(table.category),
    check("blog_post_category_check", sql`${table.category} in ('estudos', 'empreendedorismo', 'tecnologia', 'ciencias', 'geral', 'atualidades')`),
    check("blog_post_status_check", sql`${table.status} in ('draft', 'scheduled', 'published', 'archived')`),
    check("blog_post_schedule_check", sql`${table.status} <> 'scheduled' or ${table.scheduledAt} is not null`),
    check("blog_post_publish_check", sql`${table.status} <> 'published' or ${table.publishedAt} is not null`),
  ],
);

export const blogPostEvent = pgTable(
  "blog_post_event",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    postId: integer("post_id").notNull().references(() => blogPost.id, { onDelete: "cascade" }),
    actorId: text("actor_id").references(() => user.id, { onDelete: "set null" }),
    actorName: text("actor_name").notNull(),
    action: text("action").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("blog_post_event_post_idx").on(table.postId, table.createdAt.desc())],
);

export const blogMedia = pgTable(
  "blog_media",
  {
    id: text("id").primaryKey(),
    postId: integer("post_id").notNull().references(() => blogPost.id, { onDelete: "cascade" }),
    alt: text("alt").notNull(),
    caption: text("caption"),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    image: bytea("image").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("blog_media_post_idx").on(table.postId, table.createdAt.desc()),
    check("blog_media_size_check", sql`octet_length(${table.image}) between 1 and 2097152`),
    check("blog_media_dimensions_check", sql`${table.width} between 1 and 2000 and ${table.height} between 1 and 2000`),
    check("blog_media_alt_check", sql`length(${table.alt}) between 3 and 160`),
  ],
);

// Privados: acessados apenas pelo servidor. Tokens em claro nunca são persistidos.
export const memberInvitation = pgTable("member_invitation", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  role: text("role", { enum: ["member", "admin"] }).notNull(),
  issuerId: text("issuer_id").notNull().references(() => user.id),
  tokenHash: text("token_hash").notNull().unique(),
  status: text("status", { enum: ["pending", "accepted", "revoked"] }).notNull().default("pending"),
  delivery: text("delivery", { enum: ["sending", "provider_accepted", "unconfirmed"] }).notNull(),
  acceptedBy: text("accepted_by").references(() => user.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
}, (table) => [
  index("member_invitation_created_idx").on(table.createdAt.desc()),
  check("member_invitation_role_check", sql`${table.role} in ('member', 'admin')`),
  check("member_invitation_token_check", sql`${table.tokenHash} ~ '^[a-f0-9]{64}$'`),
  check("member_invitation_status_check", sql`${table.status} in ('pending', 'accepted', 'revoked')`),
  check("member_invitation_delivery_check", sql`${table.delivery} in ('sending', 'provider_accepted', 'unconfirmed')`),
  check("member_invitation_acceptance_check", sql`(${table.status} = 'accepted') = (${table.acceptedBy} is not null and ${table.acceptedAt} is not null)`),
]);
export const memberInvitationEvent = pgTable("member_invitation_event", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  invitationId: text("invitation_id").notNull().references(() => memberInvitation.id),
  actorId: text("actor_id").notNull().references(() => user.id),
  action: text("action").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("member_invitation_event_invitation_idx").on(table.invitationId, table.createdAt),
  check("member_invitation_event_action_check", sql`${table.action} in ('created', 'resent', 'revoked', 'accepted', 'provider_accepted', 'send_unconfirmed')`),
]);
