import assert from "node:assert/strict";
import test from "node:test";
import { opportunityLoader } from "./helpers/load-opportunity-module.mjs";

const { createGoogleLoginFlow, googleCompletionPath, googleLoginDestination } = opportunityLoader()("lib/members/google-login-flow.ts");
const flush = () => new Promise(resolve => setImmediate(resolve));

function fixture(overrides = {}) {
  const events = [], timers = [];
  let time = 0, session = false;
  const popup = { location: { replace: value => events.push(["popup", value]) }, close: () => events.push(["close"]) };
  Object.defineProperty(popup, "closed", { get() { throw Error("COOP severs the reference"); } });
  const ports = {
    origin: "https://apogee.test", open: () => { events.push(["open"]); return popup; },
    signIn: async options => { events.push(["api", options]); return { data: { url: "https://accounts.google.com/o/oauth2/v2/auth" } }; },
    hasSession: async () => session, replace: path => events.push(["replace", path]),
    message: text => events.push(["message", text]), finish: () => events.push(["finish"]),
    now: () => time, schedule: (callback, delay) => { timers.push({ callback, delay }); return timers.length; },
    clear: () => {}, ...overrides,
  };
  return { events, timers, ports, setSession: value => { session = value; }, setTime: value => { time = value; } };
}

test("Google popup opens on the gesture; only a server-confirmed session replaces the originating login", async () => {
  const f = fixture();
  const next = "/membros/oportunidades?categoria=competicoes&busca=ci%C3%AAncia&pagina=2#resultados";
  const flow = createGoogleLoginFlow(f.ports, next);
  flow.start(); flow.start();
  await flush();
  assert.deepEqual(f.events.slice(0, 2).map(e => e[0]), ["open", "api"]);
  const options = f.events.find(e => e[0] === "api")[1];
  assert.equal(options.disableRedirect, true);
  assert.equal(new URL(options.callbackURL, f.ports.origin).searchParams.get("next"), next);
  assert.equal(options.requestSignUp, false);
  assert.equal(f.events.some(e => e[0] === "replace"), false);
  assert.equal(f.timers[0].delay, 2000);
  f.setSession(true); f.timers.shift().callback(); await flush();
  assert.deepEqual(f.events.filter(e => e[0] === "replace"), [["replace", next]]);
  assert.equal(f.events.filter(e => e[0] === "finish").length, 1);
});

test("blocked popup leaves login and history intact without contacting Google", async () => {
  const f = fixture({ open: () => null });
  createGoogleLoginFlow(f.ports, "/admin/posts").start(); await flush();
  assert.equal(f.events.some(e => ["api", "replace"].includes(e[0])), false);
  assert.match(f.events.find(e => e[0] === "message")[1], /Permita a janela/);
});

test("cancellation ignores an API response that arrives later", async () => {
  let resolve;
  const f = fixture({ signIn: () => new Promise(r => { resolve = r; }) });
  const flow = createGoogleLoginFlow(f.ports, "/admin/posts");
  flow.start(); flow.cancel(); resolve({ data: { url: "https://accounts.google.com/o/oauth2/v2/auth" } }); await flush();
  assert.equal(f.events.some(e => ["popup", "replace"].includes(e[0])), false);
  assert.equal(f.timers.length, 0);
});

test("cancellation ignores a session check that arrives after unmount", async () => {
  let resolve;
  const f = fixture({ hasSession: () => new Promise(r => { resolve = r; }) });
  const flow = createGoogleLoginFlow(f.ports, "/admin/posts"); flow.start(); await flush(); flow.cancel(); resolve(true); await flush();
  assert.equal(f.events.some(e => e[0] === "replace"), false);
});

test("provider errors do not navigate or expose provider descriptions", async () => {
  const f = fixture({ signIn: async () => ({ error: { code: "access_denied", message: "private-provider-data" } }) });
  createGoogleLoginFlow(f.ports, "/admin/posts").start(); await flush();
  assert.equal(f.events.some(e => ["replace", "popup"].includes(e[0])), false);
  assert.match(f.events.find(e => e[0] === "message")[1], /cancelada/);
  assert.doesNotMatch(JSON.stringify(f.events), /private-provider-data/);
});

test("an untrusted provider URL never opens in the popup", async () => {
  const f = fixture({ signIn: async () => ({ data: { url: "https://attacker.example/" } }) });
  createGoogleLoginFlow(f.ports, "/admin/posts").start(); await flush();
  assert.equal(f.events.some(e => ["replace", "popup"].includes(e[0])), false);
  assert.equal(f.timers.length, 0);
});

test("transient session errors retry; timeout releases the login without navigation", async () => {
  const f = fixture({ hasSession: async () => { throw Error("network"); } });
  createGoogleLoginFlow(f.ports, "/admin/posts").start(); await flush();
  assert.equal(f.timers.length, 1); f.setTime(300_001); f.timers.shift().callback(); await flush();
  assert.equal(f.events.some(e => e[0] === "replace"), false);
  assert.match(f.events.find(e => e[0] === "message")[1], /não foi concluída/);
  assert.equal(f.timers.length, 0);
});

test("signup remains explicit and completion destinations reject external URLs and auth loops", async () => {
  for (const path of ["https://attacker.example/admin", "//attacker.example/admin", "/membros/entrar", "/membros/cadastro", "/membros/entrar/google/concluir"])
    assert.equal(googleLoginDestination(path), "/membros", path);
  assert.equal(googleLoginDestination("/admin/posts?pagina=2"), "/admin/posts?pagina=2");
  const f = fixture(); createGoogleLoginFlow(f.ports, "/membros", true).start(); await flush();
  const options = f.events.find(e => e[0] === "api")[1];
  assert.equal(options.requestSignUp, true);
  assert.equal(options.newUserCallbackURL, googleCompletionPath("/membros"));
});

test("public completion never reports authentication without the actual member guard", async () => {
  const { default: Page } = opportunityLoader({
    "@/lib/members/dal": { getCurrentMember: async () => null },
    "@/components/members/google-login-complete": { GoogleLoginComplete: "GoogleLoginComplete" },
    "next/link": { __esModule: true, default: "Link" },
  })("app/membros/entrar/google/concluir/page.tsx");
  const tree = await Page({ searchParams: Promise.resolve({ next: "https://attacker.example", error: "private-provider-detail" }) });
  const children = tree.props.children;
  assert.equal(children[0].props.children, "Entrada com Google");
  assert.equal(children[2].props.authenticated, false);
  assert.equal(children[3].props.children.props.href, "/membros/entrar?next=%2Fmembros");
  assert.doesNotMatch(JSON.stringify(tree), /private-provider-detail|attacker/);
});

test("proxy exempts exactly the completion UI and still protects arbitrary member/admin routes", async () => {
  const { NextRequest } = await import("next/server.js");
  const { proxy } = opportunityLoader()("proxy.ts");
  assert.equal(proxy(new NextRequest("https://apogee.test/membros/entrar/google/concluir")).status, 200);
  for (const path of ["/membros/entrar/google/concluir/extra", "/admin/posts", "/membros/oportunidades?pagina=2"]) {
    const response = proxy(new NextRequest(`https://apogee.test${path}`));
    assert.equal(response.status, 307);
    assert.equal(new URL(response.headers.get("location")).searchParams.get("next"), path);
  }
});
