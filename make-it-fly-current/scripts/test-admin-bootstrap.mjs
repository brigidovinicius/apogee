// Cluster novo em loopback; nunca usa DATABASE_URL do operador.
import { execFileSync, spawn } from "node:child_process";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import postgres from "postgres";

const bin = process.env.MEMBERS_POSTGRES_BIN;
const ciUrl = process.env.ADMIN_BOOTSTRAP_TEST_BOOTSTRAP_URL;
if (!bin && !ciUrl) throw new Error("Defina MEMBERS_POSTGRES_BIN; nenhum download é feito pelo teste.");
if (ciUrl && !(process.env.CI === "true" && ciUrl === "postgres://gallery_test:synthetic_ci_only@127.0.0.1:5432/apogee_gallery_ci")) {
  throw new Error("Bootstrap permitido somente no PostgreSQL sintético de CI.");
}
const root = await mkdtemp(join(tmpdir(), "members-sec06-"));
const data = join(root, "data");
const socket = join(root, "socket");
const database = "members_sec06_test";
const password = "synthetic-sec06-test-only";
const run = (name, args) => execFileSync(join(bin, name), args, { encoding: "utf8", stdio: "pipe" });
let started = false;
try {
  let url, caFile;
  if (ciUrl) {
    const bootstrap = postgres(ciUrl, { ssl: false, max: 1 });
    try { await bootstrap.unsafe(`create database ${database}`); } finally { await bootstrap.end(); }
    const target = new URL(ciUrl); target.pathname = `/${database}`; url = target.toString();
  } else {
    await mkdir(socket);
    const pwFile = join(root, "password");
    await writeFile(pwFile, `${password}\n`, { mode: 0o600 });
    const probe = createServer();
    await new Promise((done, reject) => { probe.once("error", reject); probe.listen(0, "127.0.0.1", done); });
    const port = probe.address().port;
    await new Promise(done => probe.close(done));
    run("initdb", ["-D", data, "-U", "postgres", "--auth-host=scram-sha-256", "--auth-local=trust", `--pwfile=${pwFile}`, "--no-locale", "--encoding=UTF8"]);
    // Certificado sintético para exercer também o seed CLI sem desligar seu TLS.
    caFile = join(root, "server.crt");
    const keyFile = join(root, "server.key");
    const config = join(root, "cert.cnf");
    await writeFile(config, "[req]\nprompt=no\ndistinguished_name=dn\nx509_extensions=ext\n[dn]\nCN=localhost\n[ext]\nsubjectAltName=DNS:localhost,IP:127.0.0.1\nbasicConstraints=critical,CA:TRUE\n");
    execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1", "-config", config, "-keyout", keyFile, "-out", caFile], { stdio: "pipe" });
    run("pg_ctl", ["-D", data, "-l", join(root, "postgres.log"), "-o", `-h 127.0.0.1 -p ${port} -k ${socket} -c shared_buffers=16MB -c max_connections=20 -c ssl=on -c ssl_cert_file=${caFile} -c ssl_key_file=${keyFile}`, "-w", "start"]);
    started = true;
    const bootstrap = postgres({ host: socket, port, user: "postgres", database: "postgres", ssl: false, max: 1 });
    try { await bootstrap.unsafe(`create database ${database}`); } finally { await bootstrap.end(); }
    url = `postgres://postgres:${password}@127.0.0.1:${port}/${database}`;
  }
  process.exitCode = await new Promise((done, reject) => {
    const child = spawn(process.execPath, ["--test", resolve("tests/members-admin-bootstrap.integration.mjs")], {
      stdio: "inherit", env: {
        PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR,
        CI: ciUrl ? "true" : "false", ADMIN_BOOTSTRAP_TEST_DATABASE_URL: url,
        ...(caFile ? { ADMIN_BOOTSTRAP_TEST_CA_FILE: caFile } : {}),
      },
    });
    child.once("error", reject); child.once("exit", code => done(code ?? 1));
  });
} finally {
  if (started) run("pg_ctl", ["-D", data, "-m", "fast", "-w", "stop"]);
  console.log(`Evidência PostgreSQL sintética: ${root}`);
}
