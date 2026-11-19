import assert from "node:assert/strict";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";

import { opportunityLoader } from "./helpers/load-opportunity-module.mjs";

const catalogue = () => Response.json({ version: 3, opportunities: [] });

function configuredClient(t) {
  const config = {
    RADAR_ACADEMICO_API_URL: "http://radar.test/api/public/opportunities",
    RADAR_ACADEMICO_API_TOKEN: "fixture-token",
  };
  for (const [key, value] of Object.entries(config)) {
    const previous = process.env[key];
    process.env[key] = value;
    t.after(() => {
      if (previous === undefined) delete process.env[key];
      else process.env[key] = previous;
    });
  }
  return opportunityLoader()("lib/opportunities/radar-client.ts");
}

test("a valid catalogue that needs more than two seconds loads on the first attempt", async (t) => {
  const client = configuredClient(t);
  const request = t.mock.method(globalThis, "fetch", async (_, { signal }) => {
    await delay(2_100, undefined, { signal });
    return catalogue();
  });

  assert.deepEqual(await client.listRadarOpportunities(), []);
  assert.equal(request.mock.callCount(), 1);
});

test("a transient upstream response or transport error recovers in the same page request", async (t) => {
  const client = configuredClient(t);
  const responses = [
    () => new Response(null, { status: 503 }),
    catalogue,
    () => { throw new TypeError("fetch failed"); },
    catalogue,
  ];
  const request = t.mock.method(globalThis, "fetch", async () => responses.shift()());

  assert.deepEqual(await client.listRadarOpportunities(), []);
  assert.deepEqual(await client.listRadarOpportunities(true), []);
  assert.equal(request.mock.callCount(), 4);
});

test("concurrent callers share their catalogue variant and later calls read fresh data", async (t) => {
  const client = configuredClient(t);
  const views = [];
  const request = t.mock.method(globalThis, "fetch", async (url, options) => {
    views.push(new URL(url).searchParams.get("view"));
    assert.equal(options.cache, "no-store");
    await delay(15);
    return catalogue();
  });

  const results = await Promise.all([
    client.listRadarOpportunities(),
    client.listRadarOpportunities(true),
    client.listRadarOpportunities(),
    client.listRadarOpportunities(true),
  ]);
  assert.deepEqual(results, [[], [], [], []]);
  assert.deepEqual(views, [null, "calendar"]);
  await client.listRadarOpportunities();
  assert.equal(request.mock.callCount(), 3);
});

test("failures stay explicit, retries are bounded, and a failed read is released", async (t) => {
  const client = configuredClient(t);
  const responses = [
    () => new Response(null, { status: 401 }),
    () => Response.json({ version: 2, opportunities: [] }),
    () => new Response(null, { status: 503 }),
    () => new Response(null, { status: 503 }),
    catalogue,
  ];
  const request = t.mock.method(globalThis, "fetch", async () => responses.shift()());

  await assert.rejects(client.listRadarOpportunities(), /Catálogo indisponível/);
  assert.equal(request.mock.callCount(), 1);
  await assert.rejects(client.listRadarOpportunities(), /Catálogo indisponível/);
  assert.equal(request.mock.callCount(), 2);
  await assert.rejects(client.listRadarOpportunities(), /Catálogo indisponível/);
  assert.equal(request.mock.callCount(), 4);
  assert.deepEqual(await client.listRadarOpportunities(), []);
});
