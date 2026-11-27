import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { opportunityLoader } from "./helpers/load-opportunity-module.mjs";

const load = opportunityLoader();
const { matchRadarProfile } = load("lib/opportunities/profile-match.ts");
const { parseRadarPreferences, EMPTY_RADAR_PREFERENCES } = load("lib/opportunities/radar-preferences.ts");
const { planRadarDigest, radarMatchesForMail } = load("lib/opportunities/radar-preference-digest.ts");
const { opportunityCardData } = load("lib/opportunities/card-data.ts");
const { opportunityDetailPath, radarDetailReturnPath } = load("lib/opportunities/detail-path.ts");
const { participationFormatFromRadar } = load("lib/opportunities/radar-client.ts");
const now = new Date("2026-11-27T16:00:00.000Z");
const opts = settings => ({ ...EMPTY_RADAR_PREFERENCES, ...settings });

function opportunity(id, title, areas, change = {}) {
  return {
    id: "radar-" + id, title, kind: "Programa", organization: "Organizador", categories: ["eventos"],
    discovery: { areas, primaryType: "eventos", editions: [] },
    level: "Público diverso", participationFormat: "online", stateCode: null, cityName: null,
    location: "Não informado na fonte pública", summary: "", benefit: "", eligibility: "Aberto a todos.",
    deadline: "2026-12-10", deadlineLabel: "", opportunityStatus: "open", officialUrl: "https://organizador.example/",
    verifiedAt: "2026-11-26", publishedAt: "2026-11-26T12:00:00Z", ...change,
  };
}

const hack = opportunity("hack", "Hackathon de IA", ["ia", "tecnologia"], {
  discovery: { primaryType: "competicoes", subtype: "hackathon", areas: ["ia", "tecnologia"], editions: [] },
});
const stage = opportunity("stage", "Estágio em desenvolvimento de software", ["tecnologia"], { kind: "Estágio", level: "Graduação" });
const business = opportunity("business", "Formação em gestão de negócios", ["negocios"]);
const funds = opportunity("funding", "Aceleração para startups", ["negocios"], { kind: "Fomento" });
const techTalk = opportunity("tech", "Conferência de tecnologia", ["tecnologia"]);
const biology = opportunity("biology", "Encontro de biologia", ["biologia"]);
const set = [hack, stage, business, funds, techTalk, biology];
const matches = (config, items = set, dismissed) => matchRadarProfile(items, opts(config), dismissed, now);

test("each of the six roles has relevant coverage in the same catalogue", () => {
  const expected = {
    ai: [hack.id], tech: [hack.id, stage.id, techTalk.id], student: [stage.id],
    entrepreneur: [business.id, funds.id], builder: [hack.id], founder: [funds.id],
  };
  for (const [profile, ids] of Object.entries(expected)) {
    assert.deepEqual(matches({ profiles: [profile] }).map(item => item.opportunity.id).sort(), ids.sort(), profile);
  }
});

test("declared interests cross course and role, and do not bring unrelated items", () => {
  assert.deepEqual(matches({ course: "Ciência da Computação", stage: "undergraduate", profiles: ["builder", "student"],
    interests: ["ia"] }).map(item => item.opportunity.id), [hack.id, stage.id, techTalk.id]);
  const [result] = matches({ course: "Design", interests: ["ia"] });
  assert.equal(result.opportunity.id, hack.id);
  assert.match(result.reason, /acompanha Inteligência artificial/);
  assert.equal(matches({ course: "Engenharia de Computação" }).some(item => item.opportunity.id === biology.id), false);
  assert.deepEqual(matches({ profiles: ["founder"], categories: ["competicoes"] }), []);
  assert.deepEqual(matches({ interests: ["ia"], categories: ["eventos"] }).map(item => item.opportunity.id), [hack.id]);
});

test("enforces declared stage, modality, geographic preferences, expiry and dismissal", () => {
  const masters = opportunity("mestrado", "Bolsa de mestrado em software", ["tecnologia"], {
    eligibility: "Graduação concluída no momento da matrícula.",
  });
  const local = opportunity("local", "Encontro de IA", ["ia"], {
    participationFormat: "presencial", stateCode: "SC", cityName: "Florianópolis",
  });
  const stale = opportunity("stale", "Hackathon vencido", ["ia"], {
    deadline: "2026-11-27", deadlineAt: "2026-11-27T15:00:00Z",
  });
  const unchecked = opportunity("unknown", "Encontro de IA", ["ia"], { participationFormat: null });
  const available = [hack, masters, local, stale, unchecked];
  const profile = { interests: ["ia", "tecnologia"], stage: "undergraduate" };
  assert.deepEqual(matches({ ...profile, format: "online" }, available).map(item => item.opportunity.id), [hack.id]);
  assert.deepEqual(matches({ ...profile, format: "local", stateCode: "SC", cityName: "Florianopolis" },
    available, new Set([hack.id])).map(item => item.opportunity.id), [local.id]);
  assert.equal(matches(profile, available).find(item => item.opportunity.id === unchecked.id)?.checkRequirements, true);
  assert.equal(matches(profile, [unchecked])[0].canNotify, false);
});

test("reuses verified format text and protects full opportunity fields in personalized previews", () => {
  assert.equal(participationFormatFromRadar({ requirementsText: "Participação online para estudantes." }), "online");
  assert.equal(participationFormatFromRadar({ requirementsText: "Participação online. Etapa presencial obrigatória." }), null);
  assert.equal(participationFormatFromRadar({ requirementsText: "Inscrição online, com identificação pessoal." }), null);
  const card = opportunityCardData(hack);
  assert.equal(card.eligibility, "");
  assert.equal(card.officialUrl, "");
  const detail = opportunityDetailPath(hack.id, new URLSearchParams("origem=para-voce&return=https://example.com"));
  assert.equal(detail, "/membros/oportunidades/radar-hack?origem=para-voce");
  assert.equal(radarDetailReturnPath(detail), detail);
});

