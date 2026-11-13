import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { session, user } from "@/lib/members/schema";

// Field keys follow @better-auth/oauth-provider 1.7.14; SQL names stay private
// to this integration. No changes to existing user/session table layouts.
const date = (name: string) => timestamp(name, { withTimezone: true });
const strings = (name: string) => text(name).array();
export const oauthClient = pgTable("mcp_oauth_client", {
  id: text("id").primaryKey(), clientId: text("client_id").notNull().unique(),
  clientSecret: text("client_secret"), clientDiscoveryId: text("client_discovery_id"),
  disabled: boolean("disabled").default(false), skipConsent: boolean("skip_consent"),
  enableEndSession: boolean("enable_end_session"), subjectType: text("subject_type"),
  scopes: strings("scopes"), clientCredentialsScopes: strings("client_credentials_scopes").default([]),
  userId: text("user_id").references(() => user.id, { onDelete: "cascade" }), referenceId: text("reference_id"),
  createdAt: date("created_at"), updatedAt: date("updated_at"), name: text("name"), uri: text("uri"),
  icon: text("icon"), contacts: strings("contacts"), tos: text("tos"), policy: text("policy"),
  softwareId: text("software_id"), softwareVersion: text("software_version"), softwareStatement: text("software_statement"),
  redirectUris: strings("redirect_uris").notNull(), postLogoutRedirectUris: strings("post_logout_redirect_uris"),
  backchannelLogoutUri: text("backchannel_logout_uri"), backchannelLogoutSessionRequired: boolean("backchannel_logout_session_required"),
  tokenEndpointAuthMethod: text("token_endpoint_auth_method"), applicationType: text("application_type"),
  jwks: text("jwks"), jwksUri: text("jwks_uri"), grantTypes: strings("grant_types"), responseTypes: strings("response_types"),
  requirePKCE: boolean("require_pkce"), dpopBoundAccessTokens: boolean("dpop_bound_access_tokens").default(false),
  metadata: jsonb("metadata"),
}, table => [index("mcp_oauth_client_user_idx").on(table.userId)]);

export const oauthResource = pgTable("mcp_oauth_resource", {
  id: text("id").primaryKey(), identifier: text("identifier").notNull().unique(), name: text("name").notNull(),
  accessTokenTtl: integer("access_token_ttl"), refreshTokenTtl: integer("refresh_token_ttl"),
  signingAlgorithm: text("signing_algorithm"), signingKeyId: text("signing_key_id"),
  allowedScopes: strings("allowed_scopes"), customClaims: jsonb("custom_claims"),
  dpopBoundAccessTokensRequired: boolean("dpop_bound_access_tokens_required").default(false),
  disabled: boolean("disabled").default(false), createdAt: date("created_at"), updatedAt: date("updated_at"),
  policyVersion: integer("policy_version").default(1), metadata: jsonb("metadata"),
});
export const oauthClientResource = pgTable("mcp_oauth_client_resource", {
  id: text("id").primaryKey(),
  clientId: text("client_id").notNull().references(() => oauthClient.clientId, { onDelete: "cascade" }),
  resourceId: text("resource_id").notNull().references(() => oauthResource.identifier, { onDelete: "cascade" }),
  metadata: jsonb("metadata"), createdAt: date("created_at"),
}, table => [uniqueIndex("mcp_oauth_client_resource_pair").on(table.clientId, table.resourceId)]);

function tokenFields() {
  return {
    id: text("id").primaryKey(), token: text("token").notNull().unique(),
    clientId: text("client_id").notNull().references(() => oauthClient.clientId, { onDelete: "cascade" }),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    referenceId: text("reference_id"), authorizationCodeId: text("authorization_code_id"),
    resources: strings("resources"), requestedUserInfoClaims: strings("requested_user_info_claims"),
    scopes: strings("scopes").notNull(), expiresAt: date("expires_at").notNull(), createdAt: date("created_at").notNull(),
    revoked: date("revoked"), confirmation: jsonb("confirmation"),
  };
}
export const oauthRefreshToken = pgTable("mcp_oauth_refresh_token", {
  ...tokenFields(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  sessionId: text("session_id").references(() => session.id, { onDelete: "set null" }),
  rotatedAt: date("rotated_at"), rotationReplayResponse: text("rotation_replay_response"),
  rotationReplayExpiresAt: date("rotation_replay_expires_at"), authTime: date("auth_time"),
}, table => [index("mcp_oauth_refresh_owner_idx").on(table.userId, table.clientId), index("mcp_oauth_refresh_session_idx").on(table.sessionId),
  index("mcp_oauth_refresh_code_idx").on(table.authorizationCodeId)]);
export const oauthAccessToken = pgTable("mcp_oauth_access_token", {
  ...tokenFields(),
  // Deleting a session must invalidate its access tokens even on direct DB deletion.
  sessionId: text("session_id").references(() => session.id, { onDelete: "cascade" }),
  refreshId: text("refresh_id").references(() => oauthRefreshToken.id, { onDelete: "cascade" }),
}, table => [index("mcp_oauth_access_owner_idx").on(table.userId, table.clientId), index("mcp_oauth_access_session_idx").on(table.sessionId),
  index("mcp_oauth_access_refresh_idx").on(table.refreshId), index("mcp_oauth_access_code_idx").on(table.authorizationCodeId)]);
export const oauthConsent = pgTable("mcp_oauth_consent", {
  id: text("id").primaryKey(),
  clientId: text("client_id").notNull().references(() => oauthClient.clientId, { onDelete: "cascade" }),
  userId: text("user_id").references(() => user.id, { onDelete: "cascade" }), referenceId: text("reference_id"),
  resources: strings("resources"), requestedUserInfoClaims: strings("requested_user_info_claims"),
  scopes: strings("scopes").notNull(), createdAt: date("created_at").notNull(), updatedAt: date("updated_at").notNull(),
}, table => [index("mcp_oauth_consent_owner_idx").on(table.userId, table.clientId)]);
export const oauthClientAssertion = pgTable("mcp_oauth_client_assertion", {
  id: text("id").primaryKey(), expiresAt: date("expires_at").notNull(),
});

// Application-owned immutable OAuth family records. Never reactivate revoked IDs.
export const mcpOAuthFamily = pgTable("mcp_oauth_family", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  clientId: text("client_id").notNull().references(() => oauthClient.clientId, { onDelete: "cascade" }),
  createdAt: date("created_at").notNull().defaultNow(), revokedAt: date("revoked_at"),
}, table => [index("mcp_oauth_family_owner_idx").on(table.userId, table.clientId)]);
