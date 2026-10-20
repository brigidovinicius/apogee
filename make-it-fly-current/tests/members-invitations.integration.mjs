// Banco descartável obrigatório. Nunca usa DATABASE_URL nem migra banco existente.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { opportunityLoader } from "./helpers/load-opportunity-module.mjs";
import * as betterAuthPackage from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { username } from "better-auth/plugins";
import { grantInvitationManager } from "../scripts/members-grant-invitation-manager.mjs";

const url = process.env.INVITATIONS_TEST_DATABASE_URL;
const localDatabase = "postgres://apogee_test@127.0.0.1:55439/postgres";
const ciDatabase = "postgres://gallery_test:synthetic_ci_only@127.0.0.1:5432/apogee_gallery_ci";
if (url !== localDatabase && !(process.env.CI === "true" && url === ciDatabase)) throw new Error("Use somente o PostgreSQL descartável local ou o banco sintético de CI.");
const testSchema = `invites_${Date.now()}`;
const setup = postgres(url, { ssl: false, max: 1 });
await setup`create schema ${setup(testSchema)}`;
await setup.end();
const sql = postgres(url, { ssl: false, max: 5, onnotice: () => {}, connection: { search_path: testSchema } });
process.env.BETTER_AUTH_URL = "http://localhost:35439";
process.env.BETTER_AUTH_SECRET = "isolated-invitations-secret-32-characters-only";
process.env.MEMBERS_EMAIL_ENABLED = "true";
process.env.MEMBERS_RESEND_DOMAIN_VERIFIED = "true";
process.env.MEMBERS_RESEND_API_KEY = "re_isolated_test_key_no_network";
process.env.MEMBERS_RESEND_FROM = "contato@apogee.community";
const emails = [];
let failMail = false;
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options) => {
  assert.equal(url, "https://api.resend.com/emails", "qualquer rede externa é proibida neste teste");
  if (failMail) return new Response("{}", { status: 503 });
  emails.push(JSON.parse(options.body));
  return Response.json({ id: `test-${emails.length}` });
};
let db, auth, config;
const load = opportunityLoader({
  "./db": { getSql: () => sql, getDb: () => db },
  "@/lib/members/db": { getSql: () => sql, getDb: () => db },
  "better-auth": { ...betterAuthPackage, betterAuth: (options) => { config = options; return betterAuthPackage.betterAuth(options); } },
  "better-auth/adapters/drizzle": { drizzleAdapter }, "better-auth/plugins": { username },
  "better-auth/next-js": { nextCookies: () => ({ id: "test-no-next-cookies" }) },
});
const schema = load("lib/members/schema.ts");
db = drizzle(sql, { schema });
const inv = load("lib/members/invitations.ts");
const api = load("app/api/members/invitations/route.ts");
const verificationApi = load("app/api/members/verification/route.ts");
const forum = load("lib/members/forum.ts");
const headers = (cookie) => ({ Origin: process.env.BETTER_AUTH_URL, "Content-Type": "application/json", ...(cookie ? { cookie } : {}) });
const body = (cookie, input) => new Request(`${process.env.BETTER_AUTH_URL}/api/members/invitations`, { method: "POST", headers: headers(cookie), body: JSON.stringify(input) });
async function authCall(path, input, cookie) {
  return auth.handler(new Request(`${process.env.BETTER_AUTH_URL}/api/auth/${path}`, { method: "POST", headers: headers(cookie), body: JSON.stringify(input) }));
}
async function signup(email, username, name = "Ana M.") {
  const response = await authCall("sign-up/email", { email, username, name, password: "Test-local-12345!", role: "admin", isAdmin: true, emailVerified: true, canManageAdmins: true, blocked: false });
  assert.equal(response.status, 200, await response.clone().text());
  const payload = await response.json();
  return { id: payload.user.id, cookie: response.headers.get("set-cookie").split(";")[0] };
}
function lastToken() { return new URL(emails.at(-1).text.match(/http:\/\/localhost:35439\/membros\/convite\?token=[a-f0-9]+/)[0]).searchParams.get("token"); }
async function create(actor, role = "member", email = "member@example.test") {
  const result = await inv.createInvitation(actor.id, email, role);
  return { ...result, token: lastToken() };
}
async function state(id) { return (await sql`select * from member_invitation where id = ${id}`)[0]; }
async function account(id) { return (await sql`select * from "user" where id = ${id}`)[0]; }
async function events(id) { return sql`select action from member_invitation_event where invitation_id = ${id} order by id`; }
async function verify(recipient, token) {
  const response = await verificationApi.POST(new Request(`${process.env.BETTER_AUTH_URL}/api/members/verification`, { method: "POST", headers: headers(recipient.cookie), body: JSON.stringify({ next: `/membros/convite?token=${token}` }) }));
  assert.equal(response.status, 200, await response.clone().text());
  const link = emails.at(-1).text.match(/http:\/\/localhost:35439\/api\/auth\/verify-email\?\S+/)[0];
  const verified = await auth.handler(new Request(link, { headers: { cookie: recipient.cookie } }));
  assert.equal(verified.status, 302, await verified.clone().text());
  assert.equal((await account(recipient.id)).email_verified, true);
}

