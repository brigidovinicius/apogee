CREATE TABLE community_customer (
 user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 livemode boolean NOT NULL,
 customer_id text NOT NULL,
 PRIMARY KEY(user_id,livemode),
 UNIQUE(customer_id,livemode)
);
--> statement-breakpoint
CREATE TABLE community_checkout_attempt (
 user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 livemode boolean NOT NULL,
 request_key text NOT NULL,
 return_path text NOT NULL,
 expires_at timestamptz NOT NULL,
 PRIMARY KEY(user_id,livemode)
);
--> statement-breakpoint
CREATE TABLE community_subscription (
 id text PRIMARY KEY,
 user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 customer_id text NOT NULL,
 livemode boolean NOT NULL,
 status text NOT NULL,
 cancel_at_period_end boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX community_subscription_owner_idx ON community_subscription(user_id,livemode);
--> statement-breakpoint
CREATE TABLE community_invoice (
 id text PRIMARY KEY,
 subscription_id text NOT NULL REFERENCES community_subscription(id) ON DELETE CASCADE,
 amount integer NOT NULL CHECK(amount=143880),
 currency text NOT NULL CHECK(currency='brl'),
 period_start timestamptz NOT NULL,
 period_end timestamptz NOT NULL CHECK(period_end>period_start),
 status text NOT NULL CHECK(status IN ('paid','unpaid','refunded','disputed','fraud')),
 fraud_review_required boolean NOT NULL DEFAULT false,
 payment_intent_id text,
 charge_id text,
 updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX community_invoice_access_idx ON community_invoice(subscription_id,period_end);
--> statement-breakpoint
CREATE TABLE community_stripe_event (
 event_id text PRIMARY KEY,
 event_type text NOT NULL,
 processed_at timestamptz NOT NULL DEFAULT now()
);