test("supports several identities and interest areas in one private preference", () => {
  const form = new FormData();
  for (const role of ["student", "builder", "founder", "builder", "__proto__"]) form.append("profiles", role);
  form.append("interests", "ia");
  form.append("interests", "negocios");
  form.set("email", "urgent");
  form.set("format", "local");
  assert.match(parseRadarPreferences(form).error, /estado/);
  form.set("state", "SC");
  form.set("city", " Florianópolis ");
  const parsed = parseRadarPreferences(form);
  assert.deepEqual(parsed.settings.profiles, ["student", "builder", "founder"]);
  assert.deepEqual(parsed.settings.interests, ["ia", "negocios"]);
  assert.equal(parsed.settings.cityName, "Florianópolis");
  assert.equal(parsed.email, "urgent");
  assert.equal(parseRadarPreferences(new FormData()).error.length > 0, true);
});

test("stores preferences and dismissals by account and respects mail opt-out", async t => {
  const database = new PGlite();
  t.after(() => database.close());
  await database.exec(`create table "user" (id text primary key); insert into "user" values ('one'), ('two');`);
  await database.exec(await readFile(new URL("../drizzle/0031_radar_preferences.sql", import.meta.url), "utf8"));
  const { getRadarPreference, saveRadarPreference, dismissedRadarOpportunities, dismissRadarOpportunity } = opportunityLoader({
    "@/lib/members/db": { getDb: () => drizzle(database) },
  })("lib/opportunities/radar-preference-store.ts");
  const first = opts({ profiles: ["student", "builder"], interests: ["ia"] });
  const second = opts({ profiles: ["founder"], interests: ["negocios"] });
  await saveRadarPreference("one", first, "urgent");
  await saveRadarPreference("two", second, "off");
  assert.deepEqual((await getRadarPreference("one")).settings, first);
  assert.deepEqual((await getRadarPreference("two")).settings, second);
  assert.ok((await getRadarPreference("one")).emailEnabledAt);
  await dismissRadarOpportunity("one", hack.id);
  await dismissRadarOpportunity("one", hack.id);
  assert.deepEqual(await dismissedRadarOpportunities("one"), new Set([hack.id]));
  assert.deepEqual(await dismissedRadarOpportunities("two"), new Set());
  await database.exec(`insert into radar_preference_delivery
    (user_id, delivery_key, opportunity_ids, subject, body) values ('one', 'weekly', '{radar-hack}', 'test', 'test')`);
  await saveRadarPreference("one", first, "off");
  assert.equal((await getRadarPreference("one")).emailEnabledAt, null);
  assert.equal((await database.query("select body from radar_preference_delivery")).rows[0].body, "");
});

test("mail requires a newly published, actionable, verified match and deduplicates weekly and urgent notices", () => {
  const urgent = { ...hack, id: "radar-urgent", deadline: "2026-11-28", deadlineAt: "2026-11-29T00:00:00Z" };
  const alreadyPublished = { ...hack, id: "radar-old", publishedAt: "2026-11-18T16:00:00Z" };
  const upcoming = { ...hack, id: "radar-upcoming", opportunityStatus: "upcoming" };
  const list = radarMatchesForMail(matches({ profiles: ["builder"] }, [hack, urgent, alreadyPublished, upcoming]), now, new Date("2026-11-23T00:00:00Z"));
  assert.deepEqual(list.map(item => item.opportunity.id), [urgent.id, hack.id]);
  const origin = "https://www.apogee.community";
  assert.equal(planRadarDigest(list, "off", now, { keys: new Set(), opportunityIds: new Set() }, origin), null);
  const regular = planRadarDigest(list, "weekly", now, { keys: new Set(), opportunityIds: new Set() }, origin);
  assert.equal(regular.key, "weekly-2026-11-23");
  assert.match(regular.body, /Alterar ou desativar/);
  assert.doesNotMatch(regular.body, /organizador.example/);
  const next = planRadarDigest(list, "urgent", now, { keys: new Set([regular.key]), opportunityIds: new Set([hack.id]) }, origin);
  assert.deepEqual(next.opportunityIds, [urgent.id]);
  assert.equal(next.key, "urgent-2026-11-27");
  assert.equal(planRadarDigest(list, "urgent", now, { keys: new Set([regular.key]), opportunityIds: new Set([hack.id, urgent.id]) }, origin), null);
});

test("invokes the e-mail worker only with the configured bearer credential", async () => {
  let secret = null;
  let sends = 0;
  const { POST } = opportunityLoader({
    "@/lib/opportunities/radar-preference-mail-config": { radarPreferenceMailSecret: () => secret },
    "@/lib/opportunities/radar-preference-mail-worker": { runRadarPreferenceMail: async () => ({ examined: ++sends }) },
  })("app/api/internal/radar/preference-mail/route.ts");
  const url = "https://www.apogee.community/api/internal/radar/preference-mail";
  assert.equal((await POST(new Request(url))).status, 404);
  secret = "s".repeat(32);
  assert.equal((await POST(new Request(url))).status, 401);
  const response = await POST(new Request(url, { headers: { authorization: "Bearer " + secret } }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { examined: 1 });
});
