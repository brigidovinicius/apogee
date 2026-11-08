// Self-contained local PostgreSQL only: never reads DATABASE_URL or .env.
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import postgres from "postgres";
import { opportunityLoader } from "../tests/helpers/load-opportunity-module.mjs";
const directory = mkdtempSync(path.join(tmpdir(), "apogee-behavior-test-"));
const data = path.join(directory, "data");
const port = 48967; // Unix socket only; no TCP listener.
function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8", env: { PATH: process.env.PATH, LC_ALL: "C" } });
  if (result.status !== 0) throw Error(`${command} failed: ${result.stderr || result.stdout}`);
}
let started = false;
let sql;
try {
  run("initdb", ["-D", data, "-A", "trust", "-U", "behavior_test", "--no-locale", "--encoding=UTF8"]);
  run("pg_ctl", ["-D", data, "-l", path.join(directory, "postgres.log"), "-o", `-k ${directory} -p ${port} -c listen_addresses='' -c max_connections=12 -c shared_buffers=16MB`, "-w", "start"]);
  started = true;
  sql = postgres({ host: directory, port, username: "behavior_test", database: "postgres", ssl: false, max: 3, prepare: false, onnotice() {} });
  const [connection] = await sql`select current_user as role, current_database() as db, current_setting('listen_addresses') as listeners`;
  assert.deepEqual({ ...connection }, { role: "behavior_test", db: "postgres", listeners: "" });
  const connectionForSchema = await sql.reserve();
  try { await connectionForSchema.unsafe(readFileSync(new URL("../sql/behavior-daily.sql", import.meta.url), "utf8")); }
  finally { connectionForSchema.release(); }
  const load = opportunityLoader({ "./members/db": { getSql: () => sql } });
  const { storeBehavior } = load("lib/behavior.ts");
  const count = { page: "radar_list", event: "page_view", target: "view", device: "desktop", count: 2 };
  await storeBehavior([count]);
  await Promise.all(Array.from({ length: 6 }, () => storeBehavior([count])));
  const [saved] = await sql`select count::text as count, day::text as day from apogee_behavior_daily`;
  assert.equal(saved.count, "14");
  const [today] = await sql`select (now() at time zone 'America/Sao_Paulo')::date::text as day`;
  assert.equal(saved.day, today.day);
  console.log("PASS atomic aggregate upserts and concurrent increments, Brazil day");
  for (const changes of [{ target: "maria_silva" }, { page: "private_profile" }, { device: "private_user_agent" }, { event: "form_progress", target: "started" }]) {
    await assert.rejects(storeBehavior([{ ...count, ...changes }]), error => error.code === "23514");
  }
  await assert.rejects(storeBehavior([count, { ...count, target: "private_answer" }]), error => error.code === "23514");
  assert.equal((await sql`select count::text from apogee_behavior_daily`)[0].count, "14");
  console.log("PASS database constraints reject private values; failed batches roll back");
  await sql`insert into apogee_behavior_daily (day,page,event,target,device,count) values ((now() at time zone 'America/Sao_Paulo')::date-90,'home','page_view','view','desktop',1), ((now() at time zone 'America/Sao_Paulo')::date-89,'home','page_view','view','desktop',1)`;
  await storeBehavior([count]);
  assert.equal((await sql`select count(*)::int as count from apogee_behavior_daily where day < (now() at time zone 'America/Sao_Paulo')::date-89`)[0].count, 0);
  assert.equal((await sql`select count(*)::int as count from apogee_behavior_daily`)[0].count, 2);
  const columns = await sql`select column_name from information_schema.columns where table_name='apogee_behavior_daily' order by ordinal_position`;
  assert.deepEqual(columns.map(row => row.column_name), ["day", "page", "event", "target", "device", "count"]);
  console.log("PASS 90-day retention boundary and schema with no individual identifiers");
  await storeBehavior([{ ...count, page: "makeitfly_application", event: "action", target: "application_open" }]);
  assert.equal((await sql`select count(*)::int as count from apogee_behavior_daily where target='application_open'`)[0].count, 1);
  console.log("PASS external application opening uses the same closed SQL contract");
  await sql`create role behavior_public_test`;
  assert.equal((await sql`select has_table_privilege('behavior_public_test','apogee_behavior_daily','SELECT') as readable`)[0].readable, false);
  console.log("PASS no public table access");
} finally {
  if (sql) await sql.end();
  if (started) run("pg_ctl", ["-D", data, "-m", "fast", "-w", "stop"]);
  // Preserve the isolated test directory for inspection; no project cleanup.
  console.log(`Local test artifact: ${directory}`);
}
