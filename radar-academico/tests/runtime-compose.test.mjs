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
    RADAR_AI_KEY_PATH: join(dir, "ai.env"), RADAR_AI_DATABASE_URL_PATH: join(dir, "ai-db"),
  };
  const render = () => JSON.parse(execFileSync("docker", ["compose", "--env-file", file, "-f", resolve("infra/vps/docker-compose.yml"), "--profile", "migrate", "--profile", "ai", "config", "--format", "json"], {
    encoding: "utf8", env: { PATH: process.env.PATH, HOME: process.env.HOME }, stdio: "pipe",
  }));
  try {
    await writeFile(env.RADAR_AI_KEY_PATH, "SYNTHETIC_KEY=fixture-only\n", { mode: 0o600 });
    await writeFile(env.RADAR_AI_DATABASE_URL_PATH, "synthetic-db-only\n", { mode: 0o600 });
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
    const ai = services["ai-worker"];
    assert.deepEqual(ai.profiles, ["ai"]);
    assert.equal(ai.build.target, "ai-runner");
    assert.deepEqual(Object.keys(ai.environment).sort(), ["RADAR_AI_DATABASE_URL_FILE", "RADAR_AI_ENABLED", "RADAR_AI_KEY_FILE", "RADAR_AI_ORGANIZATION_ID", "RADAR_AI_PROJECT_ID"]);
    assert.equal(String(ai.environment.RADAR_AI_ENABLED), "false");
    assert.deepEqual(Object.keys(ai.networks).sort(), ["ai_egress", "internal"]);
    assert.deepEqual(ai.secrets.map(item => item.source).sort(), ["radar_ai_database_url", "radar_ai_openai_env"]);
    assert.equal(ai.depends_on, undefined);
    assert.equal(ai.ports, undefined);
    assert.equal(ai.read_only, true);
    for (const service of [services.web, services.scheduler]) {
      assert.equal(service.depends_on?.["ai-worker"], undefined);
      assert.equal(service.environment.RADAR_AI_ENABLED, undefined);
      assert.equal(service.environment.OPENAI_API_KEY, undefined);
    }
    await writeFile(file, Object.entries(env).filter(([key]) => key !== "DATABASE_READER_URL").map(([key, value]) => `${key}=${value}`).join("\n"));
    assert.throws(render, /DATABASE_READER_URL/);
  } finally {
    // Remove exclusivamente o arquivo sintético criado pelo próprio teste.
    await unlink(file); await unlink(env.RADAR_AI_KEY_PATH); await unlink(env.RADAR_AI_DATABASE_URL_PATH); await rmdir(dir);
  }
});
