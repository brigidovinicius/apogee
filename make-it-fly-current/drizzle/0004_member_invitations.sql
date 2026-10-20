CREATE TABLE "member_invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"issuer_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"delivery" text NOT NULL,
	"accepted_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	CONSTRAINT "member_invitation_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "member_invitation_role_check" CHECK ("member_invitation"."role" in ('member', 'admin')),
	CONSTRAINT "member_invitation_token_check" CHECK ("member_invitation"."token_hash" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "member_invitation_status_check" CHECK ("member_invitation"."status" in ('pending', 'accepted', 'revoked')),
	CONSTRAINT "member_invitation_delivery_check" CHECK ("member_invitation"."delivery" in ('sending', 'provider_accepted', 'unconfirmed')),
	CONSTRAINT "member_invitation_acceptance_check" CHECK (("member_invitation"."status" = 'accepted') = ("member_invitation"."accepted_by" is not null and "member_invitation"."accepted_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "member_invitation_event" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "member_invitation_event_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"invitation_id" text NOT NULL,
	"actor_id" text NOT NULL,
	"action" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "member_invitation_event_action_check" CHECK ("member_invitation_event"."action" in ('created', 'resent', 'revoked', 'accepted', 'provider_accepted', 'send_unconfirmed'))
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "can_manage_admins" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "blocked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "name_needs_confirmation" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "member_invitation" ADD CONSTRAINT "member_invitation_issuer_id_user_id_fk" FOREIGN KEY ("issuer_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_invitation" ADD CONSTRAINT "member_invitation_accepted_by_user_id_fk" FOREIGN KEY ("accepted_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_invitation_event" ADD CONSTRAINT "member_invitation_event_invitation_id_member_invitation_id_fk" FOREIGN KEY ("invitation_id") REFERENCES "public"."member_invitation"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_invitation_event" ADD CONSTRAINT "member_invitation_event_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "member_invitation_created_idx" ON "member_invitation" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "member_invitation_event_invitation_idx" ON "member_invitation_event" USING btree ("invitation_id","created_at");