/** Manual production smoke test. Creates two retained synthetic applications; never purchases or deletes. */
import { randomUUID } from "node:crypto";

const origin = "https://makeitfly.vercel.app";
const database = new URL(process.env.SUPABASE_URL || "about:blank");
const databaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
if (process.env.MAKEITFLY_RUN_PRODUCTION_TEST !== "1") throw new Error("Set MAKEITFLY_RUN_PRODUCTION_TEST=1 to authorize two retained synthetic rows.");
if (database.hostname !== "oqvartwafnclxuqpkltp.supabase.co" || !databaseKey) throw new Error("Unexpected or missing Make It Fly database configuration.");

const runId = `${Date.now()}-${randomUUID().slice(0, 8)}`;
const cases = [[true, true], [false, false]].map(([hasIdea, usesPaidAI], index) => ({
  name: `TESTE INTERNO PRODUCAO ${runId} ${index + 1}`,
  email: `teste.producao.${runId}.${index + 1}@example.invalid`,
  phone: `+55 48 99999-000${index}`,
  age: 28,
  profession: "Teste de produto",
  hasIdea,
  ideaDescription: "",
  hasLaptop: true,
  usesPaidAI,
  idempotencyKey: randomUUID(),
  website: "",
  utmSource: "teste-interno",
  utmCampaign: `verificacao-producao-${runId}`,
}));

for (const payload of cases) {
  const application = await fetch(`${origin}/api/applications`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify(payload),
    redirect: "manual",
    signal: AbortSignal.timeout(15_000),
  });
  if (application.status !== 201) throw new Error(`Application failed with HTTP ${application.status}.`);
  const receipt = await application.json();
  if (JSON.stringify(receipt) !== '{"received":true}') throw new Error("Application receipt exposed score or checkout data.");
}

const ids = cases.map(({ idempotencyKey }) => idempotencyKey).join(",");
const stored = await fetch(`${database.origin}/rest/v1/applications?select=idempotency_key,eligible,status,checkout_started_at&idempotency_key=in.(${ids})`, {
  headers: { apikey: databaseKey, ...(!databaseKey.startsWith("sb_") ? { Authorization: `Bearer ${databaseKey}` } : {}) },
  signal: AbortSignal.timeout(15_000),
});
if (stored.status !== 200) throw new Error(`Database verification failed with HTTP ${stored.status}.`);
const rows = await stored.json();
if (!Array.isArray(rows) || rows.length !== 2) throw new Error("Expected two retained production rows.");
for (const payload of cases) {
  const row = rows.find(({ idempotency_key }) => idempotency_key === payload.idempotencyKey);
  const score = payload.age >= 18 && payload.age <= 35 && payload.hasIdea && payload.hasLaptop && payload.usesPaidAI;
  if (!row || row.eligible !== score || row.status !== (score ? "APPROVED" : "NOT_ELIGIBLE") || row.checkout_started_at !== null) throw new Error("Stored score did not match the submitted answers.");
}

console.log(`OK: two production applications persisted (${runId}), including the below-score case.`);
console.log("OK: both visitors received the same neutral receipt; score stayed private and no checkout was released.");
console.log("No purchase was started or completed. Both synthetic rows were retained and clearly labeled.");
