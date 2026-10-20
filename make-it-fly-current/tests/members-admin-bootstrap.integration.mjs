import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import postgres from "postgres";
import { grantAdmin } from "../scripts/members-grant-admin.mjs";
import { grantInvitationManager } from "../scripts/members-grant-invitation-manager.mjs";

const raw = process.env.ADMIN_BOOTSTRAP_TEST_DATABASE_URL;
const url = new URL(raw ?? "https://invalid.test");
const local = url.username === "postgres" && url.password === "synthetic-sec06-test-only";
const ci = process.env.CI === "true" && raw === "postgres://gallery_test:synthetic_ci_only@127.0.0.1:5432/members_sec06_test";
if (url.hostname !== "127.0.0.1" || url.pathname !== "/members_sec06_test" || (!local && !ci)) {
  throw new Error("Somente o banco descartável sintético members_sec06_test é permitido.");
}
const caFile = process.env.ADMIN_BOOTSTRAP_TEST_CA_FILE;
const ssl = caFile ? { ca: await readFile(caFile, "utf8"), rejectUnauthorized: true } : false;
const sql = postgres(raw, { ssl, max: 3, onnotice: () => {} });
const email = "target@example.test";
const id = "synthetic-target";
const row = async () => (await sql`select * from "user" where id=${id}`)[0];
const reset = async (role = "member", verified = true, blocked = false, manager = false) => {
  await sql`delete from "user"`;
  await sql`insert into "user" (id,name,email,email_verified,role,blocked,can_manage_admins,username)
    values (${id},'Ana',${email},${verified},${role},${blocked},${manager},'syntheticuser')`;
};
const cli = (script, variables = {}) => new Promise((done, reject) => {
  const child = spawn(process.execPath, [resolve("scripts", script)], {
    env: { PATH: process.env.PATH, HOME: process.env.HOME, DATABASE_URL: raw,
      ...(caFile ? { DATABASE_CA_CERT_FILE: caFile } : { DATABASE_SSL_MODE: "disable" }), ...variables },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", data => { output += data; }); child.stderr.on("data", data => { output += data; });
  child.once("error", reject); child.once("exit", code => done({ code, output }));
});
const noSecrets = output => {
  for (const secret of [email, "synthetic-sec06-test-only", "synthetic_ci_only", raw]) assert.ok(!output.includes(secret));
};

test("SEC-06: bootstrap e seed no PostgreSQL descartável", async t => {
  try {
    assert.equal((await sql`select to_regclass('public."user"') as name`)[0].name, null, "banco deve estar vazio");
    for (const file of (await readdir("drizzle")).filter(name => name.endsWith(".sql")).sort()) {
      const source = await readFile(resolve("drizzle", file), "utf8"); await sql.begin(tx => tx.unsafe(source));
    }
    for (const [label, role, verified, blocked, manager] of [
      ["membro não verificado", "member", false, false, false],
      ["membro bloqueado", "member", true, true, false],
      ["admin não verificado", "admin", false, false, false],
      ["admin bloqueado com capacidade existente", "admin", true, true, true],
    ]) {
      await t.test(`grant-admin recusa ${label} e preserva a conta`, async () => {
        await reset(role, verified, blocked, manager); const before = await row();
        await assert.rejects(grantAdmin(sql, email, id)); assert.deepEqual(await row(), before);
      });
    }
    for (const [label, role, verified, blocked, manager] of [
      ["membro verificado", "member", true, false, false],
      ["admin não verificado", "admin", false, false, false],
      ["admin bloqueado", "admin", true, true, false],
      ["admin não verificado com capacidade existente", "admin", false, false, true],
    ]) {
      await t.test(`manager recusa ${label} e preserva a conta`, async () => {
        await reset(role, verified, blocked, manager); const before = await row();
        await assert.rejects(grantInvitationManager(sql, email, id)); assert.deepEqual(await row(), before);
      });
    }
    for (const [name, grant, role] of [["admin", grantAdmin, "member"], ["manager", grantInvitationManager, "admin"]]) {
      await t.test(`${name}: ID explícito é obrigatório e deve corresponder ao e-mail`, async () => {
        await reset(role); const before = await row();
        for (const target of [undefined, "", "wrong-id"]) await assert.rejects(grant(sql, email, target));
        for (const target of ["absent@example.test", "x' OR '1'='1@example.test"]) await assert.rejects(grant(sql, target, id));
        assert.deepEqual(await row(), before);
      });
      await t.test(`${name}: e-mails duplicados sem distinção de caixa falham fechado`, async () => {
        await reset(role);
        await sql`insert into "user" (id,name,email,email_verified,role,blocked,username)
          values ('duplicate','Bia','TARGET@example.test',true,${role},false,'duplicateduser')`;
        const before = await sql`select * from "user" order by id`;
        await assert.rejects(grant(sql, email, id)); assert.deepEqual(await sql`select * from "user" order by id`, before);
      });
    }
    await t.test("admin válido muda somente role e é idempotente", async () => {
      await reset(); const before = await row();
      assert.equal((await grantAdmin(sql, " TARGET@EXAMPLE.TEST ", id)).changed, true);
      assert.deepEqual(await row(), { ...before, role: "admin" });
      assert.equal((await grantAdmin(sql, email, id)).changed, false);
      assert.deepEqual(await row(), { ...before, role: "admin" });
    });
    await t.test("manager válido muda somente capacidade/timestamp e é idempotente", async () => {
      await reset("admin"); const before = await row();
      assert.equal((await grantInvitationManager(sql, " TARGET@EXAMPLE.TEST ", id)).changed, true);
      const after = await row(); assert.deepEqual(after, { ...before, can_manage_admins: true, updated_at: after.updated_at });
      assert.equal((await grantInvitationManager(sql, email, id)).changed, false); assert.deepEqual(await row(), after);
    });
    for (const [name, grant, role] of [["admin", grantAdmin, "member"], ["manager", grantInvitationManager, "admin"]]) {
      await t.test(`${name}: revogação concorrente da verificação é reavaliada após o lock`, async () => {
        await reset(role); const before = await row();
        const blocker = await sql.reserve();
        let pending;
        try {
          await blocker`begin`;
          await blocker`update "user" set email_verified=false where id=${id}`;
          pending = grant(sql, email, id).then(result => ({ result }), error => ({ error }));
          let waiting = false;
          for (let i = 0; i < 100; i++) {
            waiting = (await sql`select exists(select 1 from pg_stat_activity where datname=current_database()
              and pid<>pg_backend_pid() and wait_event_type='Lock') as waiting`)[0].waiting;
            if (waiting) break;
            await new Promise(done => setTimeout(done, 10));
          }
          assert.equal(waiting, true, "concessão deve aguardar a transação concorrente");
          await blocker`commit`;
          assert.ok((await pending).error, "verificação revogada não pode receber privilégio");
          assert.deepEqual(await row(), { ...before, email_verified: false });
        } finally {
          await blocker`rollback`; blocker.release();
          await pending;
        }
      });
    }
    for (const [script, prefix, role, grantField] of [
      ["members-grant-admin.mjs", "MEMBERS_ADMIN", "member", "role"],
      ["members-grant-invitation-manager.mjs", "MEMBERS_INVITATION_MANAGER", "admin", "can_manage_admins"],
    ]) {
      await t.test(`${script}: CLI exige ID, recusa não verificado e confirma alteração sanitizada`, async () => {
        await reset(role); const before = await row();
        let result = await cli(script, { [`${prefix}_EMAIL`]: email });
        assert.equal(result.code, 1); noSecrets(result.output); assert.deepEqual(await row(), before);
        await reset(role, false); const unverified = await row();
        result = await cli(script, { [`${prefix}_EMAIL`]: email, [`${prefix}_USER_ID`]: id });
        assert.equal(result.code, 1); noSecrets(result.output); assert.deepEqual(await row(), unverified);
        await reset(role);
        result = await cli(script, { [`${prefix}_EMAIL`]: email, [`${prefix}_USER_ID`]: id });
        assert.equal(result.code, 0); noSecrets(result.output);
        const evidence = JSON.parse(result.output); assert.equal(evidence.id, id); assert.equal(evidence.changed, true);
        assert.equal((await row())[grantField], grantField === "role" ? "admin" : true);
      });
    }
    await t.test("seed com promoção implícita é recusado antes de gravar categorias ou papéis", async () => {
      await reset("member", false); const before = await row();
      const categories = await sql`select * from forum_category order by id`;
      for (const variables of [{ MEMBERS_ADMIN_EMAIL: email }, { MEMBERS_ADMIN_USER_ID: id }]) {
        const result = await cli("members-seed.mjs", variables);
        assert.equal(result.code, 1); noSecrets(result.output);
        assert.deepEqual(await row(), before); assert.deepEqual(await sql`select * from forum_category order by id`, categories);
      }
    });
    await t.test("seed normal continua idempotente e não muda a conta", async () => {
      await reset(); const before = await row();
      if (caFile) {
        for (let i = 0; i < 2; i++) { const result = await cli("members-seed.mjs"); assert.equal(result.code, 0); noSecrets(result.output); }
      } else {
        // Serviço PG de CI é isolado e sem TLS. A lógica usa o driver real;
        // a entrada CLI com validação TLS é exercida pelo cluster nativo local.
        const { seedCategories } = await import("../scripts/members-seed.mjs");
        await seedCategories(sql); await seedCategories(sql);
      }
      assert.equal((await sql`select count(*)::int as count from forum_category`)[0].count, 4);
      assert.deepEqual(await row(), before);
    });
  } finally { await sql.end(); }
});
