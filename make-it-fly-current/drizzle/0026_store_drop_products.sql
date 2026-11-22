ALTER TABLE "store_drop_signup" ADD COLUMN "product_slugs" text[] DEFAULT '{}'::text[] NOT NULL;
