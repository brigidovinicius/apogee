import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, writeFile, unlink, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// Só renderiza configuração: não inicia Docker, containers ou conexões de rede.
test("Compose keeps bootstrap credentials out of web and all database credentials out of scheduler", async () => {
  const dir = await mkdtemp(join(tmpdir(), "radar-sec05-compose-"));
  const file = join(dir, "synthetic.env");
  const env = {
    RADAR_DB_NAME: "radar_sec05_test", RADAR_DB_USER: "postgres", RADAR_DB_PASSWORD: "synthetic-bootstrap-only",
    DATABASE_MIGRATION_URL: "postgres://postgres:synthetic-bootstrap-only@postgres/radar_sec05_test",
    DATABASE_READER_URL: "postgres://radar_reader:synthetic-reader-only@postgres/radar_sec05_test",
    DATABASE_EDITOR_URL: "postgres://radar_editor:synthetic-editor-only@postgres/radar_sec05_test",
    CRON_SECRET: "synthetic-cron-only", RADAR_RESEND_API_KEY: "synthetic-mail-only",
  };
  const render = () => JSON.parse(execFileSync("docker", ["compose", "--env-file", file, "-f", resolve("infra/vps/docker-compose.yml"), "--profile", "migrate", "config", "--format", "json"], {
    encoding: "utf8", env: { PATH: process.env.PATH, HOME: process.env.HOME }, stdio: "pipe",
  }));
  try {
    await writeFile(file, Object.entries(env).map(([key, value]) => `${key}=${value}`).join("\n"), { mode: 0o600 });
    const { services } = render();
    assert.equal(services.web.environment.DATABASE_READER_URL, env.DATABASE_READER_URL);
    assert.equal(services.web.environment.DATABASE_EDITOR_URL, env.DATABASE_EDITOR_URL);
    assert.equal(services.migrate.environment.DATABASE_URL, env.DATABASE_MIGRATION_URL);
    for (const key of ["DATABASE_URL", "DATABASE_MIGRATION_URL", "RADAR_DB_PASSWORD", "RADAR_DB_USER"]) {
      assert.equal(services.web.environment[key], undefined, `${key} exposed to web`);
      assert.equal(services.scheduler.environment[key], undefined, `${key} exposed to scheduler`);
    }
    assert.equal(services.scheduler.environment.DATABASE_READER_URL, undefined);
    assert.equal(services.scheduler.environment.DATABASE_EDITOR_URL, undefined);
    assert.equal(services.scheduler.environment.RADAR_RESEND_API_KEY, undefined);
    assert.ok(!JSON.stringify(services.web).includes(env.RADAR_DB_PASSWORD));
    assert.equal(services.scheduler.environment.CRON_SECRET, env.CRON_SECRET);
    await writeFile(file, Object.entries(env).filter(([key]) => key !== "DATABASE_READER_URL").map(([key, value]) => `${key}=${value}`).join("\n"));
    assert.throws(render, /DATABASE_READER_URL/);
  } finally {
    // Remove exclusivamente o arquivo sintético criado pelo próprio teste.
    await unlink(file); await rmdir(dir);
  }
});
