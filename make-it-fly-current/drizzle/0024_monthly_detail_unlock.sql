CREATE TABLE member_monthly_detail_unlock (
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  area text NOT NULL CHECK (area IN ('radar', 'beneficios')),
  period date NOT NULL CHECK (extract(day FROM period) = 1),
  item_id text NOT NULL CHECK (item_id ~ '^[A-Za-z0-9_-]{1,200}$'),
  opened_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, area, period, item_id)
);
