CREATE TABLE "member_avatar" (
	"user_id" text PRIMARY KEY NOT NULL,
	"image" "bytea" NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "member_avatar_size_check" CHECK (octet_length("member_avatar"."image") between 1 and 262144)
);
--> statement-breakpoint
ALTER TABLE "member_avatar" ADD CONSTRAINT "member_avatar_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;