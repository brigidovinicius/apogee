import assert from "node:assert/strict";
import test from "node:test";
import { drizzle } from "drizzle-orm/postgres-js";
import { opportunityLoader } from "./helpers/load-opportunity-module.mjs";

test("admin overview encodes the thirty-day cutoff with the timestamp column before reaching Postgres", async () => {
  const db = drizzle.mock();
  const queries = [];
  const rows = [
    [{ accounts: 3, members: 2, admins: 1, newAccounts30Days: 1 }],
    [{ value: 2 }], [{ value: 4 }],
    [{ id: "synthetic-user", name: "Synthetic", username: null, role: "member", createdAt: new Date() }],
  ];
  const select = db.select.bind(db);
  db.select = (...args) => {
    const builder = select(...args);
    const from = builder.from.bind(builder);
    builder.from = (...tables) => {
      const query = from(...tables);
      query.execute = async () => {
        queries.push(query.toSQL());
        return rows[queries.length - 1];
      };
      return query;
    };
    return builder;
  };
  let authorized = false;
  const load = opportunityLoader({
    "@/lib/admin/access": { requireAdmin: async path => { assert.equal(path, "/admin"); authorized = true; } },
    "@/lib/members/db": { getDb: () => { assert.equal(authorized, true); return db; } },
  });
  const started = Date.now();
  const overview = await load("lib/admin/data.ts").getAdminOverview();
  const ended = Date.now();
  assert.equal(queries.length, 4);
  assert.match(queries[0].sql, /count\(\*\) filter \(where "user"\."created_at" >= \$1\)/);
  assert.equal(queries[0].params.length, 1);
  assert.equal(typeof queries[0].params[0], "string", "postgres.js must receive the encoded timestamp, never a raw Date");
  const cutoff = Date.parse(queries[0].params[0]);
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  assert.ok(cutoff >= started - thirtyDays && cutoff <= ended - thirtyDays);
  assert.deepEqual({ accounts: overview.accounts, members: overview.members, admins: overview.admins, recent: overview.newAccounts30Days }, { accounts: 3, members: 2, admins: 1, recent: 1 });
  assert.equal(overview.recentAccounts[0].username, "");
});
