CREATE TABLE radar_calendar_collection (
 id text PRIMARY KEY,
 user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 80),
 description text NOT NULL DEFAULT '' CHECK (length(description) <= 500),
 cover text NOT NULL DEFAULT 'aurora' CHECK (cover IN ('aurora','oceano','floresta','orbita')),
 visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','unlisted')),
 share_token text UNIQUE CHECK (share_token IS NULL OR share_token ~ '^[a-f0-9]{48}$'),
 share_version integer NOT NULL DEFAULT 0 CHECK (share_version >= 0),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 archived_at timestamptz,
 CHECK ((visibility='private' AND share_token IS NULL) OR (visibility='unlisted' AND share_token IS NOT NULL)),
 CHECK (archived_at IS NULL OR visibility='private')
);
CREATE INDEX radar_calendar_collection_owner_idx ON radar_calendar_collection(user_id,updated_at DESC);
--> statement-breakpoint
CREATE TABLE radar_calendar_collection_item (
 collection_id text NOT NULL REFERENCES radar_calendar_collection(id) ON DELETE CASCADE,
 opportunity_id text NOT NULL CHECK (opportunity_id ~ '^radar-[A-Za-z0-9_-]{1,194}$'),
 title text NOT NULL CHECK (length(title) <= 500),
 added_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(collection_id,opportunity_id)
);
CREATE INDEX radar_calendar_collection_item_opportunity_idx ON radar_calendar_collection_item(opportunity_id);
