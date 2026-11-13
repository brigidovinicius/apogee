-- Additive schema for @better-auth/oauth-provider 1.7.14. No existing data is changed.
CREATE TABLE "mcp_oauth_client" (
  "id" text PRIMARY KEY NOT NULL, "client_id" text NOT NULL UNIQUE,
  "client_secret" text, "client_discovery_id" text, "disabled" boolean DEFAULT false,
  "skip_consent" boolean, "enable_end_session" boolean, "subject_type" text,
  "scopes" text[], "client_credentials_scopes" text[] DEFAULT '{}',
  "user_id" text REFERENCES "user"("id") ON DELETE CASCADE, "reference_id" text,
  "created_at" timestamptz, "updated_at" timestamptz, "name" text, "uri" text, "icon" text,
  "contacts" text[], "tos" text, "policy" text, "software_id" text, "software_version" text, "software_statement" text,
  "redirect_uris" text[] NOT NULL, "post_logout_redirect_uris" text[], "backchannel_logout_uri" text,
  "backchannel_logout_session_required" boolean, "token_endpoint_auth_method" text, "application_type" text,
  "jwks" text, "jwks_uri" text, "grant_types" text[], "response_types" text[], "require_pkce" boolean,
  "dpop_bound_access_tokens" boolean DEFAULT false, "metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "mcp_oauth_resource" (
  "id" text PRIMARY KEY NOT NULL, "identifier" text NOT NULL UNIQUE, "name" text NOT NULL,
  "access_token_ttl" integer, "refresh_token_ttl" integer, "signing_algorithm" text, "signing_key_id" text,
  "allowed_scopes" text[], "custom_claims" jsonb, "dpop_bound_access_tokens_required" boolean DEFAULT false,
  "disabled" boolean DEFAULT false, "created_at" timestamptz, "updated_at" timestamptz,
  "policy_version" integer DEFAULT 1, "metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "mcp_oauth_client_resource" (
  "id" text PRIMARY KEY NOT NULL,
  "client_id" text NOT NULL REFERENCES "mcp_oauth_client"("client_id") ON DELETE CASCADE,
  "resource_id" text NOT NULL REFERENCES "mcp_oauth_resource"("identifier") ON DELETE CASCADE,
  "metadata" jsonb, "created_at" timestamptz
);
--> statement-breakpoint
CREATE UNIQUE INDEX "mcp_oauth_client_resource_pair" ON "mcp_oauth_client_resource"("client_id", "resource_id");
--> statement-breakpoint
CREATE TABLE "mcp_oauth_refresh_token" (
  "id" text PRIMARY KEY NOT NULL, "token" text NOT NULL UNIQUE,
  "client_id" text NOT NULL REFERENCES "mcp_oauth_client"("client_id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "session_id" text REFERENCES "session"("id") ON DELETE SET NULL,
  "reference_id" text, "authorization_code_id" text, "resources" text[], "requested_user_info_claims" text[],
  "scopes" text[] NOT NULL, "expires_at" timestamptz NOT NULL, "created_at" timestamptz NOT NULL,
  "revoked" timestamptz, "confirmation" jsonb, "rotated_at" timestamptz,
  "rotation_replay_response" text, "rotation_replay_expires_at" timestamptz, "auth_time" timestamptz
);
--> statement-breakpoint
CREATE TABLE "mcp_oauth_access_token" (
  "id" text PRIMARY KEY NOT NULL, "token" text NOT NULL UNIQUE,
  "client_id" text NOT NULL REFERENCES "mcp_oauth_client"("client_id") ON DELETE CASCADE,
  "user_id" text REFERENCES "user"("id") ON DELETE CASCADE,
  "session_id" text REFERENCES "session"("id") ON DELETE CASCADE,
  "refresh_id" text REFERENCES "mcp_oauth_refresh_token"("id") ON DELETE CASCADE,
  "reference_id" text, "authorization_code_id" text, "resources" text[], "requested_user_info_claims" text[],
  "scopes" text[] NOT NULL, "expires_at" timestamptz NOT NULL, "created_at" timestamptz NOT NULL,
  "revoked" timestamptz, "confirmation" jsonb
);
--> statement-breakpoint
CREATE TABLE "mcp_oauth_consent" (
  "id" text PRIMARY KEY NOT NULL,
  "client_id" text NOT NULL REFERENCES "mcp_oauth_client"("client_id") ON DELETE CASCADE,
  "user_id" text REFERENCES "user"("id") ON DELETE CASCADE, "reference_id" text,
  "resources" text[], "requested_user_info_claims" text[], "scopes" text[] NOT NULL,
  "created_at" timestamptz NOT NULL, "updated_at" timestamptz NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mcp_oauth_client_assertion" ("id" text PRIMARY KEY NOT NULL, "expires_at" timestamptz NOT NULL);
--> statement-breakpoint
CREATE INDEX "mcp_oauth_client_user_idx" ON "mcp_oauth_client"("user_id");
CREATE INDEX "mcp_oauth_refresh_owner_idx" ON "mcp_oauth_refresh_token"("user_id", "client_id");
CREATE INDEX "mcp_oauth_refresh_session_idx" ON "mcp_oauth_refresh_token"("session_id");
CREATE INDEX "mcp_oauth_refresh_code_idx" ON "mcp_oauth_refresh_token"("authorization_code_id");
CREATE INDEX "mcp_oauth_access_owner_idx" ON "mcp_oauth_access_token"("user_id", "client_id");
CREATE INDEX "mcp_oauth_access_session_idx" ON "mcp_oauth_access_token"("session_id");
CREATE INDEX "mcp_oauth_access_refresh_idx" ON "mcp_oauth_access_token"("refresh_id");
CREATE INDEX "mcp_oauth_access_code_idx" ON "mcp_oauth_access_token"("authorization_code_id");
CREATE INDEX "mcp_oauth_consent_owner_idx" ON "mcp_oauth_consent"("user_id", "client_id");
--> statement-breakpoint
CREATE TABLE "mcp_oauth_family" (
  "id" text PRIMARY KEY NOT NULL, "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "client_id" text NOT NULL REFERENCES "mcp_oauth_client"("client_id") ON DELETE CASCADE,
  "created_at" timestamptz DEFAULT now() NOT NULL, "revoked_at" timestamptz
);
CREATE INDEX "mcp_oauth_family_owner_idx" ON "mcp_oauth_family"("user_id", "client_id");
