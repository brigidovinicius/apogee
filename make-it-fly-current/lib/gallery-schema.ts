import { sql } from "drizzle-orm";
import { boolean, check, customType, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer }>({ dataType: () => "bytea" });

export const galleryPhoto = pgTable("gallery_photo", {
  id: text("id").primaryKey(),
  author: text("author").notNull(),
  instagram: text("instagram").notNull(),
  anonymous: boolean("anonymous").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  consentVersion: text("consent_version").notNull(),
  consentedAt: timestamp("consented_at", { withTimezone: true }).notNull(),
  image: bytea("image").notNull(),
}, table => [
  check("gallery_photo_id_valid", sql`${table.id} ~ '^[0-9T-Z-]{19,28}-[a-f0-9-]{36}$'`),
  check("gallery_photo_dimensions_valid", sql`${table.width} BETWEEN 1 AND 2400 AND ${table.height} BETWEEN 1 AND 2400`),
  check("gallery_photo_size_valid", sql`octet_length(${table.image}) BETWEEN 1 AND 3145728`),
  check("gallery_photo_credit_valid", sql`(${table.anonymous} AND ${table.author} = 'Anônimo' AND ${table.instagram} = '') OR (NOT ${table.anonymous} AND length(${table.author}) BETWEEN 2 AND 80 AND (${table.instagram} = '' OR ${table.instagram} ~ '^[A-Za-z0-9._]{1,30}$'))`),
]);
