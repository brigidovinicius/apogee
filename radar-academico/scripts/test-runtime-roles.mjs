// PostgreSQL descartável: nunca herda DATABASE_URL ou usa um cluster existente.
import { spawn, execFileSync } from "node:child_process";
import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer } from "node:net";
import pg from "pg";

const bin = process.env.RADAR_POSTGRES_BIN;
if (!bin) throw new Error("Defina RADAR_POSTGRES_BIN para os binários locais do PostgreSQL; nenhum download é feito.");
const root = await mkdtemp(join(tmpdir(), "radar-sec05-pg-"));
const data = join(root, "data");
const socket = join(root, "socket");
await mkdir(socket);
const passwordFile = join(root, "password");
await writeFile(passwordFile, "synthetic-runtime-role-test-only\n", { mode: 0o600 });
const probe = createServer();
await new Promise((done, reject) => { probe.once("error", reject); probe.listen(0, "127.0.0.1", done); });
const port = probe.address().port;
await new Promise(done => probe.close(done));
const run = (name, args) => execFileSync(join(bin, name), args, { encoding: "utf8", stdio: "pipe" });
let started = false;
try {
  run("initdb", ["-D", data, "-U", "postgres", "--auth-host=scram-sha-256", "--auth-local=trust", `--pwfile=${passwordFile}`, "--no-locale", "--encoding=UTF8"]);
  run("pg_ctl", ["-D", data, "-l", join(root, "postgres.log"), "-o", `-h 127.0.0.1 -p ${port} -k ${socket} -c shared_buffers=16MB -c max_connections=30`, "-w", "start"]);
  started = true;
  const bootstrap = new pg.Client({ host: socket, port, user: "postgres", database: "postgres" });
  try { await bootstrap.connect(); await bootstrap.query("CREATE DATABASE radar_sec05_test"); }
  finally { await bootstrap.end(); }
  const status = await new Promise((done, reject) => {
    const child = spawn(process.execPath, [resolve("node_modules/vitest/vitest.mjs"), "run", "--maxWorkers=1", "src/__tests__/runtime-roles.postgres.test.ts"], {
      stdio: "inherit",
      env: {
        PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR,
        RADAR_ROLES_TEST_ADMIN_URL: `postgresql://postgres:synthetic-runtime-role-test-only@127.0.0.1:${port}/radar_sec05_test`,
      },
    });
    child.once("error", reject); child.once("exit", code => done(code ?? 1));
  });
  process.exitCode = status;
} finally {
  if (started) run("pg_ctl", ["-D", data, "-m", "fast", "-w", "stop"]);
  // Mantém cluster/logs descartáveis para revisão; nunca remove ambientes alheios.
  console.log(`Evidência PostgreSQL local: ${root}`);
}
