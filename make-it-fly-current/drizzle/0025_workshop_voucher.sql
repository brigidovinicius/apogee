CREATE TABLE workshop_voucher_batch (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  revision uuid NOT NULL,
  released_at timestamptz,
  released_by text REFERENCES "user"(id) ON DELETE SET NULL,
  notice_started_at timestamptz,
  notice_accepted_at timestamptz
);
--> statement-breakpoint
INSERT INTO workshop_voucher_batch (revision) VALUES (gen_random_uuid());
--> statement-breakpoint
CREATE TABLE workshop_voucher_stock (
  slot smallint PRIMARY KEY CHECK (slot BETWEEN 1 AND 50),
  url_encrypted text NOT NULL CHECK (length(url_encrypted) > 0)
);
--> statement-breakpoint
CREATE TABLE workshop_voucher_assignment (
  slot smallint PRIMARY KEY REFERENCES workshop_voucher_stock(slot),
  email text NOT NULL UNIQUE CHECK (email = lower(btrim(email)) AND length(email) BETWEEN 3 AND 254),
  proof_nonce uuid NOT NULL UNIQUE,
  proof_hash text NOT NULL UNIQUE CHECK (proof_hash ~ '^[a-f0-9]{64}$'),
  member_id text UNIQUE REFERENCES "user"(id) ON DELETE SET NULL,
  linked_at timestamptz,
  opened_at timestamptz,
  CONSTRAINT workshop_voucher_assignment_member_link_check CHECK (member_id IS NULL OR linked_at IS NOT NULL),
  CONSTRAINT workshop_voucher_assignment_opened_check CHECK (opened_at IS NULL OR linked_at IS NOT NULL)
);
