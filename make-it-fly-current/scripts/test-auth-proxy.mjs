// Somente recursos descartáveis em loopback; nunca lê DATABASE_URL do operador.
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { once } from "node:events";
import { access, mkdtemp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as betterAuthPackage from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { username } from "better-auth/plugins";
import { opportunityLoader } from "../tests/helpers/load-opportunity-module.mjs";

const caddy = process.env.CADDY_BIN;
const pgBin = process.env.MEMBERS_POSTGRES_BIN;
const ciUrl = process.env.MEMBERS_AUTH_TEST_BOOTSTRAP_URL;
if (!caddy || (!pgBin && !ciUrl)) throw new Error("Defina CADDY_BIN e MEMBERS_POSTGRES_BIN; nenhum download é feito pelo teste.");
if (ciUrl && !(process.env.CI === "true" && ciUrl === "postgres://gallery_test:synthetic_ci_only@127.0.0.1:5432/apogee_gallery_ci")) {
  throw new Error("Bootstrap externo permitido somente no PostgreSQL sintético de CI.");
}
const standalone = resolve(".next/standalone");
await access(join(standalone, "server.js"));
const root = await mkdtemp(join(tmpdir(), "members-sec02-"));
const data = join(root, "data");
const socket = join(root, "socket");
const password = "synthetic-auth-proxy-test-only";
const database = "members_sec02_test";
const origin = "https://www.apogee.community";
const freePort = async () => {
  const probe = createServer();
  await new Promise((done, reject) => { probe.once("error", reject); probe.listen(0, "127.0.0.1", done); });
  const port = probe.address().port;
  await new Promise(done => probe.close(done)); return port;
};
const pgRun = (name, args) => execFileSync(join(pgBin, name), args, { encoding: "utf8", stdio: "pipe" });
const children = [];
let startedDatabase = false;
let sql;
const startChild = (binary, args, env, logName, cwd) => {
  const child = spawn(binary, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
  const output = []; child.stdout.on("data", data => output.push(data)); child.stderr.on("data", data => output.push(data));
  children.push({ child, output, logName }); return child;
};
const waitHttp = async (url, child) => {
  for (let i = 0; i < 80; i++) {
    if (child.exitCode !== null) throw new Error("Processo de teste encerrou antes de ficar pronto; consulte os logs locais.");
    try { const response = await fetch(url, { signal: AbortSignal.timeout(1000), redirect: "manual" }); if (response.status < 500) return; }
    catch { /* O processo ainda está iniciando. */ }
    await new Promise(done => setTimeout(done, 100));
  }
  throw new Error("Timeout iniciando serviços descartáveis.");
};

try {
  let testUrl;
  if (ciUrl) {
    const bootstrap = postgres(ciUrl, { ssl: false, max: 1 });
    try { await bootstrap.unsafe(`create database ${database}`); } finally { await bootstrap.end(); }
    const url = new URL(ciUrl); url.pathname = `/${database}`; testUrl = url.toString();
  } else {
    await mkdir(socket);
    const pwFile = join(root, "password");
    await writeFile(pwFile, `${password}\n`, { mode: 0o600 });
    const port = await freePort();
    pgRun("initdb", ["-D", data, "-U", "postgres", "--auth-host=scram-sha-256", "--auth-local=trust", `--pwfile=${pwFile}`, "--no-locale", "--encoding=UTF8"]);
    pgRun("pg_ctl", ["-D", data, "-l", join(root, "postgres.log"), "-o", `-h 127.0.0.1 -p ${port} -k ${socket} -c shared_buffers=16MB -c max_connections=20`, "-w", "start"]);
    startedDatabase = true;
    const bootstrap = postgres({ host: socket, port, user: "postgres", database: "postgres", max: 1, ssl: false });
    try { await bootstrap.unsafe(`create database ${database}`); } finally { await bootstrap.end(); }
    testUrl = `postgres://postgres:${password}@127.0.0.1:${port}/${database}`;
  }
  sql = postgres(testUrl, { ssl: false, max: 2, onnotice: () => {} });
  for (const file of (await readdir("drizzle")).filter(name => name.endsWith(".sql")).sort()) {
    const source = await readFile(join("drizzle", file), "utf8");
    await sql.begin(tx => tx.unsafe(source));
  }
  const appPort = await freePort();
  const proxyPort = await freePort();
  const direct = `http://127.0.0.1:${appPort}`;
  const proxied = `http://127.0.0.1:${proxyPort}`;
  const server = startChild(process.execPath, [join(standalone, "server.js")], {
    PATH: process.env.PATH, NODE_ENV: "production", HOSTNAME: "127.0.0.1", PORT: String(appPort),
    NEXT_TELEMETRY_DISABLED: "1", APPLICATION_HOSTING_PROVIDER: "caddy",
    DATABASE_URL: testUrl, DATABASE_SSL_MODE: "disable",
    BETTER_AUTH_URL: origin, BETTER_AUTH_SECRET: "synthetic-auth-proxy-secret-at-least-32-characters",
    MEMBERS_EMAIL_ENABLED: "false",
  }, "next.log", standalone);
  await waitHttp(`${direct}/`, server);

  // Preserva integralmente o bloco real do proxy; muda somente endereço de escuta/upstream.
  const production = await readFile("infra/site/Caddyfile", "utf8");
  const marker = "www.apogee.community {";
  assert.equal(production.split(marker).length, 2);
  const body = production.slice(production.indexOf(marker) + marker.length);
  assert.equal(body.split("web:3000").length, 2);
  const config = `{\n admin off\n auto_https off\n}\nhttp://127.0.0.1:${proxyPort} {${body.replace("web:3000", `127.0.0.1:${appPort}`)}`;
  const configPath = join(root, "Caddyfile"); await writeFile(configPath, config);
  const version = execFileSync(caddy, ["version"], { encoding: "utf8" });
  assert.match(version, /^v2\.10\.2\b/, "validar a mesma versão do Compose");
  const proxy = startChild(caddy, ["run", "--config", configPath, "--adapter", "caddyfile"], {
    PATH: process.env.PATH, HOME: root, XDG_DATA_HOME: root, XDG_CONFIG_HOME: root,
  }, "caddy.log", root);
  await waitHttp(`${proxied}/api/auth/get-session`, proxy);

  const post = (base, path, body, headers = {}) => fetch(`${base}/api/auth/${path}`, {
    method: "POST", redirect: "manual", signal: AbortSignal.timeout(10_000),
    headers: { "Content-Type": "application/json", Origin: origin, ...headers }, body: JSON.stringify(body),
  });
  const clearLimits = () => sql.unsafe("truncate rate_limit");
  const credentials = { email: "member@example.test", password: "synthetic-good-password" };
  await test("SEC-02: HTTP real Caddy -> Next/Better Auth -> PostgreSQL", async t => {
    await t.test("cadastro, login por e-mail/username e consulta de sessão continuam funcionando", async () => {
      const signup = await post(proxied, "sign-up/email", { ...credentials, name: "Ana", username: "anapessoa" });
      assert.equal(signup.status, 200);
      for (const [path, input] of [["sign-in/email", credentials], ["sign-in/username", { username: "anapessoa", password: credentials.password }]]) {
        const response = await post(proxied, path, input);
        assert.equal(response.status, 200);
        const cookie = response.headers.getSetCookie().map(value => value.split(";")[0]).join("; ");
        assert.ok(cookie.includes("session_token="));
        const session = await fetch(`${proxied}/api/auth/get-session`, { headers: { Cookie: cookie }, signal: AbortSignal.timeout(5000) });
        assert.equal(session.status, 200); assert.equal((await session.json()).user.email, credentials.email);
      }
    });
    for (const path of ["sign-in/email", "sign-in/username", "sign-up/email"]) {
      await t.test(`${path}: IPs/cadeias forjados não liberam a sexta tentativa`, async () => {
        await clearLimits();
        for (let i = 1; i <= 25; i++) {
          const fake = `203.0.113.${i}`;
          const input = path === "sign-in/username" ? { username: `missing${i}`, password: "synthetic-wrong-password" }
            : { email: `missing${i}@example.test`, password: "synthetic-wrong-password", name: "https://invalid.test", username: `missing${i}` };
          const response = await post(proxied, path, input, {
            "x-apogee-client-ip": fake, "x-vercel-forwarded-for": fake,
            "x-forwarded-for": `${fake}, 192.0.2.1`, "x-real-ip": fake, "cf-connecting-ip": fake,
            Forwarded: `for=${fake}`,
          });
          assert.equal(response.status, i <= 5 ? (path === "sign-up/email" ? 400 : 401) : 429);
        }
        const rows = await sql`select key from rate_limit where key not like 'action:%'`;
        assert.equal(rows.length, 1); assert.equal(rows[0].key, `127.0.0.1|/${path}`);
      });
    }
    for (const [path, field, identifier] of [["sign-in/email", "email", credentials.email], ["sign-in/username", "username", "anapessoa"]]) {
      await t.test(`${path}: mudar IP confiável não reinicia a cota da conta`, async () => {
        await clearLimits();
        for (let i = 1; i <= 9; i++) {
          // Conexão direta só ao servidor descartável: simula clientes de IPs distintos.
          const response = await post(direct, path, { [field]: i % 2 ? identifier : identifier.toUpperCase(), password: "synthetic-wrong-password" }, {
            "x-apogee-client-ip": `198.51.100.${i}`,
          });
          assert.equal(response.status, i <= 8 ? 401 : 429);
        }
        const rows = await sql`select key,count from rate_limit where key like 'action:signin-account:%'`;
        assert.equal(rows.length, 1); assert.equal(rows[0].count, 9);
        assert.ok(!rows[0].key.includes(identifier));
      });
    }
    await t.test("auth.api usado pela server action aplica a mesma cota por conta", async () => {
      await clearLimits();
      const previousEnv = { ...process.env };
      let db;
      const load = opportunityLoader({
        "better-auth": betterAuthPackage, "better-auth/api": { createAuthMiddleware },
        "better-auth/adapters/drizzle": { drizzleAdapter }, "better-auth/next-js": { nextCookies },
        "better-auth/plugins": { username }, "./db": { getDb: () => db },
      });
      db = drizzle(sql, { schema: load("lib/members/schema.ts") });
      Object.assign(process.env, { NODE_ENV: "production", APPLICATION_HOSTING_PROVIDER: "caddy", BETTER_AUTH_URL: origin,
        BETTER_AUTH_SECRET: "synthetic-auth-api-secret-at-least-32-characters" });
      delete globalThis.__apogeeMembersAuth;
      try {
        const auth = load("lib/members/auth.ts").getAuth();
        for (let i = 1; i <= 9; i++) {
          await assert.rejects(auth.api.signInEmail({ body: { ...credentials, password: "synthetic-wrong-password" },
            headers: new Headers({ "x-apogee-client-ip": `198.51.100.${i}` }),
          }), error => error.statusCode === (i <= 8 ? 401 : 429));
        }
        const rows = await sql`select count from rate_limit where key like 'action:signin-account:%'`;
        assert.equal(rows.length, 1); assert.equal(rows[0].count, 9);
      } finally { process.env = previousEnv; delete globalThis.__apogeeMembersAuth; }
    });
    await t.test("IPv6 do mesmo /64 compartilha o limite de login", async () => {
      await clearLimits();
      for (let i = 1; i <= 6; i++) {
        const response = await post(direct, "sign-in/email", { email: `v6${i}@example.test`, password: "synthetic-wrong-password" }, {
          "x-apogee-client-ip": `2001:db8:abcd:1234::${i}`,
        });
        assert.equal(response.status, i <= 5 ? 401 : 429);
      }
    });
    await t.test("sem IP confiável não autentica nem consome o banco", async () => {
      await clearLimits();
      for (const ip of [null, "bad", "198.51.100.1, 192.0.2.1", "[2001:db8::1]:1234"]) {
        const headers = { "x-forwarded-for": "198.51.100.1", "x-vercel-forwarded-for": "198.51.100.1" };
        if (ip) headers["x-apogee-client-ip"] = ip;
        assert.equal((await post(direct, "sign-in/email", credentials, headers)).status, 503);
        assert.equal((await fetch(`${direct}/api/auth/get-session`, { headers, signal: AbortSignal.timeout(5000) })).status, 503);
      }
      assert.equal((await sql`select count(*)::int as count from rate_limit`)[0].count, 0);
    });
  });
} finally {
  for (const { child, output, logName } of children.reverse()) {
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, "exit"); child.kill("SIGTERM");
      const timer = setTimeout(() => child.kill("SIGKILL"), 3000);
      try { await exited; } finally { clearTimeout(timer); }
    }
    await writeFile(join(root, logName), Buffer.concat(output));
  }
  await sql?.end();
  if (startedDatabase) pgRun("pg_ctl", ["-D", data, "-m", "fast", "-w", "stop"]);
  console.log(`Evidência sintética local: ${root}`);
}
