import assert from "node:assert/strict";
import test from "node:test";
import { localPreviewEnv, previewHeaders, previewCommand } from "../lib/navigation/local-preview.mjs";
import { opportunityLoader } from "./helpers/load-opportunity-module.mjs";

const config = {
  DATABASE_URL: "postgres://test:test@127.0.0.1:55439/apogee_navigation",
  BETTER_AUTH_URL: "http://127.0.0.1:4381",
  RADAR_ACADEMICO_API_URL: "http://127.0.0.1:4382/catalogue",
};

test("compiled local preview serves without the development compiler and binds to loopback", () => {
  assert.deepEqual(previewCommand("serve"), ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "4383"]);
  assert.deepEqual(previewCommand("build"), ["node_modules/next/dist/bin/next", "build", "--webpack"]);
  assert.throws(() => previewCommand("dev"));
});

test("the resource profile is opt-in and preserves the normal site's rendering configuration", () => {
  const previous = process.env.APOGEE_LOCAL_PREVIEW;
  try {
    delete process.env.APOGEE_LOCAL_PREVIEW;
    const normal = opportunityLoader()("next.config.ts").default;
    assert.equal(normal.output, "standalone");
    assert.equal(normal.experimental.cpus, undefined);
    assert.equal(normal.experimental.webpackBuildWorker, undefined);
    process.env.APOGEE_LOCAL_PREVIEW = "1";
    const preview = opportunityLoader()("next.config.ts").default;
    assert.equal(preview.output, undefined);
    assert.equal(preview.experimental.cpus, 1);
    assert.equal(preview.experimental.webpackBuildWorker, true);
    assert.equal(preview.experimental.webpackMemoryOptimizations, true);
    assert.equal(preview.experimental.preloadEntriesOnStart, false);
    assert.equal(preview.experimental.cssChunking, normal.experimental.cssChunking);
  } finally {
    if (previous === undefined) delete process.env.APOGEE_LOCAL_PREVIEW;
    else process.env.APOGEE_LOCAL_PREVIEW = previous;
  }
});

test("local preview bounds memory and retains real production authentication checks", () => {
  const env = localPreviewEnv(config, "serve");
  assert.equal(env.NODE_ENV, "production");
  assert.equal(env.NODE_OPTIONS, "--max-old-space-size=768");
  assert.equal(env.APPLICATION_HOSTING_PROVIDER, "caddy");
  assert.equal(env.APOGEE_LOCAL_PREVIEW, "1");
  assert.equal(localPreviewEnv(config, "build").NODE_OPTIONS, "--max-old-space-size=2048");
});

test("the preview refuses non-isolated database, origin and catalogue targets", () => {
  for (const [key, value] of [
    ["DATABASE_URL", "postgres://test:test@db.example.com:55439/apogee_navigation"],
    ["DATABASE_URL", "postgres://test:test@127.0.0.1:5432/other_database"],
    ["BETTER_AUTH_URL", "https://www.apogee.community"],
    ["RADAR_ACADEMICO_API_URL", "https://catalogue.example.com"],
  ]) assert.throws(() => localPreviewEnv({ ...config, [key]: value }, "serve"), key);
});

test("the local proxy overwrites forged client identity while retaining session cookies", () => {
  const input = { cookie: "better-auth.session_token=synthetic", "x-apogee-client-ip": "203.0.113.1", "x-forwarded-for": "203.0.113.2", "x-forwarded-host": "evil.example", forwarded: "for=203.0.113.3" };
  const headers = previewHeaders(input);
  assert.equal(headers.cookie, input.cookie);
  assert.equal(headers["x-apogee-client-ip"], "127.0.0.1");
  assert.equal(headers["x-forwarded-for"], undefined);
  assert.equal(headers.forwarded, undefined);
  assert.equal(headers["x-forwarded-host"], "127.0.0.1:4381");
  assert.equal(headers["x-forwarded-proto"], "http");
  assert.equal(input["x-apogee-client-ip"], "203.0.113.1");
});

test("compiled preview origin exception is limited to its explicit loopback profile", () => {
  const before = { mode: process.env.NODE_ENV, preview: process.env.APOGEE_LOCAL_PREVIEW, origin: process.env.BETTER_AUTH_URL };
  const { applicationOrigin } = opportunityLoader()("lib/members/mail.ts");
  try {
    process.env.NODE_ENV = "production";
    process.env.BETTER_AUTH_URL = "http://127.0.0.1:4381";
    delete process.env.APOGEE_LOCAL_PREVIEW;
    assert.throws(applicationOrigin);
    process.env.APOGEE_LOCAL_PREVIEW = "1";
    assert.equal(applicationOrigin(), "http://127.0.0.1:4381");
    for (const invalid of ["http://www.apogee.community", "http://127.0.0.1:3000", "http://localhost:4381", "http://user:pass@127.0.0.1:4381", "http://127.0.0.1:4381/other"]) {
      process.env.BETTER_AUTH_URL = invalid;
      assert.throws(applicationOrigin, invalid);
    }
    process.env.BETTER_AUTH_URL = "https://www.apogee.community";
    assert.equal(applicationOrigin(), "https://www.apogee.community");
  } finally {
    for (const [key, value] of [["NODE_ENV", before.mode], ["APOGEE_LOCAL_PREVIEW", before.preview], ["BETTER_AUTH_URL", before.origin]]) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
