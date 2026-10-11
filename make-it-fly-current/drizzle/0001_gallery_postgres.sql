CREATE TABLE "gallery_photo" (
	"id" text PRIMARY KEY NOT NULL,
	"author" text NOT NULL,
	"instagram" text NOT NULL,
	"anonymous" boolean NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"consent_version" text NOT NULL,
	"consented_at" timestamp with time zone NOT NULL,
	"image" "bytea" NOT NULL,
	CONSTRAINT "gallery_photo_id_valid" CHECK ("gallery_photo"."id" ~ '^[0-9T-Z-]{19,28}-[a-f0-9-]{36}$'),
	CONSTRAINT "gallery_photo_dimensions_valid" CHECK ("gallery_photo"."width" BETWEEN 1 AND 2400 AND "gallery_photo"."height" BETWEEN 1 AND 2400),
	CONSTRAINT "gallery_photo_size_valid" CHECK (octet_length("gallery_photo"."image") BETWEEN 1 AND 3145728),
	CONSTRAINT "gallery_photo_credit_valid" CHECK (("gallery_photo"."anonymous" AND "gallery_photo"."author" = 'Anônimo' AND "gallery_photo"."instagram" = '') OR (NOT "gallery_photo"."anonymous" AND length("gallery_photo"."author") BETWEEN 2 AND 80 AND ("gallery_photo"."instagram" = '' OR "gallery_photo"."instagram" ~ '^[A-Za-z0-9._]{1,30}$')))
);
