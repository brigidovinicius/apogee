CREATE TABLE "store_drop_signup" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "store_drop_signup_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text NOT NULL,
	"consent_version" text NOT NULL,
	"consent_text" text NOT NULL,
	"consented_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "store_drop_signup_email_unique" UNIQUE("email"),
	CONSTRAINT "store_drop_signup_name_check" CHECK (length(trim("store_drop_signup"."name")) between 2 and 120),
	CONSTRAINT "store_drop_signup_phone_check" CHECK ("store_drop_signup"."phone" ~ '^\+?[0-9]{10,15}$'),
	CONSTRAINT "store_drop_signup_email_check" CHECK ("store_drop_signup"."email" = lower(trim("store_drop_signup"."email")) and length("store_drop_signup"."email") between 3 and 254)
);
