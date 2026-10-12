CREATE TABLE "blog_media" (
	"id" text PRIMARY KEY NOT NULL,
	"post_id" integer NOT NULL,
	"storage_path" text NOT NULL,
	"alt" text NOT NULL,
	"caption" text,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "blog_media_storage_path_unique" UNIQUE("storage_path")
);
--> statement-breakpoint
ALTER TABLE "blog_post" ADD COLUMN "focus_keyword" text;--> statement-breakpoint
ALTER TABLE "blog_post" ADD COLUMN "seo_noindex" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "blog_post" ADD COLUMN "cover_media_id" text;--> statement-breakpoint
ALTER TABLE "blog_post" ADD COLUMN "video_url" text;--> statement-breakpoint
ALTER TABLE "blog_media" ADD CONSTRAINT "blog_media_post_id_blog_post_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."blog_post"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "blog_media_post_idx" ON "blog_media" USING btree ("post_id","created_at" DESC NULLS LAST);