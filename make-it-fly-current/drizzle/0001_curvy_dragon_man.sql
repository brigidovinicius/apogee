CREATE TABLE "hexclave_identity" (
	"hexclave_user_id" text PRIMARY KEY NOT NULL,
	"member_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hexclave_identity_member_id_unique" UNIQUE("member_id")
);
--> statement-breakpoint
ALTER TABLE "hexclave_identity" ADD CONSTRAINT "hexclave_identity_member_id_user_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;