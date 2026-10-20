CREATE TABLE "radar_legacy_access" (
	"user_id" text PRIMARY KEY NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "radar_purchase" (
	"session_id" text PRIMARY KEY NOT NULL,
	"payment_intent_id" text NOT NULL,
	"user_id" text,
	"email" text,
	"price_id" text NOT NULL,
	"product_id" text NOT NULL,
	"amount" integer NOT NULL,
	"currency" text NOT NULL,
	"livemode" boolean NOT NULL,
	"status" text NOT NULL,
	"provider_event_at" timestamp with time zone NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "radar_purchase_payment_intent_id_unique" UNIQUE("payment_intent_id"),
	CONSTRAINT "radar_purchase_amount_check" CHECK ("radar_purchase"."amount" = 4900),
	CONSTRAINT "radar_purchase_currency_check" CHECK ("radar_purchase"."currency" = 'brl'),
	CONSTRAINT "radar_purchase_status_check" CHECK ("radar_purchase"."status" in ('paid', 'refunded', 'disputed'))
);
--> statement-breakpoint
CREATE TABLE "radar_stripe_event" (
	"event_id" text PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "radar_legacy_access" ADD CONSTRAINT "radar_legacy_access_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "radar_purchase" ADD CONSTRAINT "radar_purchase_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "radar_purchase_user_idx" ON "radar_purchase" USING btree ("user_id","livemode","status");--> statement-breakpoint
CREATE INDEX "radar_purchase_unclaimed_idx" ON "radar_purchase" USING btree ("email","livemode") WHERE "radar_purchase"."user_id" is null;
--> statement-breakpoint
-- Preserva o acesso anterior sem inventar compra, pagamento ou receita.
INSERT INTO "radar_legacy_access" ("user_id") SELECT "id" FROM "user";
