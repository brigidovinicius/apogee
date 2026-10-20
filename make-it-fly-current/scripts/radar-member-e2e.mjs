// Positive session validation against a disposable CI database and synthetic Radar bridge.
// No production credentials, cookies, users or catalogue are read by this test.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { createServer as portProbe } from "node:net";
import { randomBytes } from "node:crypto";
import { access, cp, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import postgres from "postgres";

assert.equal(process.env.CI, "true", "Run only in disposable CI");
const adminUrl = new URL(process.env.GALLERY_TEST_DATABASE_URL || "http://missing");
assert.equal(adminUrl.hostname, "127.0.0.1");
assert.equal(adminUrl.pathname, "/apogee_gallery_ci");
const admin = postgres(adminUrl.href, { ssl: false, max: 1 });
await admin.unsafe('CREATE DATABASE apogee_member_radar_ci');
await admin.end();
const databaseUrl = new URL(adminUrl); databaseUrl.pathname = "/apogee_member_radar_ci";
const database = postgres(databaseUrl.href, { ssl: false, max: 1 });
const journal = JSON.parse(await readFile("drizzle/meta/_journal.json", "utf8"));
for (const entry of journal.entries) await database.unsafe(await readFile(`drizzle/${entry.tag}.sql`, "utf8"));

const base = { institution: "Synthetic university", officialUrl: "https://example.edu/notice", lastCheckedAt: new Date().toISOString(),
  applicantType: "mixed", benefitType: "other", categories: ["eventos"], deadlineAt: "2099-12-31", deadlinePrecision: "date_only",
  opportunityStatus: "open", requirementsText: "Equipes de estudantes. Modalidade presencial.", amountText: "Inscrição gratuita.", stateCode: "SC", cityName: "Florianópolis" };
const events = Array.from({ length: 30 }, (_, i) => ({ ...base, id: `event-${i}`, title: `CI Evento ${String(i).padStart(2, "0")}` }));
const exams = ["Química", "Informática"].map((course, i) => ({ ...base, id: `exam-${i}`, title: `CI ${course} Gaspar`, isCourse: true,
  cityName: "Gaspar", categories: ["formacao"], admissionProcess: { id: "ci-ifsc", title: "CI IFSC Ingresso" } }));
exams.push({ ...exams[0], id: "other-campus", title: "CI Curso Joinville", cityName: "Joinville", admissionProcess: { id: "ci-ifc", title: "CI IFC Ingresso" } });
const bridge = createServer((request, response) => {
  if (request.headers.authorization !== "Bearer synthetic-ci-radar-only") { response.writeHead(401).end(); return; }
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify({ version: 3, opportunities: [...exams, ...events] }));
});
await new Promise(done => bridge.listen(0, "127.0.0.1", done));
const bridgePort = bridge.address().port;
const probe = portProbe(); await new Promise(done => probe.listen(0, "127.0.0.1", done));
const port = probe.address().port; await new Promise(done => probe.close(done));
const origin = `http://127.0.0.1:${port}`;
const authOrigin = "https://apogee-ci.example";
const standalone = resolve(".next/standalone");
await access(resolve(standalone, "server.js"));
await cp(resolve("public"), resolve(standalone, "public"), { recursive: true });
await cp(resolve(".next/static"), resolve(standalone, ".next/static"), { recursive: true });
const server = spawn(process.execPath, [resolve(standalone, "server.js")], { cwd: standalone,
  env: { PATH: process.env.PATH, NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1", PORT: String(port), HOSTNAME: "127.0.0.1",
    BETTER_AUTH_URL: authOrigin, BETTER_AUTH_SECRET: randomBytes(32).toString("hex"), DATABASE_URL: databaseUrl.href,
    DATABASE_SSL_MODE: "disable", RADAR_ACADEMICO_API_URL: `http://127.0.0.1:${bridgePort}/api/public/opportunities`, RADAR_ACADEMICO_API_TOKEN: "synthetic-ci-radar-only" },
  stdio: ["ignore", "pipe", "pipe"] });
