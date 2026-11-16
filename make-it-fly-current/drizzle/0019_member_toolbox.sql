-- Additive catalogue. No subscriptions, accounts or Radar grants are changed.
CREATE TABLE member_tool_category (
  id text PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'draft',
  sort_order integer NOT NULL DEFAULT 0,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text REFERENCES "user"(id) ON DELETE SET NULL,
  CONSTRAINT member_tool_category_slug_check CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) <= 80),
  CONSTRAINT member_tool_category_name_check CHECK (length(name) BETWEEN 1 AND 80),
  CONSTRAINT member_tool_category_description_check CHECK (description IS NULL OR length(description) <= 240),
  CONSTRAINT member_tool_category_status_check CHECK (status IN ('draft','published','archived')),
  CONSTRAINT member_tool_category_order_check CHECK (sort_order BETWEEN 0 AND 9999),
  CONSTRAINT member_tool_category_version_check CHECK (version >= 1)
);
CREATE INDEX member_tool_category_catalogue_idx ON member_tool_category(status,sort_order,name);

CREATE TABLE member_tool (
  id text PRIMARY KEY,
  category_id text NOT NULL REFERENCES member_tool_category(id) ON DELETE RESTRICT,
  name text NOT NULL,
  description text NOT NULL,
  url text NOT NULL UNIQUE,
  conditions text,
  status text NOT NULL DEFAULT 'draft',
  sort_order integer NOT NULL DEFAULT 0,
  version integer NOT NULL DEFAULT 1,
  reviewed_at timestamptz,
  reviewed_by text REFERENCES "user"(id) ON DELETE SET NULL,
  updated_by text REFERENCES "user"(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT member_tool_name_check CHECK (length(name) BETWEEN 1 AND 100),
  CONSTRAINT member_tool_description_check CHECK (length(description) BETWEEN 1 AND 280),
  CONSTRAINT member_tool_url_check CHECK (url ~ '^https://[^[:space:]]+$' AND length(url) <= 2048),
  CONSTRAINT member_tool_conditions_check CHECK (conditions IS NULL OR length(conditions) <= 280),
  CONSTRAINT member_tool_status_check CHECK (status IN ('draft','published','archived')),
  CONSTRAINT member_tool_order_check CHECK (sort_order BETWEEN 0 AND 9999),
  CONSTRAINT member_tool_version_check CHECK (version >= 1),
  CONSTRAINT member_tool_review_check CHECK (status <> 'published' OR reviewed_at IS NOT NULL)
);
CREATE INDEX member_tool_catalogue_idx ON member_tool(category_id,status,sort_order,name);
REVOKE ALL ON member_tool_category, member_tool FROM PUBLIC;
