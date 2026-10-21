CREATE TABLE "radar_free_opportunity" (
  "user_id" text PRIMARY KEY NOT NULL,
  "opportunity_id" text NOT NULL,
  "opened_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "radar_free_opportunity_id_check" CHECK ("opportunity_id" ~ '^[A-Za-z0-9_-]{1,200}$'),
  CONSTRAINT "radar_free_opportunity_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE
);
