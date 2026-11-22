// Run once through npm-queue. Owns a bounded review server and synthetic DB.
// Uses HTTP and native server-rendered forms; does not claim visual/browser QA.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const origin = "http://127.0.0.1:3474";
const report = { method: "HTTP; no browser rendering", origin, results: [] };
const destination = new URL(new URL(import.meta.url).searchParams.has("final") ? "../../.local/member-experience-http-final.json" : "../../.local/member-experience-http.json", import.meta.url);
await mkdir(new URL("../../.local/", import.meta.url), { recursive: true });
const reuse = new URL(import.meta.url).searchParams.get("reuse") === "owned";
const finish = new URL(import.meta.url).searchParams.has("finish");
if (reuse) {
  const state = JSON.parse(await readFile("/private/tmp/apogee-member-experience-20261116-review-state.json", "utf8"));
  const owner = JSON.parse(await readFile(new URL("fixture-owner.json", new URL(`file://${state.dir}/`)), "utf8"));
  assert.equal(owner.workspace, fileURLToPath(new URL("../", import.meta.url)));
  assert.equal(owner.purpose, "apogee-native-community-fixture");
  assert.equal(new URL(state.url).hostname, "127.0.0.1");
}
const server = reuse ? null : spawn(process.execPath, ["scripts/local-offer-review.mjs"], { stdio: "inherit", env: {
  ...process.env, APOGEE_REVIEW_INSTANCE: "member-experience-20261116", APOGEE_REVIEW_PORT: "3474", APOGEE_REVIEW_DURATION_SECONDS: "900",
} });
server?.on("exit", code => { if (code && !report.completed) process.exitCode = code; });
let cookie = "", profile = "anonymous";
const clean = html => html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
const decode = value => value.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const attr = (tag, name) => decode(tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1] ?? "");
async function request(path, options = {}) {
  assert.ok(path.startsWith("/") && !path.startsWith("//"));
  for (let attempt = 0; ; attempt++) {
    try { return await fetch(origin + path, { redirect: "manual", ...options, headers: { ...(cookie ? { cookie } : {}), ...options.headers } }); }
    catch (error) {
      // A GET is safe to retry across the dev server's automatic memory restart.
      if (options.method === "POST" || attempt >= 5) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}
async function page(path, expected, status = 200) {
  const response = await request(path), html = await response.text();
  assert.equal(response.status, status, `${profile}: ${path}`);
  if (expected) assert.match(clean(html), expected, `${profile}: ${path}`);
  report.results.push({ profile, path, status, result: "passed" });
  return html;
}
async function login(name) {
  const response = await request("/api/auth/sign-in/email", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify({ email: `${name}@example.test`, password: "RevisaoLocal2026!" }) });
  assert.equal(response.status, 200, `login ${name}`);
  cookie = response.headers.getSetCookie().map(value => value.split(";")[0]).join("; ");
  assert.ok(cookie); profile = name;
  report.results.push({ profile, path: "/api/auth/sign-in/email", status: 200, result: "passed" });
}
async function submit(path, html, select, values = {}) {
  const form = [...clean(html).matchAll(/<form\b[^>]*>[\s\S]*?<\/form>/g)].map(match => match[0]).find(select);
  assert.ok(form, `Form not found at ${path}`);
  const data = new FormData();
  for (const input of form.matchAll(/<input\b[^>]*>/g)) {
    const name = attr(input[0], "name"), type = attr(input[0], "type");
    if (name && (type !== "radio" && type !== "checkbox" || /\bchecked(?:=|\s|\/|>)/.test(input[0]))) data.append(name, attr(input[0], "value"));
  }
  assert.ok([...data.keys()].some(key => key.startsWith("$ACTION_")), "Must use the real Next server action");
  for (const [key, value] of Object.entries(values)) data.set(key, String(value));
  const response = await request(path, { method: "POST", headers: { Origin: origin }, body: data });
  assert.ok([200, 303].includes(response.status), `POST ${path}: ${response.status}`);
  report.results.push({ profile, path, method: "POST real server action", status: response.status, result: "passed" });
  await response.text();
  return response.headers.get("location");
}
try {
  for (let attempt = 0; ; attempt++) {
    try { if ((await request("/membros/entrar")).status === 200) break; } catch { /* Own dev server is compiling. */ }
    if (attempt >= 90) throw Error("Local review server did not become ready.");
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  let ownCollection;
  if (finish) {
    assert.ok(reuse, "A checkpoint must reuse its owned review instance");
    const previous = JSON.parse(await readFile(destination, "utf8"));
    assert.equal(previous.origin, origin);
    assert.ok(previous.results.length >= 40);
    ownCollection = previous.results.find(row => row.profile === "revisaoanual" && /^\/membros\/colecoes\/[a-f0-9-]+$/.test(row.path))?.path;
    assert.ok(ownCollection, "The prior run must have created and read its own collection");
    report.results.push(...previous.results);
  } else {
  await page("/membros/suporte", /Como podemos ajudar/);
  await page("/membros/trilha", null, 404);
  const protectedResponse = await request("/membros");
  assert.equal(protectedResponse.status, 307);
  assert.match(protectedResponse.headers.get("location"), /\/membros\/entrar/);
  await login("revisaopendente");
  const home = await page("/membros", /Sua comunidade/);
  assert.match(home, /Minha conta/); assert.match(home, /Sair da conta/);
  for (const part of ["ferramentas", "beneficios"]) {
    const html = await page(`/membros/${part}`, new RegExp(`data-locked-preview="${part}"`));
    assert.doesNotMatch(html, /https:\/\/labs\.google|Escolha uma tarefa real|PRIVATE_INSTRUCTIONS/);
  }
  await page("/membros/meu-calendario", /data-locked-preview="calendario"/);
  await page("/membros/colecoes", /data-locked-preview="colecoes"/);
  await page("/membros/perfil/editar", /data-locked-preview="perfil"/);
  await page("/membros/forum/boas-vindas", /data-locked-preview="forum"/);
  assert.doesNotMatch(clean(await page("/membros/assinatura", /assinatura/i)), /trilha|primeiro resultado com IA/i);
  await page("/membros/protecao", /Confirme seu e-mail/);
  await page("/oportunidades", /Minha conta/);
  const logoutAt = "/membros/ferramentas", logoutHtml = await page(logoutAt, /Sair da conta/);
  assert.match(await submit(logoutAt, logoutHtml, form => form.includes("Sair da conta")), /\/membros\/entrar/);
  assert.equal(await (await request("/api/auth/get-session")).json(), null);
  report.results.push({ profile, path: "logout revokes session", result: "passed" });
  cookie = "";
  await login("revisaolivre");
  await page("/membros", /Conversas da comunidade/);
  await page("/membros/forum/boas-vindas", /Novo tópico/);
  await page("/membros/perfil/editar", /Editar perfil/);
  await page("/membros/meu-calendario", /Conhecer a assinatura anual/);
  const firstPath = "/membros/oportunidades/radar-review-event-1";
  const detail = await page(firstPath, /Usar consulta gratuita|Detalhe protegido/);
  if (detail.includes(">Usar consulta gratuita</button>")) {
    assert.match(clean(detail).replace(/<!--.*?-->/g, ""), /0 de 10 eventos distintos/);
    await submit(firstPath, detail, form => form.includes(">Usar consulta gratuita</button>"));
  }
  const opened = await page(firstPath, /Detalhe protegido/);
  assert.match(clean(opened).replace(/<!--.*?-->/g, ""), /1 de 10 eventos distintos/);
  assert.doesNotMatch(clean(opened), /Usar consulta gratuita/);
  assert.match(clean(await page(firstPath, /Detalhe protegido/)).replace(/<!--.*?-->/g, ""), /1 de 10 eventos distintos/);
  const denied = await request("/admin/usuarios"), deniedHtml = await denied.text();
  // Next can stream a redirect after the shell has already sent HTTP 200.
  assert.ok(denied.headers.get("location")?.includes("/admin/acesso-negado") || deniedHtml.includes("/admin/acesso-negado"));
  assert.doesNotMatch(clean(deniedHtml), /Contas encontradas|revisaoanual@example\.test/);
  report.results.push({ profile, path: "/admin/usuarios", status: denied.status, result: "denied as expected" });
  await login("revisaolimite");
  await page("/membros/oportunidades/radar-review-event-11", /Conhecer a comunidade|assinatura/i);
  await page(firstPath, /Detalhe protegido/);
  await login("revisaoanual");
  await page("/membros/ferramentas", /Google Flow/);
  assert.doesNotMatch(clean(await page("/membros", /Conversas da comunidade/)), /trilha|primeiro resultado com IA/i);
  await page("/membros/trilha", null, 404);
  const progress = await request("/membros/trilha", { method: "POST", headers: { Origin: origin }, body: new URLSearchParams({ activityId: "fixture", completed: "true" }) });
  assert.ok([404, 405].includes(progress.status), `retired progress endpoint: ${progress.status}`);
  await progress.text();
  await page("/membros/beneficios", /Nenhum benefício confirmado/);
  await page("/membros/meu-calendario", /Minhas oportunidades salvas/);
  const collections = await page("/membros/colecoes", /Criar coleção privada/);
  ownCollection = await submit("/membros/colecoes", collections, form => form.includes("Criar coleção privada"), { name: "Coleção sintética de navegação", description: "Somente validação local", cover: "aurora" });
  assert.match(ownCollection, /^\/membros\/colecoes\/[a-f0-9-]+$/);
  await page(ownCollection, /Coleção sintética de navegação/);
  const unlimited = await page(firstPath, /Salvar no meu calendário/);
  await submit(firstPath, unlimited, form => form.includes("Salvar no meu calendário"));
  await page("/membros/meu-calendario", /Evento de validação 01/);
  }
  await login("revisaocancelada");
  await page("/membros/ferramentas", /Google Flow/);
  await page("/membros/trilha", null, 404);
  const otherCollection = await request(ownCollection), missing = clean(await otherCollection.text());
  assert.match(missing, /Página não encontrada|<meta name="next-error" content="not-found"/);
  assert.doesNotMatch(missing, /Coleção sintética de navegação/);
  report.results.push({ profile, path: "foreign collection", status: otherCollection.status, result: "not-found state; private collection absent" });
  await login("revisaolegado");
  await page("/membros/meu-calendario", /Minhas oportunidades salvas/);
  await page("/membros/ferramentas", /data-locked-preview="ferramentas"/);
  for (const name of ["revisaoexpirado", "revisaoreembolso"]) {
    await login(name);
    await page("/membros/ferramentas", /data-locked-preview="ferramentas"/);
    await page("/membros/trilha", null, 404);
  }
  await login("revisaoadmin");
  await page("/admin/trilha", /Um primeiro resultado com IA/);
  await page("/membros/trilha", null, 404);
  await login("revisaopendente");
  await page("/membros", /Sua comunidade/);
  report.completed = true;
  console.log(`HTTP QA APROVADO: ${report.results.length} verificações. Prévia local em ${origin}/membros, conta gratuita disponível no guia /previa/validacao.`);
} catch (error) {
  report.failure = error.message;
  console.error("HTTP QA FALHOU:", error.message);
  process.exitCode = 1;
} finally {
  await writeFile(destination, JSON.stringify(report, null, 2));
  console.log("Relatório sem cookies ou dados reais:", destination.pathname);
  // The explicitly bounded review process finishes normally; keep its preview available.
}
