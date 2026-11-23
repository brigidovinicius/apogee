import assert from "node:assert/strict";
import test from "node:test";
import { opportunityLoader } from "./helpers/load-opportunity-module.mjs";

test("DB-IP city records map Brazilian city and state, with a state-only fallback", () => {
  const { approximateBrazilianLocation } = opportunityLoader()("lib/opportunities/radar-request-location.ts");
  const brazil = { country: { iso_code: "BR" }, subdivisions: [{ names: { en: "Santa Catarina" } }] };
  assert.deepEqual(approximateBrazilianLocation({ ...brazil, city: { names: { en: "Florianopolis", "pt-BR": "Florianópolis" } } }),
    { stateCode: "SC", cityName: "Florianópolis" });
  assert.deepEqual(approximateBrazilianLocation(brazil), { stateCode: "SC", cityName: null });
  assert.deepEqual(approximateBrazilianLocation({ ...brazil, subdivisions: [{ names: { en: "Federal District" } }] }),
    { stateCode: "DF", cityName: null });
  assert.equal(approximateBrazilianLocation({ ...brazil, country: { iso_code: "US" } }), undefined);
  assert.equal(approximateBrazilianLocation({ ...brazil, subdivisions: [{ names: { en: "Unknown" } }] }), undefined);
});

test("catalogues use the trusted request IP and honor geographic filters, opt-out and browser privacy signals", async (t) => {
  const now = new Date().toISOString();
  const local = { id: "local", title: "Oficina de robótica", organization: "UFSC", kind: "Programa", level: "Público diverso",
    categories: ["eventos"], location: "Florianópolis · SC", stateCode: "SC", cityName: "Florianópolis",
    editorialNature: "extracurricular", editorialFocus: "event_or_competition", participationFormat: "presencial",
    eligibility: "", benefit: "", summary: "", deadline: null, deadlineLabel: "", verifiedAt: now, opportunityStatus: "open" };
  const remote = { ...local, id: "remote", organization: "OpenAI Academy", title: "Oficina de robótica em São Paulo",
    location: "São Paulo · SP", cityName: "São Paulo", stateCode: "SP", officialUrl: "https://academy.openai.com/evento" };
  const initialDb = process.env.RADAR_DBIP_CITY_FILE;
  const initialProvider = process.env.APPLICATION_HOSTING_PROVIDER;
  const oldNodeEnv = process.env.NODE_ENV;
  process.env.RADAR_DBIP_CITY_FILE = "/fixture.mmdb";
  process.env.APPLICATION_HOSTING_PROVIDER = "caddy";
  process.env.NODE_ENV = "production";
  t.after(() => {
    for (const [key, value] of Object.entries({
      RADAR_DBIP_CITY_FILE: initialDb, APPLICATION_HOSTING_PROVIDER: initialProvider, NODE_ENV: oldNodeEnv,
    })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
  let reads = 0;
  let lookups = 0;
  let principal = new Headers({ "x-apogee-client-ip": "192.0.2.8", "x-forwarded-for": "192.0.2.9" });
  const load = opportunityLoader({
    "next/headers": { headers: async () => principal },
    "node:fs/promises": {
      stat: async () => ({ size: 12, isFile: () => true }),
      readFile: async () => { reads++; return Buffer.alloc(12); },
    },
    "mmdb-lib": { Reader: class {
      metadata = { databaseType: "DBIP-City-Lite" };
      get(ip) {
        lookups++;
        assert.equal(ip, "192.0.2.8");
        return { country: { iso_code: "BR" }, subdivisions: [{ names: { en: "Santa Catarina" } }], city: { names: { en: "Florianópolis" } } };
      }
    } },
    "@/lib/admin/access": { requireAdmin: async () => {} },
    "@/lib/members/dal": { requireSignedInMember: async () => {} },
    "@/lib/opportunities/radar-client": { listRadarOpportunities: async () => [remote, local] },
  });
  const { listPublicOpportunityPage, listMemberOpportunityPage } = load("lib/opportunities/access.ts");
  for (const list of [listPublicOpportunityPage, listMemberOpportunityPage]) {
    const personalized = await list(new URLSearchParams());
    assert.equal(personalized.locationRanking, "applied");
    assert.equal(personalized.opportunities[0].id, "local");
    assert.equal(Object.hasOwn(personalized, "location"), false);
    assert.doesNotMatch(JSON.stringify(personalized), /192\.0\.2\./);
  }
  assert.equal(reads, 1);
  assert.equal(lookups, 2);
  const optedOut = await listPublicOpportunityPage(new URLSearchParams("localizacao=off"));
  assert.equal(optedOut.locationRanking, "off");
  assert.equal(optedOut.opportunities[0].id, "remote");
  const manual = await listPublicOpportunityPage(new URLSearchParams("uf=SP&cidade=São Paulo"));
  assert.deepEqual(manual.opportunities.map(item => item.id), ["remote"]);
  assert.equal(manual.locationRanking, undefined);
  for (const header of ["sec-gpc", "dnt"]) {
    principal.set(header, "1");
    assert.equal((await listPublicOpportunityPage(new URLSearchParams())).locationRanking, undefined);
    principal.delete(header);
  }
  principal.delete("x-apogee-client-ip");
  assert.equal((await listPublicOpportunityPage(new URLSearchParams())).locationRanking, undefined);
  assert.equal(lookups, 2);
  assert.equal(load("lib/opportunities/navigation.ts").radarCatalogueQuery(new URLSearchParams("localizacao=off&pagina=2&sensitive=private")),
    "?localizacao=off&pagina=2");
});
