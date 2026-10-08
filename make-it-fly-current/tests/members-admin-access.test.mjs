import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { AdminRoleError, grantAdmin } from "../scripts/members-grant-admin.mjs";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

function database(initialRows) {
  const rows = initialRows.map((row) => ({ ...row }));
  const statements = [];
  const tx = async (strings, ...values) => {
    const statement = strings.join("?").replace(/\s+/g, " ").trim();
    statements.push(statement);
    if (statement.startsWith("lock table")) return [];
    if (statement.startsWith("select id, role")) return rows;
    if (statement.startsWith('update "user"')) {
      const row = rows.find((item) => item.id === values[0] && item.role === "member");
      if (!row) return [];
      row.role = "admin";
      return [{ role: row.role }];
    }
    throw new Error(`SQL inesperado no teste: ${statement}`);
  };
  return {
    rows,
    statements,
    sql: { begin: async (operation) => operation(tx) },
  };
}

test("admin grant changes only one existing member and is idempotent", async () => {
  const first = database([{ id: "member-id", role: "member" }]);
  assert.deepEqual(await grantAdmin(first.sql, "authorized@example.com"), {
    id: "member-id",
    previousRole: "member",
    finalRole: "admin",
    changed: true,
  });
  assert.deepEqual(first.rows, [{ id: "member-id", role: "admin" }]);
  assert.equal(first.statements.filter((statement) => statement.startsWith('update "user"')).length, 1);

  const second = database([{ id: "member-id", role: "admin" }]);
  assert.deepEqual(await grantAdmin(second.sql, "authorized@example.com"), {
    id: "member-id",
    previousRole: "admin",
    finalRole: "admin",
    changed: false,
  });
  assert.equal(second.statements.some((statement) => statement.startsWith('update "user"')), false);
});

test("admin grant fails closed for missing, duplicate, or invalid roles", async () => {
  for (const rows of [
    [],
    [{ id: "one", role: "member" }, { id: "two", role: "member" }],
    [{ id: "one", role: "owner" }],
  ]) {
    const state = database(rows);
    await assert.rejects(() => grantAdmin(state.sql, "authorized@example.com"), AdminRoleError);
    assert.equal(state.statements.some((statement) => statement.startsWith('update "user"')), false);
  }
});

test("admin page and API re-check the server session role", async () => {
  const [dal, page, route, client] = await Promise.all([
    source("lib/members/dal.ts"),
    source("app/gerenciar-galeria/page.tsx"),
    source("app/api/gallery/admin/route.ts"),
    source("components/gallery/gallery-admin.tsx"),
  ]);

  assert.match(dal, /export async function requireAdmin/);
  assert.match(dal, /member\.role !== "admin"\) notFound\(\)/);
  assert.match(page, /await requireAdmin\("\/gerenciar-galeria"\)/);
  assert.match(route, /getMemberFromHeaders\(request\.headers\)/);
  assert.match(route, /memberRole: member\?\.role/);
  assert.doesNotMatch(client, /Authorization|Credencial administrativa|type="password"/);
});