test("convites com Better Auth real e PostgreSQL: persistência, permissões, verificação, falhas e concorrência", async (t) => {
  try {
    // Exclusivo deste cluster recém-criado, com marcador que evita reexecução destrutiva.
    const existing = await sql`select to_regclass('"user"') as name`;
    if (existing[0].name) throw new Error("Banco não vazio; inicialize outro cluster descartável.");
    for (const file of ["0000_init", "0001_gallery_postgres", "0002_rapid_queen_noir", "0003_bored_logan", "0004_member_invitations"]) {
      await sql.unsafe((await readFile(new URL(`../drizzle/${file}.sql`, import.meta.url), "utf8")).replaceAll('"public".', `"${testSchema}".`));
    }
    auth = load("lib/members/auth.ts").getAuth();
    const issuer = await signup("issuer@example.test", "issuer");
    const operator = await signup("operator@example.test", "operator");
    const member = await signup("member@example.test", "memberperson");
    const admin = await signup("admin@example.test", "adminperson");
    const outsider = await signup("other@example.test", "otherperson");
    await sql`update "user" set role = 'admin', can_manage_admins = true where id = ${issuer.id}`;
    await sql`update "user" set role = 'admin' where id = ${operator.id}`;
    let memberInvite, adminInvite;
    await t.test("bootstrap exige admin existente, não promove membro e é idempotente", async () => {
      await assert.rejects(grantInvitationManager(sql, "other@example.test"));
      assert.equal((await account(outsider.id)).can_manage_admins, false);
      assert.equal((await grantInvitationManager(sql, "issuer@example.test")).changed, false);
    });
    await t.test("painel administrativo consulta período sem erro de timestamp", async () => {
      const adminLoad = opportunityLoader({
        "@/lib/members/db": { getDb: () => db },
        "@/lib/admin/access": { requireAdmin: async () => ({ id: issuer.id }) },
      });
      const overview = await adminLoad("lib/admin/data.ts").getAdminOverview();
      assert.equal(overview.accounts, 5); assert.equal(overview.newAccounts30Days, 5); assert.equal(overview.admins, 2);
    });
    await t.test("cadastro público ignora autopromoção e verificação do navegador", async () => {
      const row = await account(member.id);
      assert.equal(row.role, "member"); assert.equal(row.email_verified, false); assert.equal(row.can_manage_admins, false);
      const forbidden = await authCall("update-user", { name: "Ana", role: "admin", isAdmin: true, emailVerified: true, canManageAdmins: true }, member.cookie);
      assert.equal(forbidden.status, 400);
      const unchanged = await account(member.id);
      assert.equal(unchanged.role, "member"); assert.equal(unchanged.email_verified, false); assert.equal(unchanged.can_manage_admins, false);
      for (const field of [{role:"admin"}, {canManageAdmins:true}, {emailVerified:true}, {email_verified:true}, {blocked:false}, {isAdmin:true}, {userId:issuer.id}]) {
        await authCall("update-user", field, member.cookie);
        const row = await account(member.id);
        assert.equal(row.role, "member"); assert.equal(row.email_verified, false); assert.equal(row.can_manage_admins, false);
      }
    });
    await t.test("membro/visitante/admin sem autorização adicional não gerenciam administradores", async () => {
      for (const who of [member, operator]) {
        const response = await api.POST(body(who.cookie, { action: "create", email: "target@example.test", role: "admin" }));
        assert.equal(response.status, 403, await response.clone().text());
      }
      assert.equal((await api.POST(body(null, { action: "create", email: "target@example.test", role: "admin" }))).status, 401);
      assert.equal((await sql`select count(*)::int as n from member_invitation`)[0].n, 0);
    });
    await t.test("emissão, conteúdo do e-mail e hash persistido; GET só consulta", async () => {
      memberInvite = await create(operator);
      adminInvite = await create(issuer, "admin", "admin@example.test");
      assert.equal(memberInvite.sent, true);
      const row = await state(memberInvite.id);
      assert.notEqual(row.token_hash, memberInvite.token);
      assert.equal(row.token_hash, inv.hashInvitationToken(memberInvite.token));
      assert.equal(row.issuer_id, operator.id); assert.equal(row.role, "member"); assert.equal(row.status, "pending");
      assert.equal((await inv.previewInvitation(memberInvite.token)).status, "pending");
      assert.equal((await state(memberInvite.id)).status, "pending");
      assert.equal((await account(admin.id)).role, "member");
      for (const who of [member, operator]) {
        for (const action of ["resend", "revoke"]) {
          assert.equal((await api.POST(body(who.cookie, { action, id: adminInvite.id }))).status, 403);
          assert.equal((await state(adminInvite.id)).status, "pending");
        }
      }
      assert.ok(Math.abs(new Date(row.expires_at) - new Date(row.created_at) - 48 * 3600_000) < 5000);
      assert.deepEqual((await events(memberInvite.id)).map(x => x.action), ["created", "provider_accepted"]);
    });
    await t.test("e-mail sem verificação, diferente e flags forjadas não consomem", async () => {
      for (const who of [member, outsider]) {
        assert.equal((await api.POST(body(who.cookie, { action: "accept", token: memberInvite.token, name: "Ana M." }))).status, 403);
        assert.equal((await state(memberInvite.id)).status, "pending");
        assert.equal((await account(who.id)).role, "member");
      }
      assert.equal((await api.POST(body(member.cookie, { action: "accept", token: memberInvite.token, name: "Ana", role: "admin", emailVerified: true, userId: admin.id }))).status, 400);
      assert.equal((await state(memberInvite.id)).status, "pending");
    });
    await t.test("redirecionamento externo de verificação é recusado pelo provedor", async () => {
      const count = emails.length;
      const response = await authCall("send-verification-email", { email: "other@example.test", callbackURL: "https://attacker.example/path" }, outsider.cookie);
      assert.equal(response.status, 403); assert.equal(emails.length, count);
      assert.equal((await account(outsider.id)).email_verified, false);
    });
    await t.test("verificação confiável Better Auth não aceita o convite automaticamente", async () => {
      await verify(member, memberInvite.token); await verify(admin, adminInvite.token);
      assert.equal((await state(memberInvite.id)).status, "pending");
      assert.equal((await account(admin.id)).role, "member");
    });
    await t.test("nomes inválidos na API, cadastro, perfil e hook social não gravam dados", async () => {
      const badNames = ["https://example.com", "www.example.com", "example.com", "João https://example.com", "ana@example.com", '<script>alert(1)</script>', '<img src=x onerror=alert(1)>', "Robert'); DROP TABLE user;--", "", 23, "A".repeat(101), "Ana\u200bM."];
      const before = await account(member.id);
      for (const name of badNames) {
        assert.equal((await api.POST(body(member.cookie, { action: "accept", token: memberInvite.token, name }))).status, 400);
        const update = await authCall("update-user", { name }, member.cookie);
        assert.equal(update.status, 400, JSON.stringify(name));
        assert.equal((await account(member.id)).name, before.name);
        assert.equal((await state(memberInvite.id)).status, "pending");
      }
      const count = (await sql`select count(*)::int as n from "user"`)[0].n;
      assert.equal((await authCall("sign-up/email", { email: "invalid@example.test", username: "invalidperson", name: "example.com", password: "Test-local-12345!" })).status, 400);
      assert.equal((await sql`select count(*)::int as n from "user"`)[0].n, count);
      await assert.rejects(forum.updateProfile({ userId: member.id, name: "example.com", bio: "" }));
      assert.equal(config.account.accountLinking.requireLocalEmailVerified, true);
      const mapped = config.socialProviders.google.mapProfileToUser({ sub: "fixture-social", name: "example.com" });
      assert.equal(mapped.name, "Membro"); assert.equal(mapped.nameNeedsConfirmation, true);
      await assert.rejects(config.databaseHooks.user.update.before({ name: "example.com" }));
      assert.equal((await account(member.id)).name, before.name);
    });
    await t.test("membro e administrador aceitam sem trocar credenciais, com idempotência", async () => {
      const credentials = await sql`select id, password from account order by id`;
      for (const [who, invite, role, name] of [[member, memberInvite, "member", "Vinícius Brígido"], [admin, adminInvite, "admin", "João D’Ávila"]]) {
        const response = await api.POST(body(who.cookie, { action: "accept", token: invite.token, name }));
        assert.equal(response.status, 200, await response.clone().text());
        assert.equal((await account(who.id)).role, role); assert.equal((await account(who.id)).name, name);
        assert.equal((await state(invite.id)).status, "accepted");
        assert.equal((await api.POST(body(who.cookie, { action: "accept", token: invite.token, name }))).status, 200);
        assert.equal((await events(invite.id)).filter(x => x.action === "accepted").length, 1);
      }
      assert.deepEqual(await sql`select id, password from account order by id`, credentials);
      assert.equal((await account(admin.id)).can_manage_admins, false);
    });
    await t.test("permissões administrativas efetivas usam banco atual", async () => {
      assert.equal((await api.GET(new Request(`${process.env.BETTER_AUTH_URL}/api/members/invitations`, { headers: headers(member.cookie) }))).status, 403);
      assert.equal((await api.GET(new Request(`${process.env.BETTER_AUTH_URL}/api/members/invitations`, { headers: headers(admin.cookie) }))).status, 200);
      const { getMemberFromHeaders } = load("lib/members/dal.ts");
      assert.equal((await getMemberFromHeaders(new Headers(headers(member.cookie)))).role, "member");
      assert.equal((await getMemberFromHeaders(new Headers(headers(admin.cookie)))).role, "admin");
      assert.equal((await inv.listInvitations(operator.id)).some(x => x.role === "admin"), false);
      assert.equal((await inv.listInvitations(issuer.id)).some(x => x.role === "admin"), true);
    });
    await t.test("token expirado, revogado, adulterado e substituído não geram efeito", async () => {
      const expired = await create(operator); await sql`update member_invitation set expires_at = now() - interval '1 second' where id = ${expired.id}`;
      await assert.rejects(inv.acceptInvitation(member.id, expired.token, "Ana M.")); assert.equal((await state(expired.id)).status, "pending");
      assert.equal((await inv.previewInvitation(expired.token)).status, "expired");
      const revoked = await create(operator); await inv.revokeInvitation(operator.id, revoked.id);
      await assert.rejects(inv.acceptInvitation(member.id, revoked.token, "Ana M.")); assert.equal((await state(revoked.id)).status, "revoked");
      const resend = await create(operator); await inv.resendInvitation(operator.id, resend.id); const newToken = lastToken();
      await assert.rejects(inv.acceptInvitation(member.id, resend.token, "Ana M.")); assert.equal((await state(resend.id)).status, "pending");
      await assert.rejects(inv.acceptInvitation(member.id, "a".repeat(64), "Ana M."));
      await inv.acceptInvitation(member.id, newToken, "Ana M."); assert.equal((await state(resend.id)).status, "accepted");
    });
    await t.test("aceitações simultâneas têm um consumo e um evento", async () => {
      const invite = await create(operator);
      const results = await Promise.all([inv.acceptInvitation(member.id, invite.token, "Ana M."), inv.acceptInvitation(member.id, invite.token, "Ana M.")]);
      assert.equal(results.filter(x => !x.alreadyAccepted).length, 1);
      assert.equal((await events(invite.id)).filter(x => x.action === "accepted").length, 1);
    });
    await t.test("não rebaixa admin, bloqueio persiste e emissor perde autoridade", async () => {
      const noDemotion = await create(operator, "member", "admin@example.test");
      await inv.acceptInvitation(admin.id, noDemotion.token, "Ana M."); assert.equal((await account(admin.id)).role, "admin");
      const blocked = await create(operator); await sql`update "user" set blocked = true where id = ${member.id}`;
      await assert.rejects(inv.acceptInvitation(member.id, blocked.token, "Ana M.")); assert.equal((await state(blocked.id)).status, "pending");
      assert.equal((await account(member.id)).blocked, true);
      assert.equal((await load("lib/members/dal.ts").getMemberFromHeaders(new Headers(headers(member.cookie)))), null);
      await sql`update "user" set blocked = false where id = ${member.id}`;
      const lostAuthority = await create(issuer, "admin", "member@example.test"); await sql`update "user" set can_manage_admins = false where id = ${issuer.id}`;
      await assert.rejects(inv.acceptInvitation(member.id, lostAuthority.token, "Ana M.")); assert.equal((await account(member.id)).role, "member"); assert.equal((await state(lostAuthority.id)).status, "pending");
      await sql`update "user" set can_manage_admins = true where id = ${issuer.id}`;
    });
    await t.test("falha de envio é persistida, reenvio troca token e limites/CSRF funcionam", async () => {
      failMail = true;
      const failed = await inv.createInvitation(operator.id, "member@example.test", "member");
      assert.equal(failed.sent, false); assert.equal((await state(failed.id)).delivery, "unconfirmed");
      const previousHash = (await state(failed.id)).token_hash; failMail = false;
      await inv.resendInvitation(operator.id, failed.id);
      assert.notEqual((await state(failed.id)).token_hash, previousHash);
      const request = body(issuer.cookie, { action: "create", email: "target@example.test", role: "member" });
      request.headers.set("origin", "https://attacker.example"); assert.equal((await api.POST(request)).status, 403);
      for (let i = 0; i < 22; i++) await inv.revokeInvitation(issuer.id, failed.id).catch(() => {});
      await assert.rejects(inv.createInvitation(issuer.id, "member@example.test", "member"), e => e.status === 429);
      assert.equal((await state(failed.id)).status, "revoked");
      const oversized = body(member.cookie, { action: "accept", token: memberInvite.token, name: "A".repeat(5000) });
      assert.equal((await api.POST(oversized)).status, 413);
      const blankOrigin = body(member.cookie, { action: "accept", token: memberInvite.token, name: "Ana" });
      blankOrigin.headers.delete("origin"); assert.equal((await api.POST(blankOrigin)).status, 403);
    });
  } finally { globalThis.fetch = originalFetch; await sql.end(); }
});
