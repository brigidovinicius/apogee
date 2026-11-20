import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  customType,
  date,
  index,
  integer,
  jsonb,
  primaryKey,
  smallint,
  pgTable,
  text,
  timestamp,
  uuid,
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
  adultDeclared: boolean("adult_declared").notNull().default(false),
  nameNeedsConfirmation: boolean("name_needs_confirmation").notNull().default(false),
  role: text("role", { enum: ["member", "admin"] }).notNull().default("member"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const monthlyDetailUnlock = pgTable("member_monthly_detail_unlock", {
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  area: text("area", { enum: ["radar", "beneficios"] }).notNull(),
  period: date("period").notNull(),
  itemId: text("item_id").notNull(),
  openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  primaryKey({ columns: [table.userId, table.area, table.period, table.itemId] }),
  check("member_monthly_detail_unlock_area_check", sql`${table.area} in ('radar', 'beneficios')`),
  check("member_monthly_detail_unlock_period_check", sql`extract(day from ${table.period}) = 1`),
  check("member_monthly_detail_unlock_item_id_check", sql`${table.itemId} ~ '^[A-Za-z0-9_-]{1,200}$'`),
]);

export const workshopVoucherBatch = pgTable("workshop_voucher_batch", {
  singleton: boolean("singleton").primaryKey().default(true),
  revision: uuid("revision").notNull(),
  releasedAt: timestamp("released_at", { withTimezone: true }),
  releasedBy: text("released_by").references(() => user.id, { onDelete: "set null" }),
  noticeStartedAt: timestamp("notice_started_at", { withTimezone: true }),
  noticeAcceptedAt: timestamp("notice_accepted_at", { withTimezone: true }),
}, table => [check("workshop_voucher_batch_singleton_check", sql`${table.singleton}`)]);

export const workshopVoucherStock = pgTable("workshop_voucher_stock", {
  slot: smallint("slot").primaryKey(),
  urlEncrypted: text("url_encrypted").notNull(),
}, table => [
  check("workshop_voucher_stock_slot_check", sql`${table.slot} between 1 and 50`),
  check("workshop_voucher_stock_url_encrypted_check", sql`length(${table.urlEncrypted}) > 0`),
]);

export const workshopVoucherAssignment = pgTable("workshop_voucher_assignment", {
  slot: smallint("slot").primaryKey().references(() => workshopVoucherStock.slot),
  email: text("email").notNull().unique(),
  proofNonce: uuid("proof_nonce").notNull().unique(),
  proofHash: text("proof_hash").notNull().unique(),
  memberId: text("member_id").unique().references(() => user.id, { onDelete: "set null" }),
  linkedAt: timestamp("linked_at", { withTimezone: true }),
  openedAt: timestamp("opened_at", { withTimezone: true }),
}, table => [
  check("workshop_voucher_assignment_email_check", sql`${table.email} = lower(btrim(${table.email})) and length(${table.email}) between 3 and 254`),
  check("workshop_voucher_assignment_proof_hash_check", sql`${table.proofHash} ~ '^[a-f0-9]{64}$'`),
  check("workshop_voucher_assignment_member_link_check", sql`${table.memberId} is null or ${table.linkedAt} is not null`),
  check("workshop_voucher_assignment_opened_check", sql`${table.openedAt} is null or ${table.linkedAt} is not null`),
]);

export const radarCalendarFilter=pgTable('radar_calendar_filter',{
  id:text('id').primaryKey(),
  userId:text('user_id').notNull().references(()=>user.id,{onDelete:'cascade'}),
  name:text('name').notNull(),filterQuery:text('filter_query').notNull(),
  updatedAt:timestamp('updated_at',{withTimezone:true}).notNull().defaultNow(),
},table=>[
  uniqueIndex('radar_calendar_filter_owner_name').on(table.userId,sql`lower(${table.name})`),
  check('radar_calendar_filter_name_check',sql`length(btrim(${table.name})) between 1 and 80`),
  check('radar_calendar_filter_query_check',sql`length(${table.filterQuery}) <= 2048`),
]);

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

// Direitos privados do Radar. Compra e acesso anterior são origens diferentes;
// nenhum direito tem data de expiração e nenhum deles concede papel admin.
export const radarLegacyAccess = pgTable("radar_legacy_access", {
  userId: text("user_id").primaryKey().references(() => user.id, { onDelete: "cascade" }),
  grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
});
export const radarFreeOpportunity = pgTable("radar_free_opportunity", {
  userId: text("user_id").primaryKey().references(() => user.id, { onDelete: "cascade" }),
  opportunityId: text("opportunity_id").notNull(),
  openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [check("radar_free_opportunity_id_check", sql`${table.opportunityId} ~ '^[A-Za-z0-9_-]{1,200}$'`)]);
export const radarPurchase = pgTable("radar_purchase", {
  sessionId: text("session_id").primaryKey(),
  paymentIntentId: text("payment_intent_id").notNull().unique(),
  userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
  email: text("email"),
  priceId: text("price_id").notNull(),
  productId: text("product_id").notNull(),
  amount: integer("amount").notNull(),
  currency: text("currency").notNull(),
  livemode: boolean("livemode").notNull(),
  status: text("status", { enum: ["paid", "refunded", "disputed"] }).notNull(),
  providerEventAt: timestamp("provider_event_at", { withTimezone: true }).notNull(),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  index("radar_purchase_user_idx").on(table.userId, table.livemode, table.status),
  index("radar_purchase_unclaimed_idx").on(table.email, table.livemode).where(sql`${table.userId} is null`),
  check("radar_purchase_amount_check", sql`${table.amount} = 4900`),
  check("radar_purchase_currency_check", sql`${table.currency} = 'brl'`),
  check("radar_purchase_status_check", sql`${table.status} in ('paid', 'refunded', 'disputed')`),
]);
export const radarStripeEvent = pgTable("radar_stripe_event", {
  eventId: text("event_id").primaryKey(),
  eventType: text("event_type").notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }).notNull().defaultNow(),
});

