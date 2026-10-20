// Cluster novo, somente loopback. Não usa DATABASE_URL nem processos existentes.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { createServer } from "node:net";

const bin = process.env.PG_BIN;
if (!bin) throw new Error("Informe PG_BIN com os binários PostgreSQL existentes para o teste descartável.");
const port = 55441;
await new Promise((resolve, reject) => {
  const probe = createServer();
  probe.once("error", reject);
  probe.listen(port, "127.0.0.1", () => probe.close(resolve));
});
const directory = mkdtempSync(join(tmpdir(), "apogee-radar-billing-"));
const data = join(directory, "data");
function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`${command.split("/").at(-1)} falhou: ${result.stderr || result.stdout}`);
}
run(join(bin, "initdb"), ["-D", data, "-U", "apogee_test", "-A", "trust", "--no-locale", "-E", "UTF8"]);
let started = false;
try {
  run(join(bin, "pg_ctl"), ["-D", data, "-l", join(directory, "postgres.log"), "-o", `-h 127.0.0.1 -p ${port} -k ${directory}`, "-w", "start"]);
  started = true;
  const result = spawnSync(process.execPath, ["--test", "--test-concurrency=1", "tests/radar-billing.integration.mjs"], {
    stdio: "inherit", env: { ...process.env, RADAR_BILLING_TEST_DATABASE_URL: `postgres://apogee_test@127.0.0.1:${port}/postgres` },
  });
  process.exitCode = result.status ?? 1;
} finally {
  if (started) run(join(bin, "pg_ctl"), ["-D", data, "-m", "fast", "-w", "stop"]);
  console.log(`Cluster de teste próprio encerrado; arquivos preservados em ${directory}`);
}
