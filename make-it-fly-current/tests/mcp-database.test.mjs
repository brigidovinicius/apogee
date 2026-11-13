import assert from "node:assert/strict";
import { test } from "node:test";
import { getTableColumns, getTableName } from "drizzle-orm";
import { oauthProvider } from "@better-auth/oauth-provider";
import { runWithRequestState } from "@better-auth/core/context";
import { opportunityLoader } from "./helpers/load-opportunity-module.mjs";
import { mcpTestDatabase } from "./helpers/mcp-test-database.mjs";

const resource = "https://www.apogee.community/mcp";
async function withDb(fn) { const db = await mcpTestDatabase(); try { await runWithRequestState(new Map(), () => fn(db)); } finally { await db.close(); } }

test("MCP migration executes in PostgreSQL and exposes every official provider schema field", async () => withDb(async ({ pg, schema }) => {
  const plugin = oauthProvider({ loginPage: "/login", consentPage: "/consent", disableJwtPlugin: true });
  for (const [model, value] of Object.entries(plugin.schema)) {
    assert.ok(schema[model], model);
    const expected = ["id", ...Object.keys(value.fields)];
    const columns = getTableColumns(schema[model]);
    for (const field of expected) assert.ok(columns[field], `${model}.${field}`);
    const actual = await pg.query("select column_name from information_schema.columns where table_name=$1", [getTableName(schema[model])]);
    for (const field of expected) assert.ok(actual.rows.some(row => row.column_name === columns[field].name), `${model}.${field} SQL`);
  }
}));

test("read-only entitlement SQL preserves owner, verification, payment status and live/test separation", async () => withDb(async ({ pg, sql }) => {
  await pg.exec(`insert into "user" (id,name,email,username) values ('a','Pessoa','a@synthetic.test','pessoa'),('b','Outra','b@synthetic.test','outra');`);
  const load = opportunityLoader({ "@/lib/members/db": { getSql: () => sql } });
  const { radarAccess } = load("lib/billing/store.ts");
  const active = async (id = "a", live = true) => (await radarAccess(id, live, { claimPurchases: false })).active;
  assert.equal(await active(), false);
  await pg.exec("insert into radar_purchase(session_id,email,livemode,status) values ('p','a@synthetic.test',true,'paid')");
  assert.equal(await active(), false, "unverified email cannot inherit a pending purchase");
  await pg.exec('update "user" set email_verified=true where id=\'a\'');
  assert.equal(await active(), true, "verified matching email has its effective website right");
  assert.equal((await pg.query("select user_id from radar_purchase")).rows[0].user_id, null, "MCP does not claim the purchase");
  for (const status of ["refunded", "disputed"]) {
    await pg.query("update radar_purchase set status=$1", [status]); assert.equal(await active(), false, status);
  }
  await pg.exec("update radar_purchase set status='paid',livemode=false");
  assert.equal(await active(), false); assert.equal(await active("a", false), true);
  await pg.exec("update radar_purchase set livemode=true,email='different@synthetic.test'");
  assert.equal(await active(), false, "different email");
  await pg.exec("update radar_purchase set user_id='b',email='a@synthetic.test'");
  assert.equal(await active(), false, "another account owns the purchase"); assert.equal(await active("b"), true);
  await pg.exec("insert into radar_legacy_access values ('a')"); assert.equal(await active(), true);
  await pg.exec("delete from radar_legacy_access; update \"user\" set role='admin' where id='a'"); assert.equal(await active(), true);
  await pg.exec("update \"user\" set blocked=true where id='a'"); assert.equal(await active(), false);
}));

test("revoked OAuth families reject in-flight code or refresh inserts even after reconnection", async () => withDb(async ({ pg, sql }) => {
  await pg.exec(`insert into "user" (id,name,email,username) values ('a','Pessoa','a@synthetic.test','pessoa'),('b','Outra','b@synthetic.test','outra');
    insert into mcp_oauth_client(id,client_id,redirect_uris) values ('c','client',array['https://client.test/callback']);
    insert into mcp_oauth_consent(id,user_id,client_id,resources,scopes,created_at,updated_at)
      values ('ca','a','client',array['${resource}'],array['radar:read'],now(),now()),('cb','b','client',array['${resource}'],array['radar:read'],now(),now());`);
  const load = opportunityLoader({ "@/lib/members/db": { getSql: () => sql },
    "better-auth/api": { getSessionFromCtx: async context => ({ user: { id: context.query.member } }) },
    "./config": { mcpEnabled: () => true, mcpResource: () => resource, MCP_SCOPE: "radar:read" } });
  const { captureMcpConsentSnapshot, registerMcpAuthorizationCode, mcpTokenFamilyActive } = load("lib/mcp/families.ts");
  const capture = member => captureMcpConsentSnapshot({ path: "/oauth2/authorize", query: { client_id: "client", member } });
  const { revokeMcpConnection } = load("lib/mcp/connections.ts");
  const code = (id, userId = "a") => ({ identifier: id, value: JSON.stringify({ type: "authorization_code", resource: [resource], userId, query: { client_id: "client", scope: "radar:read" } }) });
  const insert = (id, family, userId = "a") => pg.query(`insert into mcp_oauth_access_token(id,token,client_id,user_id,authorization_code_id,scopes,created_at,expires_at)
    values ($1,$1,'client',$2,$3,array['radar:read'],now(),now()+interval '15 minutes')`, [id, userId, family]);
  await capture("a"); await registerMcpAuthorizationCode(code("old-code"));
  await capture("b"); await registerMcpAuthorizationCode(code("other-account", "b")); await insert("other-token", "other-account", "b");
  await capture("a");
  await revokeMcpConnection("a", "client");
  await assert.rejects(registerMcpAuthorizationCode(code("delayed-authorize")), /Autorize novamente/);
  // The provider's old request resumes after disconnect and inserts tokens.
  await insert("delayed-code-token", "old-code"); await insert("delayed-refresh-token", "old-code");
  assert.equal(await mcpTokenFamilyActive("delayed-code-token", "a", "client"), false);
  await pg.query(`insert into mcp_oauth_consent(id,user_id,client_id,resources,scopes,created_at,updated_at)
    values ('reconnected','a','client',array[$1],array['radar:read'],now(),now())`, [resource]);
  await assert.rejects(registerMcpAuthorizationCode(code("delayed-authorize-after-reconnect")), /Autorize novamente/);
  await capture("a");
  await registerMcpAuthorizationCode(code("new-code")); await insert("new-token", "new-code");
  assert.equal(await mcpTokenFamilyActive("delayed-code-token", "a", "client"), false);
  assert.equal(await mcpTokenFamilyActive("delayed-refresh-token", "a", "client"), false);
  assert.equal(await mcpTokenFamilyActive("new-token", "a", "client"), true);
  assert.equal(await mcpTokenFamilyActive("other-token", "b", "client"), true);
  assert.equal(await mcpTokenFamilyActive("new-token", "b", "client"), false);
  await assert.rejects(registerMcpAuthorizationCode(code("old-code")), /indisponível/);
}));
