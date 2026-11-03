import assert from "node:assert/strict";
import { after, test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextRequest } from "next/server.js";
import * as navigation from "next/navigation.js";
import { getRedirectTypeFromError, getURLFromRedirectError } from "next/dist/client/components/redirect.js";
import { APIError } from "better-auth";
import { opportunityLoader } from "./helpers/load-opportunity-module.mjs";

const originalEnv = { ...process.env };
after(() => { process.env = originalEnv; });
const origin = "https://www.apogee.community";
const recovery = opportunityLoader()("lib/members/password-recovery.ts");
const { PASSWORD_RESET_INVALID, PASSWORD_RESET_SENT } = recovery;
function form(values) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}
function actions(api) {
  return opportunityLoader({
    "next/headers": { headers: async () => new Headers({ "x-apogee-client-ip": "198.51.100.1" }) },
    "next/navigation": navigation,
    "@/lib/members/auth": { getAuth: () => ({ api }) },
    "@/lib/members/mail": { applicationOrigin: () => origin },
  })("app/membros/esqueci-senha/actions.ts");
}

test("recovery callback retains safe destinations and refuses external, unrelated or credentialed URLs", () => {
  const next = "/admin/posts?pagina=2#fim";
  const callback = recovery.passwordResetCallback(origin, next);
  assert.equal(new URL(callback).searchParams.get("next"), next);
  assert.equal(recovery.normalizePasswordResetCallback(origin, callback + "&token=untrusted#ignored"), callback);
  for (const value of ["https://evil.test/membros/redefinir-senha", "/admin", "https://user:pass@www.apogee.community/membros/redefinir-senha", 42]) {
    assert.throws(() => recovery.normalizePasswordResetCallback(origin, value));
  }
  assert.equal(new URL(recovery.passwordResetCallback(origin, "//evil.test")).searchParams.get("next"), "/membros");
});

test("request validates e-mail and returns the same public state for known and unknown accounts", async () => {
  const calls = [];
  const action = actions({ requestPasswordReset: async input => { calls.push(input); return { status: true }; } }).requestPasswordReset;
  const known = await action({}, form({ email: " MEMBER@example.test ", next: "/admin/posts" }));
  const unknown = await action({}, form({ email: "unknown@example.test" }));
  assert.deepEqual(known, { ok: true, message: PASSWORD_RESET_SENT });
  assert.deepEqual(unknown, known);
  assert.equal(calls[0].body.email, "member@example.test");
  assert.equal(new URL(calls[0].body.redirectTo).searchParams.get("next"), "/admin/posts");
  assert.ok(calls[0].headers.get("x-apogee-client-ip"));
  assert.ok((await action({}, form({ email: "invalid" }))).errors.email);
  assert.equal(calls.length, 2);
});

test("request handles unavailable auth and throttling without exposing input secrets", async () => {
  for (const status of ["INTERNAL_SERVER_ERROR", "SERVICE_UNAVAILABLE", "TOO_MANY_REQUESTS"]) {
    const result = await actions({ requestPasswordReset: async () => { throw { status, body: { message: "private-provider-error" } }; } })
      .requestPasswordReset({}, form({ email: "member@example.test" }));
    assert.equal(result.ok, undefined);
    assert.doesNotMatch(result.message, /private-provider-error/);
    if (status === "TOO_MANY_REQUESTS") assert.match(result.message, /Muitas tentativas/);
  }
});

test("reset checks confirmation and password bounds without returning passwords or token", async () => {
  let calls = 0;
  const action = actions({ resetPassword: async () => { calls++; } }).resetPassword;
  for (const password of ["short", "x".repeat(129)]) {
    const result = await action({}, form({ token: "synthetic-token", password, confirmPassword: password }));
    assert.ok(result.errors.password);
    assert.equal(result.values, undefined);
  }
  const mismatch = await action({}, form({ token: "synthetic-token", password: "new-password", confirmPassword: "different-password" }));
  assert.ok(mismatch.errors.confirmPassword);
  assert.equal((await action({}, form({ token: "", password: "new-password", confirmPassword: "new-password" }))).message, PASSWORD_RESET_INVALID);
  assert.equal(calls, 0);
});

test("successful reset returns to login with safe next and replaces history; invalid tokens remain on form", async () => {
  const input = { token: "synthetic-token", password: "new-password", confirmPassword: "new-password", next: "https://evil.test" };
  let body;
  const action = actions({ resetPassword: async request => { body = request.body; return { status: true }; } }).resetPassword;
  await assert.rejects(action({}, form(input)), error => {
    assert.equal(getURLFromRedirectError(error), "/membros/entrar?senha=redefinida&next=%2Fmembros");
    assert.equal(getRedirectTypeFromError(error), "replace");
    return true;
  });
  assert.deepEqual(body, { token: input.token, newPassword: input.password });
  const failed = await actions({ resetPassword: async () => { throw { status: "BAD_REQUEST", body: { code: "INVALID_TOKEN" } }; } }).resetPassword({}, form(input));
  assert.deepEqual(failed, { message: PASSWORD_RESET_INVALID });
});

