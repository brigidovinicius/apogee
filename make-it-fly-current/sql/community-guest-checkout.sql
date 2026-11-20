-- Additive, isolated from the ordered Drizzle journal. Apply before enabling guest checkout.
CREATE TABLE community_guest_checkout (
 id uuid PRIMARY KEY,
 livemode boolean NOT NULL,
 return_path text NOT NULL,
 customer_id text UNIQUE,
 session_id text UNIQUE,
 email text,
 status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','complete','expired')),
 user_id text REFERENCES "user"(id) ON DELETE SET NULL,
 expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 claimed_at timestamptz
);
CREATE INDEX community_guest_checkout_email_idx ON community_guest_checkout(email,livemode) WHERE status='complete';
CREATE INDEX community_guest_checkout_user_idx ON community_guest_checkout(user_id,livemode) WHERE user_id IS NOT NULL;
REVOKE ALL ON community_guest_checkout FROM PUBLIC;
