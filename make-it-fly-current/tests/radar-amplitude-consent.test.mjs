import assert from "node:assert/strict";
import test from "node:test";
import { opportunityLoader } from "./helpers/load-opportunity-module.mjs";

test("production configuration requires the exact published Radar privacy policy", () => {
  let publishedVersion;
  const { radarAmplitudeConfig } = opportunityLoader({
    "next/server": {},
    "@/lib/members/db": {},
    "@/lib/privacy-policy": { publishedPrivacyVersion: () => publishedVersion },
  })("lib/radar-amplitude.ts");
  const env = {
    APOGEE_RADAR_AMPLITUDE_ENABLED: "true",
    APOGEE_RADAR_AMPLITUDE_API_KEY: "fixture-key",
    APOGEE_RADAR_AMPLITUDE_IDENTITY_SECRET: "a".repeat(32),
    APOGEE_RADAR_AMPLITUDE_REGION: "EU",
    APOGEE_RADAR_AMPLITUDE_TEST_ENDPOINT: undefined,
    APOGEE_LOCAL_PREVIEW: undefined,
  };
  const previous = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
  function applyEnv(values) {
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
  try {
    applyEnv(env);
    assert.equal(radarAmplitudeConfig(), null);
    publishedVersion = "2026-11-08.1";
    assert.equal(radarAmplitudeConfig(), null);
    publishedVersion = "2026-11-22.1";
    assert.equal(radarAmplitudeConfig().endpoint, "https://api.eu.amplitude.com/2/httpapi");
  } finally {
    applyEnv(previous);
  }
});

test("consent requires the current notice version and older clients can still revoke", async () => {
  const origin = "http://127.0.0.1:4381";
  const calls = [];
  const { POST } = opportunityLoader({
    "@/lib/members/dal": { getMemberFromHeaders: async () => ({ id: "fixture-member" }) },
    "@/lib/members/mail": { applicationOrigin: () => origin },
    "@/lib/radar-amplitude": {
      radarAmplitudeConfig: () => ({}),
      radarAmplitudePrivacySignal: () => false,
      setRadarAmplitudePreference: async (id, allow) => {
        calls.push({ id, allow });
        return allow ? "fixture-grant" : null;
      },
    },
  })("app/api/radar/amplitude/route.ts");
  const postChoice = body => POST(new Request(origin + "/api/radar/amplitude", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  }));

  assert.equal((await postChoice({ choice: "allow" })).status, 400);
  assert.equal((await postChoice({ choice: "allow", version: 1 })).status, 400);
  assert.deepEqual(calls, []);
  assert.equal((await postChoice({ choice: "allow", version: 2 })).status, 200);
  assert.equal((await postChoice({ choice: "deny" })).status, 200);
  assert.deepEqual(calls, [
    { id: "fixture-member", allow: true },
    { id: "fixture-member", allow: false },
  ]);
});
