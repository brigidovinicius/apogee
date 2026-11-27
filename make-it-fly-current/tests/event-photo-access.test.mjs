import assert from "node:assert/strict";
import test from "node:test";
import { opportunityLoader } from "./helpers/load-opportunity-module.mjs";

test("a new member can consent and use the Workshop search while visitors and unconsented searches are denied", async t => {
  const origin = "https://apogee.test";
  const photoId = "1".repeat(32);
  let consent = false;
  for (const [key, value] of Object.entries({
    APOGEE_WORKSHOP_MEDIA_ENABLED: "true", APOGEE_WORKSHOP_MEDIA_URL: "http://127.0.0.1:8786",
    APOGEE_WORKSHOP_MEDIA_AUDIENCE: "members", APOGEE_WORKSHOP_SELFIE_ENABLED: "true",
    ALBUM_SECRET: "synthetic-album-secret-at-least-32",
    MEMBERS_SUPERVISED_REGISTRATION_ENABLED: "true",
  })) {
    const previous = process.env[key];
    process.env[key] = value;
    t.after(() => {
      if (previous === undefined) delete process.env[key];
      else process.env[key] = previous;
    });
  }
  const load = opportunityLoader({
    "better-auth/cookies": { getSessionCookie: headers => headers.get("cookie") },
    "@/lib/members/dal": { getMemberFromHeaders: async headers => headers.get("cookie") ? { id: "new-member" } : null },
    "@/lib/members/mail": { applicationOrigin: () => origin },
  });
  const lookup = load("app/api/eventos/fotos/route.ts");
  const permission = load("app/api/eventos/fotos/consentimento/route.ts");
  const { PHOTO_OPT_IN, SELFIE_CONSENT } = load("lib/eventos/catalogo.ts");
  const realFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = realFetch; });
  globalThis.fetch = async (url, init) => {
    assert.match(url, /^http:\/\/127\.0\.0\.1:8786\//);
    assert.equal(init.headers.get("x-album-member"), "new-member");
    if (url.endsWith("/consent")) {
      if (init.method === "POST") consent = true;
      return Response.json({ granted: consent, indexed: consent });
    }
    assert.ok(url.endsWith("/search"));
    assert.equal(init.headers.get("x-album-consent"), SELFIE_CONSENT);
    return consent ? Response.json({ ids: [photoId] }) : Response.json({ error: "consent_required" }, { status: 403 });
  };

  const request = ({ cookie = true, method = "GET", consentHeader, body, host = origin } = {}) =>
    new Request(origin + "/api/eventos/fotos", {
      method, body, headers: {
        Origin: host, ...(cookie && { Cookie: "test-session=member" }),
        ...(consentHeader && { "X-Apogee-Consent": consentHeader }),
        ...(body && { "Content-Type": "image/jpeg" }),
      },
    });

  assert.equal((await permission.GET(request({ cookie: false }))).status, 403);
  assert.deepEqual(await (await permission.GET(request())).json(), { granted: false, indexed: false });
  assert.equal((await permission.POST(request({ method: "POST", consentHeader: PHOTO_OPT_IN, host: "https://external.test" }))).status, 403);
  assert.equal((await permission.POST(request({ method: "POST" }))).status, 400);
  const search = () => lookup.POST(request({ method: "POST", consentHeader: SELFIE_CONSENT, body: "synthetic-image" }));
  assert.equal((await search()).status, 403);
  assert.deepEqual(await (await permission.POST(request({ method: "POST", consentHeader: PHOTO_OPT_IN }))).json(), { granted: true, indexed: true });
  const response = await search();
  assert.equal(response.status, 200);
  assert.equal((await response.json()).photos[0].id, photoId);
});
