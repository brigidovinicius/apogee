// Somente banco descartável explícito; nunca lê DATABASE_URL nem envia e-mails.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as betterAuthPackage from "better-auth";
import { opportunityLoader } from "./helpers/load-opportunity-module.mjs";

const url = process.env.PASSWORD_RECOVERY_TEST_DATABASE_URL;
const local = "postgres://apogee_test@127.0.0.1:55447/postgres";
const ci = "postgres://gallery_test:synthetic_ci_only@127.0.0.1:5432/apogee_gallery_ci";
if (url !== local && !(process.env.CI === "true" && url === ci)) throw new Error("Use somente o PostgreSQL descartável de recuperação ou CI.");
const testSchema = `password_recovery_${Date.now()}`;
const setup = postgres(url, { ssl: false, max: 1 });
await setup`create schema ${setup(testSchema)}`;
await setup.end();
const sql = postgres(url, { ssl: false, max: 5, onnotice: () => {}, connection: { search_path: testSchema } });
const originalEnv = { ...process.env };
Object.assign(process.env, {
  NODE_ENV: "production", APPLICATION_HOSTING_PROVIDER: "caddy",
  BETTER_AUTH_URL: "https://www.apogee.community",
  BETTER_AUTH_SECRET: "isolated-password-recovery-secret-over-32-chars",
  MEMBERS_EMAIL_ENABLED: "true", MEMBERS_RESEND_DOMAIN_VERIFIED: "true",
  MEMBERS_RESEND_API_KEY: "re_synthetic_no_network", MEMBERS_RESEND_FROM: "contato@apogee.community",
  RADAR_BILLING_ENABLED: "false",
});
const origin = process.env.BETTER_AUTH_URL;
const emails = [], deferred = [];
let failMail = false, config, auth, db;
const originalFetch = globalThis.fetch;
globalThis.fetch = async (target, options) => {
  assert.equal(target, "https://api.resend.com/emails", "rede externa proibida");
  if (failMail) return Response.json({}, { status: 503 });
  emails.push(JSON.parse(options.body));
  return Response.json({ id: `synthetic-${emails.length}` });
};
const load = opportunityLoader({
  "./db": { getDb: () => db },
  "better-auth": { ...betterAuthPackage, betterAuth: options => { config = options; return betterAuthPackage.betterAuth(options); } },
  "next/server": { after: callback => { deferred.push(callback); } },
  "better-auth/next-js": { nextCookies: () => ({ id: "test-no-next-cookies" }) },
});
const schema = load("lib/members/schema.ts");
db = drizzle(sql, { schema });
const oldPassword = "Old-synthetic-password-123!", newPassword = "New-synthetic-password-456!";
async function call(path, body, cookie, ip = "198.51.100.1") {
  return auth.handler(new Request(`${origin}/api/auth/${path}`, {
    method: "POST", headers: { Origin: origin, "Content-Type": "application/json", "x-apogee-client-ip": ip, ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  }));
}
async function drain() { while (deferred.length) await deferred.shift()(); }
async function clearLimits() { await sql`delete from rate_limit`; }
function tokenIdentifier(token) { return createHash("sha256").update(`reset-password:${token}`).digest("base64url"); }
async function request(email = "member@example.test", next = "/admin/posts?pagina=2#fim") {
  await clearLimits();
  const response = await call("request-password-reset", { email, redirectTo: `${origin}/membros/redefinir-senha?next=${encodeURIComponent(next)}` });
  assert.equal(response.status, 200, await response.clone().text());
  await drain();
  const link = emails.at(-1).text.match(/https:\/\/\S+/)[0];
  return { response, link, token: new URL(link).pathname.split("/").at(-1) };
}
async function login(password = oldPassword) {
  const response = await call("sign-in/email", { email: "member@example.test", password });
  return { response, cookie: response.headers.get("set-cookie")?.split(";")[0] };
}

test("recuperação com Better Auth real e PostgreSQL descartável", async t => {
  try {
    const journal = JSON.parse(await readFile(new URL("../drizzle/meta/_journal.json", import.meta.url), "utf8"));
    for (const entry of journal.entries) {
      await sql.unsafe((await readFile(new URL(`../drizzle/${entry.tag}.sql`, import.meta.url), "utf8")).replaceAll('"public".', `"${testSchema}".`));
    }
    delete globalThis.__apogeeMembersAuth;
    auth = load("lib/members/auth.ts").getAuth();
    const signup = await call("sign-up/email", { email: "member@example.test", username: "syntheticmember", name: "Ana M.", password: oldPassword });
    assert.equal(signup.status, 200, await signup.clone().text());
    const userId = (await signup.json()).user.id;
    await sql`update "user" set role = 'admin', email_verified = true where id = ${userId}`;
    const session = await login();
    assert.equal(session.response.status, 200);

    await t.test("resposta idêntica sem aguardar provedor; token hash e validade; callback preserva destino", async () => {
      const known = await call("request-password-reset", { email: " MEMBER@EXAMPLE.TEST ", redirectTo: `${origin}/membros/redefinir-senha?next=%2Fadmin` });
      const unknown = await call("request-password-reset", { email: "absent@example.test" });
      assert.equal(known.status, 200, await known.clone().text());
      assert.deepEqual(await known.json(), await unknown.json());
      assert.equal(emails.length, 0, "envio não pode atrasar resposta nem desconhecidos gerar envio");
      assert.equal(deferred.length, 1);
      await drain();
      assert.equal(emails.length, 1);
      const link = emails[0].text.match(/https:\/\/\S+/)[0];
      const token = new URL(link).pathname.split("/").at(-1);
      const [record] = await sql`select * from verification where identifier = ${tokenIdentifier(token)}`;
      assert.equal(record.value, userId);
      assert.ok(!record.identifier.includes(token));
      assert.ok(new Date(record.expires_at).getTime() > Date.now() + 29 * 60_000);
      assert.ok(new Date(record.expires_at).getTime() <= Date.now() + 30 * 60_000);
      const callback = await auth.handler(new Request(link, { headers: { "x-apogee-client-ip": "198.51.100.1" } }));
      assert.equal(callback.status, 302);
      const destination = new URL(callback.headers.get("location"));
      assert.equal(destination.pathname, "/membros/redefinir-senha");
      assert.equal(destination.searchParams.get("token"), token);
      assert.equal(destination.searchParams.get("next"), "/admin");
    });

    await t.test("token inválido/expirado e senha curta não alteram senha nem consomem token válido", async () => {
      const { token, link } = await request();
      assert.equal((await call("reset-password", { token: "invalid-token", newPassword })).status, 400);
      assert.equal((await call("reset-password", { token, newPassword: "short" })).status, 400);
      assert.equal((await sql`select id from verification where identifier = ${tokenIdentifier(token)}`).length, 1);
      await sql`update verification set expires_at = now() - interval '1 minute' where identifier = ${tokenIdentifier(token)}`;
      const callback = await auth.handler(new Request(link));
      assert.equal(new URL(callback.headers.get("location")).searchParams.get("error"), "INVALID_TOKEN");
      assert.equal((await call("reset-password", { token, newPassword })).status, 400);
      assert.equal((await login()).response.status, 200);
    });

    await t.test("erro ao salvar faz rollback da senha, consumo de token e revogação de sessões", async () => {
      const { token } = await request();
      const before = (await sql`select id from session where user_id = ${userId}`).length;
      await sql.unsafe(`create function reject_password_update() returns trigger language plpgsql as $$ begin raise exception 'synthetic write failure'; end $$`);
      await sql.unsafe(`create trigger reject_password before update of password on account for each row execute function reject_password_update()`);
      try {
        assert.equal((await call("reset-password", { token, newPassword })).status, 500);
        assert.equal((await sql`select id from verification where identifier = ${tokenIdentifier(token)}`).length, 1);
        assert.equal((await sql`select id from session where user_id = ${userId}`).length, before);
      } finally { await sql.unsafe("drop trigger reject_password on account"); }
      assert.equal((await login()).response.status, 200);
    });

    await t.test("troca concorrente aceita uso único, revoga sessões e preserva perfil/papel/verificação", async () => {
      const { token } = await request();
      const results = await Promise.all([
        call("reset-password", { token, newPassword }), call("reset-password", { token, newPassword }),
      ]);
      assert.deepEqual(results.map(result => result.status).sort(), [200, 400]);
      assert.equal((await call("reset-password", { token, newPassword })).status, 400);
      assert.equal((await sql`select id from session where user_id = ${userId}`).length, 0);
      const sessionResult = await auth.handler(new Request(`${origin}/api/auth/get-session`, { headers: { cookie: session.cookie } }));
      assert.equal(await sessionResult.json(), null);
      const [user] = await sql`select * from "user" where id = ${userId}`;
      assert.equal(user.role, "admin");
      assert.equal(user.email_verified, true);
      assert.equal(user.username, "syntheticmember");
      assert.equal((await login()).response.status, 401);
      assert.equal((await login(newPassword)).response.status, 200);
    });

    await t.test("troca de senha não permite criar sessão para conta bloqueada", async () => {
      await sql`update "user" set blocked = true where id = ${userId}`;
      try {
        assert.equal((await login(newPassword)).response.status, 403);
      } finally { await sql`update "user" set blocked = false where id = ${userId}`; }
    });

    await t.test("limites persistentes iguais para conta existente e inexistente, inclusive mudança de IP", async () => {
      for (const email of ["member@example.test", "absent@example.test"]) {
        await clearLimits();
        for (let i = 1; i <= 3; i++) assert.equal((await call("request-password-reset", { email }, undefined, `198.51.100.${i}`)).status, 200);
        assert.equal((await call("request-password-reset", { email: email.toUpperCase() }, undefined, "198.51.100.4")).status, 429);
        await drain();
      }
    });

    await t.test("callback externo recusado e indisponibilidade do provedor não expõe existência da conta", async () => {
      await clearLimits();
      assert.equal((await call("request-password-reset", { email: "member@example.test", redirectTo: "https://evil.test/membros/redefinir-senha" })).status, 403);
      failMail = true;
      const known = await call("request-password-reset", { email: "member@example.test" });
      const unknown = await call("request-password-reset", { email: "absent@example.test" });
      assert.deepEqual(await known.json(), await unknown.json());
      await drain();
      failMail = false;
      process.env.MEMBERS_EMAIL_ENABLED = "false";
      await clearLimits();
      assert.equal((await call("request-password-reset", { email: "member@example.test" })).status, 503);
      assert.equal((await call("request-password-reset", { email: "absent@example.test" })).status, 503);
    });
    assert.equal(config.emailAndPassword.revokeSessionsOnPasswordReset, true);
  } finally {
    globalThis.fetch = originalFetch;
    process.env = originalEnv;
    delete globalThis.__apogeeMembersAuth;
    await sql`drop schema ${sql(testSchema)} cascade`;
    await sql.end();
  }
});
