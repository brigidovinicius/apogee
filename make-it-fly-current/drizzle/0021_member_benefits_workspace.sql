CREATE TABLE member_benefit_category (
  id text PRIMARY KEY,
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug)<=80),
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  description text NOT NULL DEFAULT '' CHECK (length(description)<=240),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order BETWEEN 0 AND 10000),
  version integer NOT NULL DEFAULT 1 CHECK (version>=1),
  updated_by text NOT NULL REFERENCES "user"(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE member_benefit_organization (
  benefit_id text PRIMARY KEY REFERENCES member_benefit(id) ON DELETE CASCADE,
  category_id text REFERENCES member_benefit_category(id),
  provider_label text NOT NULL DEFAULT '' CHECK (length(provider_label)<=140),
  provider_access text NOT NULL DEFAULT 'unconfirmed' CHECK (provider_access IN ('unconfirmed','free','premium','included')),
  source_url text NOT NULL DEFAULT '' CHECK (length(source_url)<=1000)
);
--> statement-breakpoint
CREATE TABLE member_benefit_saved (
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  benefit_id text NOT NULL REFERENCES member_benefit(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,benefit_id)
);
--> statement-breakpoint
CREATE TABLE member_benefit_redemption (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  benefit_id text NOT NULL REFERENCES member_benefit(id),
  benefit_name text NOT NULL,
  partner_name text NOT NULL,
  terms_revision text NOT NULL,
  status text NOT NULL DEFAULT 'started' CHECK (status IN ('started','confirmed','rejected')),
  started_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by text REFERENCES "user"(id),
  evidence_reference text NOT NULL DEFAULT '' CHECK (length(evidence_reference)<=500),
  UNIQUE(user_id,benefit_id),
  CHECK (status='started' OR (reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL AND length(evidence_reference)>=8))
);
--> statement-breakpoint
CREATE INDEX member_benefit_organization_category_idx ON member_benefit_organization(category_id,benefit_id);
CREATE INDEX member_benefit_redemption_owner_idx ON member_benefit_redemption(user_id,started_at DESC,id);
REVOKE ALL ON member_benefit_category,member_benefit_organization,member_benefit_saved,member_benefit_redemption FROM PUBLIC;
