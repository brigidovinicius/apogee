import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

async function filesUnder(dir) {
  const entries = await readdir(new URL(dir, root), { withFileTypes: true, recursive: true });
  return entries
    .filter((entry) => entry.isFile() && /\.(ts|tsx|mjs)$/.test(entry.name))
    .map((entry) => `${entry.parentPath ?? entry.path}/${entry.name}`.replace(new URL(root).pathname, ""));
}

test("database and auth modules are server-only and never read public env vars", async () => {
  for (const path of ["lib/members/db.ts", "lib/members/auth.ts", "lib/members/dal.ts", "lib/members/forum.ts", "lib/members/rate-limit.ts"]) {
    assert.match(await source(path), /^import "server-only";/m, `${path} must import server-only`);
  }
  const files = [...(await filesUnder("lib/members")), ...(await filesUnder("app/membros")), ...(await filesUnder("components/members"))];
  for (const file of files) {
    const text = await readFile(file.startsWith("/") ? file : new URL(file, root), "utf8");
    assert.doesNotMatch(text, /NEXT_PUBLIC_/, `${file} must not use NEXT_PUBLIC_ variables`);
  }
});

test("client components never import the database, auth or DAL directly", async () => {
  for (const file of await filesUnder("components/members")) {
    const text = await readFile(file.startsWith("/") ? file : new URL(file, root), "utf8");
    if (!text.startsWith('"use client"')) continue;
    assert.doesNotMatch(text, /@\/lib\/members\/(db|auth|dal|forum|rate-limit)/, `${file} leaks server modules`);
  }
});

test("member queries never select e-mail or password fields for display", async () => {
  const forum = await source("lib/members/forum.ts");
  assert.doesNotMatch(forum, /user\.email|account\.password|\bpassword\b/);
});

test("the isolated compose stack exposes only PgBouncer and requires TLS", async () => {
  const compose = await source("infra/membros/docker-compose.yml");
  assert.match(compose, /^name: apogee-membros$/m);
  const services = compose.split(/\n  (?=[a-z]+:\n)/);
  const postgres = services.find((block) => block.startsWith("postgres:"));
  const pgbouncer = services.find((block) => block.startsWith("pgbouncer:"));
  assert.ok(postgres && pgbouncer);
  assert.doesNotMatch(postgres, /\n\s+ports:/, "postgres must not publish ports");
  assert.match(pgbouncer, /ports:/);
  assert.match(pgbouncer, /"127\.0\.0\.1:\$\{PGBOUNCER_PORT:-6543\}:5432"/,
    "PgBouncer must bind only to the VPS loopback interface");
  assert.doesNotMatch(pgbouncer, /"(?:0\.0\.0\.0|\[::\]):/,
    "PgBouncer must never bind a public interface");
  assert.match(pgbouncer, /CLIENT_TLS_SSLMODE: require/);
  assert.match(pgbouncer, /POOL_MODE: transaction/);
  assert.match(compose, /internal: true/);
  assert.match(compose, /name: apogee_membros_pgdata/);
});

test("the app role is not a superuser and the Node client disables prepared statements", async () => {
  const init = await source("infra/membros/init/01-app-user.sh");
  assert.match(init, /NOSUPERUSER/);
  const db = await source("lib/members/db.ts");
  assert.match(db, /prepare: false/);
  assert.match(db, /rejectUnauthorized: true/);
});

test("proxy guards members and admin while leaving member login and sign-up public", async () => {
  const proxy = await source("proxy.ts");
  assert.match(proxy, /matcher: \["\/membros", "\/membros\/:path\*", "\/admin", "\/admin\/:path\*"\]/);
  assert.match(proxy, /"\/membros\/entrar", "\/membros\/cadastro"/);
});
