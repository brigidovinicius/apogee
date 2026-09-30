/** Manual integration test. Creates four retained synthetic applications; never purchases or deletes. */
import { randomUUID } from "node:crypto";

const EXPECTED_PROJECT = "oqvartwafnclxuqpkltp";
class CheckFailure extends Error {}
const check = (condition, message) => {
  if (!condition) throw new CheckFailure(message);
};

function config() {
  check(process.env.MAKEITFLY_RUN_LIVE_TESTS === "1", "Bloqueado: defina MAKEITFLY_RUN_LIVE_TESTS=1 somente após autorizar os quatro registros de teste.");
  const database = new URL(process.env.SUPABASE_URL || "about:blank");
  check(database.href === `https://${EXPECTED_PROJECT}.supabase.co/`, "Bloqueado: SUPABASE_URL não é o projeto Make It Fly esperado.");
  const origin = new URL(process.env.MAKEITFLY_TEST_ORIGIN || "about:blank");
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname);
  const isolatedCopy = origin.protocol === "https:" && origin.hostname.endsWith(".netlify.app");
  check((local && ["http:", "https:"].includes(origin.protocol)) || isolatedCopy, "Bloqueado: use localhost ou uma cópia isolada netlify.app, nunca a produção Vercel.");
  check(!origin.username && !origin.password && !origin.search && !origin.hash && origin.pathname === "/", "Bloqueado: a origem de teste deve conter apenas protocolo, host e porta.");
  check(process.env.APPLICATION_ORIGIN === origin.origin, "Bloqueado: APPLICATION_ORIGIN deve ser idêntica a MAKEITFLY_TEST_ORIGIN, sem barra final.");
  const privateKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const publicKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  validateKey(privateKey, "service_role");
  if (publicKey) validateKey(publicKey, "anon");
  return { database: database.origin, origin: origin.origin, privateKey, publicKey };
}

function validateKey(key, role) {
  const prefix = role === "service_role" ? "sb_secret_" : "sb_publishable_";
  if (key.startsWith(prefix) && /^[A-Za-z0-9_-]+$/.test(key) && key.length > prefix.length + 20) return;
  let payload;
  try {
    const parts = key.split(".");
    if (parts.length === 3) payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch { /* Do not expose key contents in errors. */ }
  check(payload?.role === role && payload?.ref === EXPECTED_PROJECT, `Bloqueado: forneça uma chave ${role === "anon" ? "publishable/anon" : "secret/service_role"} válida do projeto esperado.`);
}

function databaseHeaders(key) {
  return { apikey: key, ...(!key.startsWith("sb_") ? { Authorization: `Bearer ${key}` } : {}) };
}

async function request(url, init = {}) {
  try {
    return await fetch(url, { ...init, redirect: "manual", signal: AbortSignal.timeout(15_000) });
  } catch {
    throw new CheckFailure("Falha de rede ou timeout. Os registros anteriores podem ter sido gravados; não reexecute sem conferir.");
  }
}

async function json(response) {
  try { return await response.json(); }
  catch { throw new CheckFailure("Resposta JSON inválida; conteúdo omitido para preservar dados e credenciais."); }
}

function verifyReceipt(body) {
  check(body && !Array.isArray(body) && body.received === true, "O recibo não confirmou o recebimento da aplicação.");
  check(Object.keys(body).join(",") === "received", "O recibo expôs score, elegibilidade ou destino de checkout.");
}

async function submit(settings, payload, status) {
  const response = await request(`${settings.origin}/api/applications`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: settings.origin },
    body: JSON.stringify(payload),
  });
  check(response.status === status, `POST /api/applications: esperado HTTP ${status}, recebido ${response.status}. ${response.status === 429 ? "Aguarde a janela de dez minutos; não contorne o limite." : "Confira configuração e serviços sem registrar dados sensíveis."}`);
  check(response.headers.get("cache-control")?.includes("no-store"), "O endpoint deve impedir cache das respostas.");
  check(response.headers.get("referrer-policy") === "no-referrer", "O endpoint deve impedir vazamento de referrer.");
  check(response.headers.get("x-robots-tag")?.includes("noindex"), "O endpoint deve impedir indexação.");
  const body = await json(response);
  if (status !== 409) verifyReceipt(body);
  return body;
}

