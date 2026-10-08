import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const applicationsSource = await readFile(new URL("../lib/applications.ts", import.meta.url), "utf8");
const applicationsOutput = ts.transpileModule(applicationsSource.replace('import "server-only";', ""), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const applicationsUrl = `data:text/javascript;base64,${Buffer.from(applicationsOutput).toString("base64")}`;
const adminAuthSource = await readFile(new URL("../lib/admin-auth.ts", import.meta.url), "utf8");
const adminAuthOutput = ts.transpileModule(adminAuthSource.replace('import "server-only";', ""), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const adminAuthUrl = `data:text/javascript;base64,${Buffer.from(adminAuthOutput).toString("base64")}`;
const exportSource = await readFile(new URL("../lib/application-export.ts", import.meta.url), "utf8");
const exportOutput = ts.transpileModule(
  exportSource
    .replace('import "server-only";', "")
    .replace('from "@/lib/admin-auth"', `from "${adminAuthUrl}"`)
    .replace('from "@/lib/applications"', `from "${applicationsUrl}"`),
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } },
).outputText;
const api = await import(`data:text/javascript;base64,${Buffer.from(exportOutput).toString("base64")}`);

const TOKEN = "a".repeat(64);
const env = {
  NODE_ENV: "production",
  APPLICATION_ORIGIN: "https://makeitfly.vercel.app",
  APPLICATION_SIGNING_SECRET: "test-secret-not-for-production-1234567890",
  APPLICATION_EXPORT_TOKEN: TOKEN,
  SUPABASE_URL: "https://test-project.supabase.co",
  SUPABASE_SECRET_KEY: "sb_secret_testonly012345678901234567890",
};

const row = {
  id: "00000000-0000-4000-8000-000000000001",
  created_at: "2026-09-13T12:00:00Z",
  name: '=HYPERLINK("https://evil.example")',
  email: "lead@example.com",
  phone: "11999999999",
  has_idea: true,
  idea_description: "Projeto\ncom contexto",
  uses_paid_ai: false,
  eligible: false,
  utm_source: null,
  utm_medium: "social",
  utm_campaign: "setembro",
  utm_content: null,
  referrer: "https://example.com",
  age: 31,
  profession: "Produto digital",
  has_laptop: true,
};

test("export stays private and never queries Supabase with a missing or invalid token", async () => {
  let calls = 0;
  const fetcher = async () => { calls += 1; return Response.json([row]); };
  for (const authorization of [null, "Bearer short", `Bearer ${"b".repeat(64)}`, `Bearer ${"á".repeat(64)}`]) {
    const headers = authorization === null ? {} : { authorization };
    const response = await api.handleApplicationsExportGet(new Request("https://makeitfly.vercel.app/api/applications-export", { headers }), { env, fetcher });
    assert.equal(response.status, 404);
  }
  const querySecret = await api.handleApplicationsExportGet(new Request(`https://makeitfly.vercel.app/api/applications-export?token=${TOKEN}`), { env, fetcher });
  assert.equal(querySecret.status, 404);

  const missingConfig = await api.handleApplicationsExportGet(new Request("https://makeitfly.vercel.app/api/applications-export"), {
    env: { APPLICATION_EXPORT_TOKEN: TOKEN },
    fetcher,
  });
  assert.equal(missingConfig.status, 404);
  assert.equal(calls, 0);
});

test("authorized CSV includes the new profile fields and sanitizes formulas", async () => {
  const calls = [];
  const fetcher = async (url, options) => { calls.push({ url, options }); return Response.json([row]); };
  const response = await api.handleApplicationsExportGet(new Request("https://makeitfly.vercel.app/api/applications-export", {
    headers: { authorization: `Bearer ${TOKEN}` },
  }), { env, fetcher });
  assert.equal(response.status, 200);
  assert.match(calls[0].url, /age,profession,has_laptop&order=created_at\.asc&limit=1000$/);
  const csv = await response.text();
  assert.match(csv, /^"ID","Data de envio","Nome"/);
  assert.match(csv, /"Idade","Profissão ou área","Leva computador\?"/);
  assert.match(csv, /"31","Produto digital","Sim"/);
  assert.match(csv, /"'\=HYPERLINK\(""https:\/\/evil\.example""\)"/);
  assert.match(csv, /"Projeto com contexto"/);
  assert.doesNotMatch(csv, /APPROVED|NOT_ELIGIBLE|payload_hash|idempotency_key/);
});

test("legacy rows export blank new fields and internal tests stay out of the sheet", () => {
  const legacy = { ...row, age: null, profession: null, has_laptop: null };
  const csv = api.applicationsToCsv([
    legacy,
    { ...row, id: "00000000-0000-4000-8000-000000000002", name: "TESTE INTERNO PRODUCAO", email: "flow-check@example.com" },
  ]);
  assert.match(csv, /lead@example\.com/);
  assert.match(csv, /"","",""\r\n$/);
  assert.doesNotMatch(csv, /flow-check@example\.com|TESTE INTERNO PRODUCAO/);
});

test("database errors and invalid new fields fail closed", async () => {
  for (const fetcher of [
    async () => { throw new Error("private database detail"); },
    async () => Response.json({ private: true }, { status: 500 }),
    async () => Response.json([{ ...row, age: "31" }]),
    async () => Response.json([{ ...row, has_laptop: "Sim" }]),
  ]) {
    const response = await api.handleApplicationsExportGet(new Request("https://makeitfly.vercel.app/api/applications-export", {
      headers: { authorization: `Bearer ${TOKEN}` },
    }), { env, fetcher });
    assert.equal(response.status, 503);
    assert.equal((await response.text()).includes(TOKEN), false);
  }
});