let logs = ""; server.stdout.on("data", chunk => { logs = (logs + chunk).slice(-5000); }); server.stderr.on("data", chunk => { logs = (logs + chunk).slice(-5000); });
const get = (path, cookie = "") => fetch(origin + path, { headers: cookie ? { Cookie: cookie } : {}, redirect: "manual", signal: AbortSignal.timeout(10000) });
const titles = html => [...html.matchAll(/<h3[^>]*>([^<]+)<\/h3>/g)].map(match => match[1]).filter(title => title.startsWith("CI Evento"));
try {
  let ready = false;
  for (let i = 0; i < 60; i++) { try { await get("/"); ready = true; break; } catch { await new Promise(done => setTimeout(done, 500)); } }
  assert.ok(ready, "standalone server starts");
  assert.ok([302, 303, 307, 308].includes((await get("/membros/oportunidades")).status));
  const signUp = await fetch(origin + "/api/auth/sign-up/email", { method: "POST", headers: { "Content-Type": "application/json", Origin: authOrigin },
    body: JSON.stringify({ name: "Synthetic Radar CI", username: "synthetic_radar_ci", email: "synthetic-radar@example.test", password: "Synthetic-CI-only-password-2026" }) });
  assert.equal(signUp.status, 200, "real Better Auth signup succeeds in the disposable database");
  const cookie = signUp.headers.getSetCookie().map(value => value.split(";")[0]).join("; ");
  assert.ok(cookie, "session cookie is issued");
  assert.equal((await database`select role from public."user" where email='synthetic-radar@example.test'`)[0].role, "member");
  const response = await get("/membros/oportunidades", cookie); assert.equal(response.status, 200);
  const initial = await response.text(); assert.match(initial, /Radar completo/); assert.equal(titles(initial).length, 24); assert.doesNotMatch(initial, /CI IFSC Ingresso|CI IFC Ingresso/);
  const second = await (await get("/membros/oportunidades?pagina=2", cookie)).text();
  assert.equal(titles(second).length, 6); assert.equal(titles(second).filter(title => titles(initial).includes(title)).length, 0);
  const allExams = await (await get("/membros/oportunidades?categoria=vestibular", cookie)).text();
  assert.match(allExams, /CI IFSC Ingresso/); assert.match(allExams, /CI IFC Ingresso/); assert.doesNotMatch(allExams, /CI Evento/);
  const localExams = await (await get("/membros/oportunidades?categoria=vestibular&uf=SC&cidade=Gaspar", cookie)).text();
  assert.match(localExams, /CI Química Gaspar/); assert.match(localExams, /CI Informática Gaspar/); assert.doesNotMatch(localExams, /CI Curso Joinville|CI IFC Ingresso/);
  const searched = await (await get("/membros/oportunidades?categoria=vestibular&uf=SC&cidade=Gaspar&busca=quimica", cookie)).text();
  assert.match(searched, /CI Química Gaspar/); assert.doesNotMatch(searched, /CI Informática Gaspar/);
  const cleared = await (await get("/membros/oportunidades?categoria=Todas", cookie)).text();
  assert.equal(titles(cleared).length, 24); assert.doesNotMatch(cleared, /CI IFSC Ingresso|CI IFC Ingresso/);
  const deniedAdmin = await get("/admin/radar", cookie);
  const deniedAdminBody = await deniedAdmin.text();
  const deniedLocation = deniedAdmin.headers.get("location");
  if (deniedLocation) assert.equal(new URL(deniedLocation, origin).pathname, "/admin/acesso-negado");
  else assert.match(deniedAdminBody, /NEXT_REDIRECT[\s\S]*\/admin\/acesso-negado/, "ordinary member is redirected to the existing access-denied page");
  assert.doesNotMatch(deniedAdminBody, /Radar · catálogo ao vivo|Criar oportunidade|CI Evento|CI IFSC Ingresso/);
  const invalid = await get("/membros/oportunidades", "better-auth.session_token=invalid.synthetic");
  const invalidBody = await invalid.text(); assert.doesNotMatch(invalidBody, /CI Evento|CI IFSC Ingresso/);
  console.log("Authenticated Radar E2E OK: real session, pagination, explicit vestibular, SC/Gaspar, search, reset and access controls.");
} catch (error) { console.error(logs); throw error; }
finally {
  server.kill("SIGTERM");
  await new Promise(done => { if (server.exitCode !== null) return done(); const timer = setTimeout(() => server.kill("SIGKILL"), 3000); server.once("exit", () => { clearTimeout(timer); done(); }); });
  await new Promise(done => bridge.close(done)); await database.end();
}
