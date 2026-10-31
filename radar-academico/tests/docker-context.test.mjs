import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

// Build only a scratch COPY of synthetic fixtures; never start an app or use real .env files.
test("Docker context includes runtime catalogues while excluding research and credentials", { timeout: 60_000 }, async () => {
  const project = new URL("../", import.meta.url);
  const sourceUrl = new URL("src/lib/ingestion/normalize-expansion.ts", project);
  const source = await readFile(sourceUrl, "utf8");
  const imports = [...source.matchAll(/from ["']([^"']*references\/[^"']+\.json)["']/g)].map(match => {
    const url = new URL(match[1], sourceUrl);
    return relative(fileURLToPath(project), fileURLToPath(url)).replaceAll("\\", "/");
  });
  assert.ok(imports.length >= 2, "No runtime reference imports discovered");
  const dir = await mkdtemp(join(tmpdir(), "radar-docker-context-"));
  const context = join(dir, "context"), archive = join(dir, "context.tar");
  const put = async (path, body) => { const file = join(context, path); await mkdir(dirname(file), { recursive: true }); await writeFile(file, body); };
  try {
    await put(".dockerignore", await readFile(new URL(".dockerignore", project)));
    await put("Dockerfile", "FROM scratch\nCOPY . /\n");
    for (const path of imports) await put(path, '{"synthetic":"runtime-catalogue"}');
    for (const path of ["src/__tests__/expansion.test.ts", "tests/docker-context.test.mjs", "references/private-research.txt", "references/radar-expansion-20261030/targets.json", "references/radar-expansion-20261030/access-audit.json"]) await put(path, "synthetic-research-only");
    for (const path of [".env", ".env.production", "infra/vps/.env", "infra/vps/.env.local"]) await put(path, "SYNTHETIC_SECRET=fixture-only\n");
    await put(".env.example", "SYNTHETIC_PLACEHOLDER=example\n");
    execFileSync("docker", ["build", "--progress=quiet", "--output", `type=tar,dest=${archive}`, context], { stdio: "pipe", timeout: 45_000 });
    const files = new Set(execFileSync("tar", ["-tf", archive], { encoding: "utf8" }).split("\n").map(path => path.replace(/^\.\//, "").replace(/\/$/, "")));
    for (const path of imports) assert.ok(files.has(path), `Runtime catalogue missing: ${path}`);
    for (const path of [".env", ".env.production", "infra/vps/.env", "infra/vps/.env.local", "src/__tests__/expansion.test.ts", "tests/docker-context.test.mjs", "references/private-research.txt", "references/radar-expansion-20261030/targets.json", "references/radar-expansion-20261030/access-audit.json"]) assert.ok(!files.has(path), `Excluded file entered build context: ${path}`);
    assert.ok(files.has(".env.example"));
  } finally {
    // Exclusively the synthetic temporary context and archive created by this test.
    await rm(dir, { recursive: true, force: true });
  }
});