function abusePolicy(available = true) {
  process.env.NODE_ENV = "production";
  process.env.APPLICATION_HOSTING_PROVIDER = "caddy";
  const counts = new Map();
  const load = opportunityLoader({
    "./mail": { applicationOrigin: () => origin, memberMailAvailable: () => available },
    "./rate-limit": { consumeRateLimit: async (key, max) => { counts.set(key, (counts.get(key) ?? 0) + 1); return counts.get(key) <= max; } },
  });
  return { enforce: load("lib/members/auth-abuse.ts").enforceMemberAuthAbuse, counts };
}
function context(path, ip = "198.51.100.1", email = "member@example.test") {
  return { path, headers: new Headers(ip ? { "x-apogee-client-ip": ip } : {}), body: { email } };
}

test("recovery requires trusted IP for actions and direct API calls and fails uniformly without mail", async () => {
  for (const path of ["/request-password-reset", "/reset-password"]) {
    const { enforce, counts } = abusePolicy();
    await assert.rejects(enforce(context(path, null)), error => error.statusCode === 503);
    assert.equal(counts.size, 0);
  }
  const { enforce } = abusePolicy(false);
  await assert.rejects(enforce(context("/request-password-reset")), error => error.statusCode === 503);
});

test("recovery has persistent quotas per normalized account and per trusted IP, including direct API", async () => {
  const { enforce, counts } = abusePolicy();
  for (let i = 1; i <= 3; i++) await enforce(context("/request-password-reset", `198.51.100.${i}`, i % 2 ? " MEMBER@EXAMPLE.TEST " : "member@example.test"));
  await assert.rejects(enforce(context("/request-password-reset", "198.51.100.4")), error => error.statusCode === 429);
  for (const key of counts.keys()) assert.ok(!key.includes("member"));
  const policy = abusePolicy();
  for (let i = 0; i < 5; i++) await policy.enforce(context("/request-password-reset", undefined, `member${i}@example.test`));
  await assert.rejects(policy.enforce(context("/request-password-reset", undefined, "sixth@example.test")), error => error.statusCode === 429);
  for (let i = 0; i < 10; i++) await policy.enforce(context("/reset-password"));
  await assert.rejects(policy.enforce(context("/reset-password")), error => error.statusCode === 429);
});

test("direct recovery requests normalize e-mail/callback and reject unsafe callbacks", async () => {
  const { enforce } = abusePolicy();
  const request = context("/request-password-reset", undefined, " MEMBER@EXAMPLE.TEST ");
  await enforce(request);
  assert.equal(request.body.email, "member@example.test");
  assert.equal(request.body.redirectTo, recovery.passwordResetCallback(origin, undefined));
  await assert.rejects(enforce({ ...context("/request-password-reset"), body: { email: "member@example.test", redirectTo: "https://evil.test/membros/redefinir-senha" } }), error => error instanceof APIError && error.statusCode === 400);
});

test("logged-out users can reach both recovery pages; protected routes remain guarded", () => {
  const { proxy } = opportunityLoader()("proxy.ts");
  for (const path of [recovery.FORGOT_PASSWORD_PATH, recovery.RESET_PASSWORD_PATH]) {
    const response = proxy(new NextRequest(origin + path));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("location"), null);
  }
  assert.equal(proxy(new NextRequest(origin + "/membros/perfil/editar")).status, 307);
});

test("reset page handles absent/malformed tokens and provides a new-link path", async () => {
  const page = opportunityLoader({
    "@/components/members/password-recovery-forms": { ResetPasswordForm: props => createElement("form", { "data-token": props.token }) },
  })("app/membros/redefinir-senha/page.tsx");
  for (const params of [{}, { token: "<invalid>" }, { token: "valid-token", error: "INVALID_TOKEN" }]) {
    const html = renderToStaticMarkup(await page.default({ searchParams: Promise.resolve(params) }));
    assert.match(html, /Este link é inválido ou expirou/);
    assert.doesNotMatch(html, /data-token=/);
    assert.match(html, /Solicitar novo link/);
  }
  const html = renderToStaticMarkup(await page.default({ searchParams: Promise.resolve({ token: "valid-token" }) }));
  assert.match(html, /data-token="valid-token"/);
  assert.equal(page.metadata.referrer, "no-referrer");
});

test("reset page and callback have no-referrer/no-store headers and token URLs are excluded from dev logs", async () => {
  const config = opportunityLoader()("next.config.ts").default;
  const rules = await config.headers();
  for (const source of [recovery.RESET_PASSWORD_PATH, "/api/auth/reset-password/:path*"]) {
    const headers = rules.find(rule => rule.source === source).headers;
    assert.ok(headers.some(header => header.key === "Referrer-Policy" && header.value === "no-referrer"));
    assert.ok(headers.some(header => header.key === "Cache-Control" && header.value === "no-store"));
  }
  for (const url of ["/membros/redefinir-senha?token=secret", "/api/auth/reset-password/secret?callbackURL=private"]) {
    assert.ok(config.logging.incomingRequests.ignore.some(pattern => pattern.test(url)));
  }
});
