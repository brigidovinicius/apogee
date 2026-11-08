import test from "node:test";
import assert from "node:assert/strict";
import { opportunityLoader } from "./helpers/load-opportunity-module.mjs";
test("retired journey endpoint refuses without loading persistence or configuration", async () => {
  const api = opportunityLoader()("lib/journey.ts");
  for (const value of [null, "broken", { email: "person@example.test" }]) {
    const response = await api.handleJourneyPost(value, { fetcher: () => { throw Error("must not write"); } });
    assert.equal(response.status, 410);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.doesNotMatch(await response.text(), /person@example/);
  }
});
