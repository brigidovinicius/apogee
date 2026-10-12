CREATE TABLE "blog_media" (
	"id" text PRIMARY KEY NOT NULL,
	"post_id" integer NOT NULL,
	"alt" text NOT NULL,
	"caption" text,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"image" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "blog_media_size_check" CHECK (octet_length("blog_media"."image") between 1 and 2097152),
	CONSTRAINT "blog_media_dimensions_check" CHECK ("blog_media"."width" between 1 and 2000 and "blog_media"."height" between 1 and 2000),
	CONSTRAINT "blog_media_alt_check" CHECK (length("blog_media"."alt") between 3 and 160)
);
--> statement-breakpoint
CREATE TABLE "blog_post" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "blog_post_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"excerpt" text NOT NULL,
	"body" text NOT NULL,
	"category" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"seo_title" text,
	"seo_description" text,
	"focus_keyword" text,
	"seo_noindex" boolean DEFAULT false NOT NULL,
	"cover_media_id" text,
	"video_url" text,
	"author_id" text,
	"author_name" text NOT NULL,
	"published_at" timestamp with time zone,
	"scheduled_at" timestamp with time zone,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "blog_post_slug_unique" UNIQUE("slug"),
	CONSTRAINT "blog_post_category_check" CHECK ("blog_post"."category" in ('estudos', 'empreendedorismo', 'tecnologia', 'ciencias', 'geral', 'atualidades')),
	CONSTRAINT "blog_post_status_check" CHECK ("blog_post"."status" in ('draft', 'scheduled', 'published', 'archived')),
	CONSTRAINT "blog_post_schedule_check" CHECK ("blog_post"."status" <> 'scheduled' or "blog_post"."scheduled_at" is not null),
	CONSTRAINT "blog_post_publish_check" CHECK ("blog_post"."status" <> 'published' or "blog_post"."published_at" is not null)
);
--> statement-breakpoint
CREATE TABLE "blog_post_event" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "blog_post_event_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"post_id" integer NOT NULL,
	"actor_id" text,
	"actor_name" text NOT NULL,
	"action" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "blog_media" ADD CONSTRAINT "blog_media_post_id_blog_post_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."blog_post"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_post" ADD CONSTRAINT "blog_post_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_post_event" ADD CONSTRAINT "blog_post_event_post_id_blog_post_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."blog_post"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_post_event" ADD CONSTRAINT "blog_post_event_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "blog_media_post_idx" ON "blog_media" USING btree ("post_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "blog_post_status_published_idx" ON "blog_post" USING btree ("status","published_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "blog_post_status_scheduled_idx" ON "blog_post" USING btree ("status","scheduled_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "blog_post_category_idx" ON "blog_post" USING btree ("category");--> statement-breakpoint
CREATE INDEX "blog_post_event_post_idx" ON "blog_post_event" USING btree ("post_id","created_at" DESC NULLS LAST);