// Opt-in exclusivo para novidades dos produtos; não concede conta nem reserva.
export const storeDropSignup = pgTable("store_drop_signup", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  email: text("email").notNull().unique(),
  consentVersion: text("consent_version").notNull(),
  consentText: text("consent_text").notNull(),
  consentedAt: timestamp("consented_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  check("store_drop_signup_name_check", sql`length(trim(${table.name})) between 2 and 120`),
  check("store_drop_signup_phone_check", sql`${table.phone} ~ '^\\+?[0-9]{10,15}$'`),
  check("store_drop_signup_email_check", sql`${table.email} = lower(trim(${table.email})) and length(${table.email}) between 3 and 254`),
]);

export const radarSavedOpportunity = pgTable("radar_saved_opportunity", {
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  opportunityId: text("opportunity_id").notNull(),
  snapshot: jsonb("snapshot").notNull(),
  feedHistory: jsonb("feed_history").notNull().default([]),
  savedAt: timestamp("saved_at", { withTimezone: true }).notNull().defaultNow(),
  removedAt: timestamp("removed_at", { withTimezone: true }),
}, table => [primaryKey({columns:[table.userId,table.opportunityId]}),check("radar_saved_opportunity_opportunity_id_check",sql`${table.opportunityId} ~ '^[A-Za-z0-9_-]{1,200}$'`)]);
export const radarCalendarFeed = pgTable("radar_calendar_feed", {
  userId: text("user_id").primaryKey().references(() => user.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [check("radar_calendar_feed_token_hash_check",sql`${table.tokenHash} ~ '^[a-f0-9]{64}$'`)]);

export const radarGoogleCalendar = pgTable("radar_google_calendar", {
  userId: text("user_id").primaryKey().references(() => user.id, { onDelete: "cascade" }),
  refreshTokenEncrypted: text("refresh_token_encrypted"),
  calendarId: text("calendar_id"),
  connectedAt: timestamp("connected_at", { withTimezone: true }),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  nextSyncAt: timestamp("next_sync_at", { withTimezone: true }).notNull().defaultNow(),
  lastError: text("last_error"),
  consecutiveFailures: integer("consecutive_failures").notNull().default(0),
  retryNotBefore: timestamp("retry_not_before",{withTimezone:true}),
  retryPaused: boolean("retry_paused").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  check("radar_google_calendar_calendar_id_check",sql`${table.calendarId} is null or (${table.calendarId} <> 'primary' and length(${table.calendarId}) between 3 and 1024)`),
  check("radar_google_calendar_last_error_check",sql`${table.lastError} is null or ${table.lastError} in ('reconnect','permission','quota','unavailable','invalid_response','access')`),
  check("radar_google_calendar_consecutive_failures_check",sql`${table.consecutiveFailures} between 0 and 1000000`),
  index("radar_google_calendar_due_idx").on(table.nextSyncAt).where(sql`${table.refreshTokenEncrypted} is not null`),
]);
export const radarGoogleCalendarQueueState=pgTable("radar_google_calendar_queue_state",{
  singleton:boolean("singleton").primaryKey().default(true),
  cooldownUntil:timestamp("cooldown_until",{withTimezone:true}),
  workerSeenAt:timestamp("worker_seen_at",{withTimezone:true}),workerState:text("worker_state"),
},table=>[check("radar_google_calendar_queue_state_singleton_check",sql`${table.singleton}`),
  check("radar_google_calendar_queue_state_worker_state_check",sql`${table.workerState} is null or ${table.workerState} in ('running','ok','failed')`)]);
export const radarGoogleCalendarMetric=pgTable("radar_google_calendar_metric",{
  id:bigint("id",{mode:"number"}).primaryKey().generatedAlwaysAsIdentity(),
  finishedAt:timestamp("finished_at",{withTimezone:true}).notNull().default(sql`clock_timestamp()`),
  durationMs:integer("duration_ms").notNull(),outcome:text("outcome").notNull(),googleCalls:integer("google_calls").notNull(),
  httpErrors:integer("http_errors").notNull(),networkErrors:integer("network_errors").notNull(),quotaResponses:integer("quota_responses").notNull(),eventsChanged:integer("events_changed").notNull(),
},table=>[index("radar_google_calendar_metric_finished_idx").on(table.finishedAt),
  check("radar_google_calendar_metric_duration_ms_check",sql`${table.durationMs}>=0`),
  check("radar_google_calendar_metric_outcome_check",sql`${table.outcome} in ('synced','pending','failed','disconnected','thrown')`),
  check("radar_google_calendar_metric_google_calls_check",sql`${table.googleCalls}>=0`),
  check("radar_google_calendar_metric_http_errors_check",sql`${table.httpErrors}>=0`),
  check("radar_google_calendar_metric_network_errors_check",sql`${table.networkErrors}>=0`),
  check("radar_google_calendar_metric_quota_responses_check",sql`${table.quotaResponses}>=0`),
  check("radar_google_calendar_metric_events_changed_check",sql`${table.eventsChanged}>=0`)]);
export const radarGoogleCalendarOAuth = pgTable("radar_google_calendar_oauth", {
  userId: text("user_id").primaryKey().references(() => user.id, { onDelete: "cascade" }),
  stateHash: text("state_hash").notNull().unique(),
  verifierEncrypted: text("verifier_encrypted").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, table => [check("radar_google_calendar_oauth_state_hash_check",sql`${table.stateHash} ~ '^[a-f0-9]{64}$'`)]);
export const radarGoogleCalendarEvent = pgTable("radar_google_calendar_event", {
  userId: text("user_id").notNull().references(() => radarGoogleCalendar.userId, { onDelete: "cascade" }),
  entryKey: text("entry_key").notNull(),
  eventId: text("event_id").notNull(),
  revision: integer("revision").notNull().default(0),
  contentHash: text("content_hash").notNull(),
  cancelled: boolean("cancelled").notNull().default(false),
}, table => [
  primaryKey({columns:[table.userId,table.entryKey]}),
  check("radar_google_calendar_event_event_id_check",sql`${table.eventId} ~ '^[a-f0-9]{64}$'`),
  check("radar_google_calendar_event_revision_check",sql`${table.revision} >= 0`),
]);

export const memberAdultReview=pgTable("member_adult_review",{
  userId:text("user_id").primaryKey().references(()=>user.id,{onDelete:"cascade"}),
  status:text("status").notNull().default("pending"),
  requestedAt:timestamp("requested_at",{withTimezone:true}).notNull().defaultNow(),
  reviewedAt:timestamp("reviewed_at",{withTimezone:true}),
  reviewerId:text("reviewer_id").references(()=>user.id,{onDelete:"set null"}),
  evidenceReference:text("evidence_reference"),
},table=>[check("member_adult_review_status_check",sql`${table.status} in ('pending','approved','rejected')`),
  check("member_adult_review_check",sql`${table.status} <> 'approved' or (${table.reviewedAt} is not null and ${table.evidenceReference} is not null)`)]);
export const memberDependent=pgTable("member_dependent",{
  id:text("id").primaryKey(),guardianId:text("guardian_id").notNull().references(()=>user.id,{onDelete:"cascade"}),
  nickname:text("nickname").notNull(),ageBand:text("age_band").notNull(),relationship:text("relationship").notNull(),
  status:text("status").notNull().default("pending"),consentVersion:text("consent_version").notNull(),
  consentAt:timestamp("consent_at",{withTimezone:true}).notNull().defaultNow(),
  reviewedAt:timestamp("reviewed_at",{withTimezone:true}),reviewerId:text("reviewer_id").references(()=>user.id,{onDelete:"set null"}),
  evidenceReference:text("evidence_reference"),
},table=>[index("member_dependent_guardian_idx").on(table.guardianId,table.status),
  check("member_dependent_nickname_check",sql`length(${table.nickname}) between 2 and 40`),
  check("member_dependent_age_band_check",sql`${table.ageBand} in ('under_12','12_15','16_17')`),
  check("member_dependent_relationship_check",sql`${table.relationship} in ('parent','legal_guardian')`),
  check("member_dependent_status_check",sql`${table.status} in ('pending','approved','rejected','revoked')`),
  check("member_dependent_check",sql`${table.status} <> 'approved' or (${table.reviewedAt} is not null and ${table.evidenceReference} is not null)`)]);
export const memberProtectionAudit=pgTable("member_protection_audit",{
  id:bigint("id",{mode:"number"}).primaryKey().generatedAlwaysAsIdentity(),
  actorId:text("actor_id").references(()=>user.id,{onDelete:"set null"}),subjectId:text("subject_id").notNull(),action:text("action").notNull(),
  occurredAt:timestamp("occurred_at",{withTimezone:true}).notNull().defaultNow(),
});

export const radarCalendarCollection=pgTable('radar_calendar_collection',{
  id:text('id').primaryKey(),userId:text('user_id').notNull().references(()=>user.id,{onDelete:'cascade'}),
  name:text('name').notNull(),description:text('description').notNull().default(''),cover:text('cover').notNull().default('aurora'),
  visibility:text('visibility').notNull().default('private'),shareToken:text('share_token').unique(),shareVersion:integer('share_version').notNull().default(0),
  createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),updatedAt:timestamp('updated_at',{withTimezone:true}).notNull().defaultNow(),archivedAt:timestamp('archived_at',{withTimezone:true}),
},table=>[
  index('radar_calendar_collection_owner_idx').on(table.userId,table.updatedAt),
  check('radar_calendar_collection_name_check',sql`length(btrim(${table.name})) between 1 and 80`),
  check('radar_calendar_collection_description_check',sql`length(${table.description}) <= 500`),
  check('radar_calendar_collection_cover_check',sql`${table.cover} in ('aurora','oceano','floresta','orbita')`),
  check('radar_calendar_collection_visibility_check',sql`${table.visibility} in ('private','unlisted')`),
  check('radar_calendar_collection_share_token_check',sql`${table.shareToken} is null or ${table.shareToken} ~ '^[a-f0-9]{48}$'`),
  check('radar_calendar_collection_share_version_check',sql`${table.shareVersion}>=0`),
  check('radar_calendar_collection_check',sql`(${table.visibility}='private' and ${table.shareToken} is null) or (${table.visibility}='unlisted' and ${table.shareToken} is not null)`),
  check('radar_calendar_collection_check1',sql`${table.archivedAt} is null or ${table.visibility}='private'`),
]);
export const radarCalendarCollectionItem=pgTable('radar_calendar_collection_item',{
  collectionId:text('collection_id').notNull().references(()=>radarCalendarCollection.id,{onDelete:'cascade'}),opportunityId:text('opportunity_id').notNull(),
  title:text('title').notNull(),addedAt:timestamp('added_at',{withTimezone:true}).notNull().defaultNow(),
},table=>[
  primaryKey({columns:[table.collectionId,table.opportunityId]}),index('radar_calendar_collection_item_opportunity_idx').on(table.opportunityId),
  check('radar_calendar_collection_item_opportunity_id_check',sql`${table.opportunityId} ~ '^radar-[A-Za-z0-9_-]{1,194}$'`),
  check('radar_calendar_collection_item_title_check',sql`length(${table.title})<=500`),
]);

export const radarCalendarFollow=pgTable('radar_calendar_follow',{
  userId:text('user_id').notNull().references(()=>user.id,{onDelete:'cascade'}),
  collectionId:text('collection_id').notNull().references(()=>radarCalendarCollection.id,{onDelete:'cascade'}),
  shareVersion:integer('share_version').notNull(),followedAt:timestamp('followed_at',{withTimezone:true}).notNull().defaultNow(),
  digestEnabled:boolean('digest_enabled').notNull().default(false),consentedAt:timestamp('consented_at',{withTimezone:true}),
  baseline:jsonb('baseline').notNull().default({}),
},table=>[primaryKey({columns:[table.userId,table.collectionId]}),index('radar_calendar_follow_collection_idx').on(table.collectionId),
  check('radar_calendar_follow_share_version_check',sql`${table.shareVersion}>=0`),
  check('radar_calendar_follow_baseline_check',sql`jsonb_typeof(${table.baseline})='object'`),
  check('radar_calendar_follow_check',sql`not ${table.digestEnabled} or ${table.consentedAt} is not null`)]);
export const radarCalendarDigestState=pgTable('radar_calendar_digest_state',{
  userId:text('user_id').primaryKey().references(()=>user.id,{onDelete:'cascade'}),generation:integer('generation').notNull().default(0),
  unsubscribeToken:text('unsubscribe_token').notNull().unique(),nextDueAt:timestamp('next_due_at',{withTimezone:true}).notNull().default(sql`now()+interval '7 days'`),
},table=>[index('radar_calendar_digest_due_idx').on(table.nextDueAt),check('radar_calendar_digest_state_generation_check',sql`${table.generation}>=0`),
  check('radar_calendar_digest_state_unsubscribe_token_check',sql`${table.unsubscribeToken} ~ '^[a-f0-9]{48}$'`)]);
export const radarCalendarDigestJob=pgTable('radar_calendar_digest_job',{
  id:text('id').primaryKey(),userId:text('user_id').notNull().references(()=>user.id,{onDelete:'cascade'}),periodStart:timestamp('period_start',{withTimezone:true}).notNull(),
  generation:integer('generation').notNull(),status:text('status').notNull().default('pending'),payload:jsonb('payload'),attempts:integer('attempts').notNull().default(0),
  createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),nextAttemptAt:timestamp('next_attempt_at',{withTimezone:true}).notNull().defaultNow(),
  leaseToken:text('lease_token'),finishedAt:timestamp('finished_at',{withTimezone:true}),
},table=>[uniqueIndex('radar_calendar_digest_job_user_id_period_start_key').on(table.userId,table.periodStart),
  check('radar_calendar_digest_job_status_check',sql`${table.status} in ('pending','accepted','cancelled','failed','empty')`),
  check('radar_calendar_digest_job_attempts_check',sql`${table.attempts}>=0`)]);
export const radarCalendarDigestBudget=pgTable('radar_calendar_digest_budget',{
  day:date('day').primaryKey(),attempts:integer('attempts').notNull().default(0),
},table=>[check('radar_calendar_digest_budget_attempts_check',sql`${table.attempts}>=0`)]);

// Assinatura anual separada dos direitos vitalícios do Radar.
export const communityCustomer = pgTable("community_customer", {
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  livemode: boolean("livemode").notNull(), customerId: text("customer_id").notNull(),
}, t => [primaryKey({ columns: [t.userId, t.livemode] }), uniqueIndex("community_customer_customer_id_livemode_key").on(t.customerId,t.livemode)]);
export const communityCheckoutAttempt = pgTable("community_checkout_attempt", {
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  livemode: boolean("livemode").notNull(), requestKey: text("request_key").notNull(),
  returnPath: text("return_path").notNull(), expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, t => [primaryKey({ columns: [t.userId,t.livemode] })]);
export const communitySubscription = pgTable("community_subscription", {
  id: text("id").primaryKey(), userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  customerId: text("customer_id").notNull(), livemode: boolean("livemode").notNull(), status: text("status").notNull(),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [index("community_subscription_owner_idx").on(t.userId,t.livemode)]);
export const communityInvoice = pgTable("community_invoice", {
  id: text("id").primaryKey(), subscriptionId: text("subscription_id").notNull().references(() => communitySubscription.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(), currency: text("currency").notNull(),
  periodStart: timestamp("period_start", { withTimezone: true }).notNull(), periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
  status: text("status").notNull(), fraudReviewRequired: boolean("fraud_review_required").notNull().default(false),
  paymentIntentId: text("payment_intent_id"), chargeId: text("charge_id"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [index("community_invoice_access_idx").on(t.subscriptionId,t.periodEnd),
  check("community_invoice_amount_check",sql`${t.amount}=143880`), check("community_invoice_currency_check",sql`${t.currency}='brl'`),
  check("community_invoice_period_end_check",sql`${t.periodEnd}>${t.periodStart}`),
  check("community_invoice_status_check",sql`${t.status} in ('paid','unpaid','refunded','disputed','fraud')`)]);
export const communityStripeEvent = pgTable("community_stripe_event", {
  eventId: text("event_id").primaryKey(), eventType: text("event_type").notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }).notNull().defaultNow(),
});
export const radarFreeEvent = pgTable("radar_free_event", {
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  opportunityId: text("opportunity_id").notNull(), slot: smallint("slot").notNull(),
  openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [primaryKey({ columns: [t.userId,t.opportunityId] }),uniqueIndex("radar_free_event_user_id_slot_key").on(t.userId,t.slot),
  check("radar_free_event_opportunity_id_check",sql`${t.opportunityId} ~ '^[A-Za-z0-9_-]{1,200}$'`),
  check("radar_free_event_slot_check",sql`${t.slot} between 1 and 10`)]);

export const memberToolCategory = pgTable("member_tool_category", {
  id:text("id").primaryKey(),slug:text("slug").notNull().unique(),name:text("name").notNull(),description:text("description"),
  status:text("status").notNull().default("draft"),sortOrder:integer("sort_order").notNull().default(0),version:integer("version").notNull().default(1),
  createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),updatedAt:timestamp("updated_at",{withTimezone:true}).notNull().defaultNow(),
  updatedBy:text("updated_by").references(()=>user.id,{onDelete:"set null"}),
},t=>[index("member_tool_category_catalogue_idx").on(t.status,t.sortOrder,t.name),
  check("member_tool_category_slug_check",sql`${t.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(${t.slug})<=80`),
  check("member_tool_category_name_check",sql`length(${t.name}) between 1 and 80`),check("member_tool_category_description_check",sql`${t.description} is null or length(${t.description})<=240`),
  check("member_tool_category_status_check",sql`${t.status} in ('draft','published','archived')`),check("member_tool_category_order_check",sql`${t.sortOrder} between 0 and 9999`),check("member_tool_category_version_check",sql`${t.version}>=1`)]);
export const memberTool = pgTable("member_tool", {
  id:text("id").primaryKey(),categoryId:text("category_id").notNull().references(()=>memberToolCategory.id,{onDelete:"restrict"}),
  name:text("name").notNull(),description:text("description").notNull(),url:text("url").notNull().unique(),conditions:text("conditions"),
  status:text("status").notNull().default("draft"),sortOrder:integer("sort_order").notNull().default(0),version:integer("version").notNull().default(1),
  reviewedAt:timestamp("reviewed_at",{withTimezone:true}),reviewedBy:text("reviewed_by").references(()=>user.id,{onDelete:"set null"}),
  updatedBy:text("updated_by").references(()=>user.id,{onDelete:"set null"}),
  createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),updatedAt:timestamp("updated_at",{withTimezone:true}).notNull().defaultNow(),
},t=>[index("member_tool_catalogue_idx").on(t.categoryId,t.status,t.sortOrder,t.name),
  check("member_tool_name_check",sql`length(${t.name}) between 1 and 100`),check("member_tool_description_check",sql`length(${t.description}) between 1 and 280`),
  check("member_tool_url_check",sql`${t.url} ~ '^https://[^[:space:]]+$' and length(${t.url})<=2048`),check("member_tool_conditions_check",sql`${t.conditions} is null or length(${t.conditions})<=280`),
  check("member_tool_status_check",sql`${t.status} in ('draft','published','archived')`),check("member_tool_order_check",sql`${t.sortOrder} between 0 and 9999`),
  check("member_tool_version_check",sql`${t.version}>=1`),check("member_tool_review_check",sql`${t.status}<>'published' or ${t.reviewedAt} is not null`)]);

// Member deliverables stay separate from legacy Radar rights and payment ledgers.
const editorialColumns = () => ({
  status: text("status").notNull().default("draft"), sortOrder: integer("sort_order").notNull().default(0),
  reviewedBy: text("reviewed_by").notNull().references(() => user.id), reviewedAt: timestamp("reviewed_at", { withTimezone: true }).notNull().defaultNow(),
});
export const memberBenefit = pgTable("member_benefit", {
  id: text("id").primaryKey(), name: text("name").notNull(), partner: text("partner").notNull(), description: text("description").notNull(),
  evidenceUrl: text("evidence_url").notNull().default(""), eligibility: text("eligibility").notNull().default(""), availability: text("availability").notNull().default(""),
  startsAt: timestamp("starts_at", { withTimezone: true }), endsAt: timestamp("ends_at", { withTimezone: true }),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  audience: text("audience").notNull().default("geral"),
  redemption: text("redemption").notNull().default(""), redemptionUrl: text("redemption_url").notNull().default(""), ...editorialColumns(),
}, t => [check("member_benefit_status_check", sql`${t.status} in ('draft','published','archived')`), check("member_benefit_sort_order_check", sql`${t.sortOrder} between 0 and 10000`),
  check("member_benefit_check", sql`${t.endsAt} is null or ${t.startsAt} is null or ${t.endsAt}>${t.startsAt}`),
  check("member_benefit_check1", sql`${t.status}<>'published' or (length(${t.evidenceUrl})>0 and length(${t.eligibility})>0 and length(${t.availability})>0 and length(${t.redemption})>0 and ((${t.startsAt} is not null and ${t.endsAt} is not null) or (${t.verifiedAt} is not null and length(${t.redemptionUrl})>0)))`),
  check("member_benefit_verification_mode", sql`${t.verifiedAt} is null or (${t.startsAt} is null and ${t.endsAt} is null)`),
  check("member_benefit_audience_check", sql`${t.audience} in ('geral','estudantes','startups','organizacoes-sem-fins-lucrativos')`)]);
export const memberBenefitMonitor = pgTable("member_benefit_monitor", {
  benefitId: text("benefit_id").primaryKey().references(() => memberBenefit.id, { onDelete: "cascade" }),
  receiptRevision: text("receipt_revision").notNull(),
  outcome: text("outcome").notNull(),
  reason: text("reason").notNull(),
  checkedAt: timestamp("checked_at", { withTimezone: true }).notNull(),
  lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
}, t => [
  check("member_benefit_monitor_receipt_revision_check", sql`${t.receiptRevision} ~ '^[0-9a-f]{32}$'`),
  check("member_benefit_monitor_outcome_check", sql`${t.outcome} in ('verified','temporary','unavailable','review')`),
  check("member_benefit_monitor_check", sql`${t.lastSuccessAt} is null or ${t.lastSuccessAt} <= ${t.checkedAt}`),
]);
export const memberBenefitCategory = pgTable("member_benefit_category", {
  id: text("id").primaryKey(), slug: text("slug").notNull().unique(), name: text("name").notNull(), description: text("description").notNull().default(""),
  status: text("status").notNull().default("draft"), sortOrder: integer("sort_order").notNull().default(0), version: integer("version").notNull().default(1),
  updatedBy: text("updated_by").notNull().references(() => user.id), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [check("member_benefit_category_slug_check", sql`${t.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(${t.slug})<=80`),
  check("member_benefit_category_name_check", sql`length(${t.name}) between 1 and 80`), check("member_benefit_category_description_check", sql`length(${t.description})<=240`),
  check("member_benefit_category_status_check", sql`${t.status} in ('draft','published','archived')`), check("member_benefit_category_sort_order_check", sql`${t.sortOrder} between 0 and 10000`), check("member_benefit_category_version_check", sql`${t.version}>=1`)]);
export const memberBenefitOrganization = pgTable("member_benefit_organization", {
  benefitId: text("benefit_id").primaryKey().references(() => memberBenefit.id, { onDelete: "cascade" }), categoryId: text("category_id").references(() => memberBenefitCategory.id),
  providerLabel: text("provider_label").notNull().default(""), providerAccess: text("provider_access").notNull().default("unconfirmed"), sourceUrl: text("source_url").notNull().default(""),
}, t => [index("member_benefit_organization_category_idx").on(t.categoryId, t.benefitId), check("member_benefit_organization_provider_label_check", sql`length(${t.providerLabel})<=140`),
  check("member_benefit_organization_provider_access_check", sql`${t.providerAccess} in ('unconfirmed','free','premium','included')`), check("member_benefit_organization_source_url_check", sql`length(${t.sourceUrl})<=1000`)]);
export const memberBenefitSaved = pgTable("member_benefit_saved", {
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }), benefitId: text("benefit_id").notNull().references(() => memberBenefit.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [primaryKey({ columns: [t.userId, t.benefitId] })]);
export const memberBenefitRedemption = pgTable("member_benefit_redemption", {
  id: text("id").primaryKey(), userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }), benefitId: text("benefit_id").notNull().references(() => memberBenefit.id),
  benefitName: text("benefit_name").notNull(), partnerName: text("partner_name").notNull(), termsRevision: text("terms_revision").notNull(), status: text("status").notNull().default("started"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(), reviewedAt: timestamp("reviewed_at", { withTimezone: true }), reviewedBy: text("reviewed_by").references(() => user.id), evidenceReference: text("evidence_reference").notNull().default(""),
}, t => [uniqueIndex("member_benefit_redemption_user_id_benefit_id_key").on(t.userId, t.benefitId), index("member_benefit_redemption_owner_idx").on(t.userId, t.startedAt.desc(), t.id),
  check("member_benefit_redemption_status_check", sql`${t.status} in ('started','confirmed','rejected')`), check("member_benefit_redemption_evidence_reference_check", sql`length(${t.evidenceReference})<=500`),
  check("member_benefit_redemption_check", sql`${t.status}='started' or (${t.reviewedAt} is not null and ${t.reviewedBy} is not null and length(${t.evidenceReference})>=8)`)]);
export const memberLearningTrack = pgTable("member_learning_track", {
  id: text("id").primaryKey(), name: text("name").notNull(), description: text("description").notNull(), ...editorialColumns(),
}, t => [check("member_learning_track_status_check", sql`${t.status} in ('draft','published','preparing','archived')`), check("member_learning_track_sort_order_check", sql`${t.sortOrder} between 0 and 10000`)]);
export const memberLearningModule = pgTable("member_learning_module", {
  id: text("id").primaryKey(), trackId: text("track_id").notNull().references(() => memberLearningTrack.id), name: text("name").notNull(),
  description: text("description").notNull(), deliverable: text("deliverable").notNull(), ...editorialColumns(),
}, t => [index("member_learning_module_track_order").on(t.trackId, t.sortOrder, t.id), check("member_learning_module_status_check", sql`${t.status} in ('draft','published','preparing','archived')`), check("member_learning_module_sort_order_check", sql`${t.sortOrder} between 0 and 10000`)]);
export const memberLearningActivity = pgTable("member_learning_activity", {
  id: text("id").primaryKey(), moduleId: text("module_id").notNull().references(() => memberLearningModule.id), name: text("name").notNull(),
  instructions: text("instructions").notNull(), resourceUrl: text("resource_url").notNull().default(""), ...editorialColumns(),
}, t => [index("member_learning_activity_module_order").on(t.moduleId, t.sortOrder, t.id), check("member_learning_activity_status_check", sql`${t.status} in ('draft','published','preparing','archived')`), check("member_learning_activity_sort_order_check", sql`${t.sortOrder} between 0 and 10000`)]);
export const memberLearningProgress = pgTable("member_learning_progress", {
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }), activityId: text("activity_id").notNull().references(() => memberLearningActivity.id),
  completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [primaryKey({ columns: [t.userId, t.activityId] })]);
export const memberDeliverableAudit = pgTable("member_deliverable_audit", {
  id: text("id").primaryKey(), actorId: text("actor_id").notNull().references(() => user.id), entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(), action: text("action").notNull(), status: text("status").notNull(), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [check("member_deliverable_audit_entity_type_check", sql`${t.entityType} in ('benefit','track','module','activity')`), check("member_deliverable_audit_action_check", sql`${t.action} in ('create','update')`)]);