async function main() {
  const settings = config();
  const runId = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const cases = [[false, false], [false, true], [true, false], [true, true]].map(([hasIdea, usesPaidAI], index) => ({
    name: `TESTE INTERNO ${runId} ${index + 1}`,
    email: `teste.${runId}.${index + 1}@example.com`,
    phone: `+1 202 555 010${index + 1}`,
    age: 28,
    profession: "Teste de produto",
    hasIdea,
    ideaDescription: "",
    hasLaptop: true,
    usesPaidAI,
    idempotencyKey: randomUUID(),
    website: "",
    utmSource: "teste-interno",
    utmCampaign: `verificacao-${runId}`,
  }));
  const probeUrl = `${settings.database}/rest/v1/applications?select=id&idempotency_key=eq.${cases[0].idempotencyKey}&limit=1`;
  const probe = await request(probeUrl, { headers: databaseHeaders(settings.privateKey) });
  check(probe.status === 200, `Conexão privada à tabela falhou: HTTP ${probe.status}. Nenhum formulário foi enviado.`);
  const probeRows = await json(probe);
  check(Array.isArray(probeRows) && probeRows.length === 0, "A consulta privada inicial retornou um resultado inesperado. Nenhum formulário foi enviado.");
  console.log("OK: conectividade privada ao projeto esperado (consulta filtrada, sem listar inscrições).");

  if (settings.publicKey) {
    const response = await request(probeUrl, { headers: databaseHeaders(settings.publicKey) });
    const body = await json(response);
    check([401, 403].includes(response.status) && body?.code === "42501", "ACL falhou: a chave pública não recebeu a negação de permissão esperada. Nenhum formulário foi enviado.");
    console.log("OK: leitura com chave pública negada pelo banco (42501).");
  } else {
    console.log("NÃO VERIFICADO: ACL pública; SUPABASE_PUBLISHABLE_KEY/SUPABASE_ANON_KEY não fornecida.");
  }

  console.log(`Iniciando quatro registros sintéticos retidos, marcador TESTE INTERNO ${runId}.`);
  for (const payload of cases) await submit(settings, payload, 201);
  await submit(settings, cases[3], 200);
  await submit(settings, { ...cases[3], name: `${cases[3].name} ALTERADO` }, 409);

  const fields = "idempotency_key,name,email,phone,age,profession,has_idea,idea_description,has_laptop,uses_paid_ai,eligible,status,checkout_started_at,purchased_at";
  const ids = cases.map((payload) => payload.idempotencyKey).join(",");
  const response = await request(`${settings.database}/rest/v1/applications?select=${fields}&idempotency_key=in.(${ids})`, { headers: databaseHeaders(settings.privateKey) });
  check(response.status === 200, `Conferência dos quatro registros falhou: HTTP ${response.status}.`);
  const rows = await json(response);
  check(Array.isArray(rows) && rows.length === 4, "Persistência/idempotência falhou: devem existir exatamente quatro registros para os UUIDs desta execução.");
  for (const payload of cases) {
    const matches = rows.filter((row) => row.idempotency_key === payload.idempotencyKey);
    check(matches.length === 1, "Persistência/idempotência falhou: UUID ausente ou duplicado.");
    const row = matches[0];
    const eligible = payload.age >= 18 && payload.age <= 35 && payload.hasIdea && payload.hasLaptop && payload.usesPaidAI;
    check(row.name === payload.name && row.email === payload.email && row.phone === payload.phone.replace(/\D/g, ""), "Dados sintéticos normalizados foram alterados ou não persistiram corretamente.");
    check(row.age === payload.age && row.profession === payload.profession && row.has_idea === payload.hasIdea && row.has_laptop === payload.hasLaptop && row.uses_paid_ai === payload.usesPaidAI && row.eligible === eligible, "A elegibilidade gerada pelo banco diverge das respostas.");
    check(row.idea_description === null, "A descrição opcional vazia deve ser armazenada como null.");
    check(row.status === (eligible ? "APPROVED" : "NOT_ELIGIBLE") && row.checkout_started_at === null && row.purchased_at === null, "Status/timestamps indevidos: o teste não acessou checkout nem confirmou compra.");
  }
  console.log("OK: quatro combinações persistidas; score mantido apenas no banco; reenvio sem duplicação; conflito rejeitado sem alterar dados.");
  console.log("Quatro linhas TESTE INTERNO mantidas no banco. Nenhum visitante recebeu score ou link de checkout; nenhuma compra ou exclusão foi executada.");
}

main().catch((error) => {
  // Never print network errors, response bodies, stack traces, credentials or tokens.
  console.error(error instanceof CheckFailure ? error.message : "Falha inesperada de validação; detalhes omitidos para preservar informações sensíveis.");
  process.exitCode = 1;
});
