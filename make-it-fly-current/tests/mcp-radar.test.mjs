import assert from "node:assert/strict";
import { test } from "node:test";
import { opportunityLoader } from "./helpers/load-opportunity-module.mjs";

const item = {
  id: "radar-first", title: "Hackathon de tecnologia", organization: "Instituição", kind: "Programa", level: "Graduação",
  categories: ["competicoes"], location: "Florianópolis · SC", stateCode: "SC", cityName: "Florianópolis",
  summary: "Resumo público", benefit: "Benefício público", eligibility: "REQUISITO_PRIVADO",
  officialUrl: "https://example.test/inscricao-privada", deadline: "2099-12-20", deadlineLabel: "Até dezembro",
  eventStartsAt: "2099-12-25", verifiedAt: "2026-11-12", verificationTimestamp: "2026-11-12T12:00:00Z",
  financials: { benefits: [], costs: ["CUSTO_PRIVADO"], notes: ["NOTA_PRIVADA"] },
  discovery: { areas: ["tecnologia"], editions: [{ id: "edition", name: "Edição", stages: [
    { id: "registration", name: "Inscrições", kind: "registration", start: "2099-12-01", end: "2099-12-20", sourceUrl: "https://example.test/FONTE_PRIVADA", checkedAt: "2026-11-12T12:00:00Z" },
  ] }] },
};
function fixture() {
  const state = { members: new Map([["a", { id: "a", name: "Pessoa", username: "pessoa", nameNeedsConfirmation: false }], ["b", { id: "b", name: "Outra", username: "outra" }]]),
    active: new Set(), selected: new Map(), items: [item, { ...item, id: "radar-second" }], rightsReads: [], catalogueReads: 0 };
  const load = opportunityLoader({
    "@/lib/mcp/identity": { getMcpMember: async id => state.members.get(id) ?? null },
    "@/lib/billing/store": { radarAccess: async (id, _live, options) => {
      assert.equal(options.claimPurchases, false, "MCP must never link a purchase as a side effect");
      state.rightsReads.push(id); return { active: state.active.has(id), source: state.active.has(id) ? "stripe" : null };
    } },
    "@/lib/opportunities/detail-store": { freeRadarOpportunity: async id => state.selected.get(id) ?? null,
      claimFreeRadarOpportunity: () => { throw Error("MCP must never claim a free opportunity"); } },
    "@/lib/opportunities/radar-client": { listRadarOpportunities: async () => { state.catalogueReads++; return state.items; } },
    "@/lib/members/mail": { applicationOrigin: () => "https://www.apogee.community" },
  });
  return { state, read: (...args) => load("lib/mcp/radar.ts").readRadarTool(...args) };
}
const privateValues = ["REQUISITO_PRIVADO", "inscricao-privada", "CUSTO_PRIVADO", "NOTA_PRIVADA", "FONTE_PRIVADA"];

test("MCP search returns public previews without protected nested data", async () => {
  const { read } = fixture();
  const result = await read("a", "search_opportunities", { query: "tecnologia" });
  assert.equal(result.items.length, 2);
  for (const value of privateValues) assert.ok(!JSON.stringify(result).includes(value), value);
  assert.equal(result.items[0].detailAccess, "locked");
  assert.match(result.items[0].apogeeUrl, /^https:\/\/www\.apogee\.community\/membros\/oportunidades\//);
});
test("MCP paid access returns details and distinct verified dates", async () => {
  const { state, read } = fixture(); state.active.add("a");
  const result = await read("a", "get_opportunity", { id: item.id });
  assert.equal(result.item.officialUrl, item.officialUrl);
  assert.equal(result.item.eligibility, item.eligibility);
  assert.equal(result.item.deadline, "2099-12-20"); assert.equal(result.item.eventStartsAt, "2099-12-25");
  assert.equal(result.item.verificationTimestamp, item.verificationTimestamp);
});
test("MCP reopens the already chosen free detail without granting another one", async () => {
  const { state, read } = fixture(); state.selected.set("a", item.id);
  assert.equal((await read("a", "get_opportunity", { id: item.id })).item.officialUrl, item.officialUrl);
  const locked = await read("a", "get_opportunity", { id: "radar-second" });
  assert.equal(locked.item.detailAccess, "locked");
  for (const value of privateValues) assert.ok(!JSON.stringify(locked).includes(value));
  assert.equal(state.selected.get("a"), item.id);
});
test("MCP does not consume an unused free choice and gives the website path", async () => {
  const { state, read } = fixture();
  const result = await read("a", "get_opportunity", { id: item.id });
  assert.equal(result.item.detailAccess, "locked"); assert.equal(state.selected.size, 0);
  const rights = await read("a", "get_radar_access", {});
  assert.equal(rights.freeOpportunityId, null); assert.equal(rights.fullAccess, false);
  assert.match(rights.accessUrl, /\/membros\/radar/);
});
test("MCP rechecks rights on every call and isolates accounts", async () => {
  const { state, read } = fixture(); state.active.add("a");
  assert.equal((await read("a", "get_opportunity", { id: item.id })).item.detailAccess, "full");
  assert.equal((await read("b", "get_opportunity", { id: item.id })).item.detailAccess, "locked");
  state.active.delete("a");
  assert.equal((await read("a", "get_opportunity", { id: item.id })).item.detailAccess, "locked");
  assert.deepEqual(state.rightsReads, ["a", "b", "a"]);
});
test("MCP refuses a deleted or blocked account before reading the catalogue", async () => {
  const { state, read } = fixture(); state.members.delete("a");
  await assert.rejects(read("a", "search_opportunities", {}), error => error.code === "account_unavailable");
  assert.equal(state.catalogueReads, 0);
});
test("MCP refuses incomplete profile without broadening website permissions", async () => {
  const { state, read } = fixture(); state.members.get("a").nameNeedsConfirmation = true;
  await assert.rejects(read("a", "get_radar_access", {}), error => error.code === "profile_required");
});
test("MCP refuses a generated Google username even if its confirmation flag is false", async () => {
  const { state, read } = fixture(); state.members.get("a").username = "google_0123456789abcdef0123";
  await assert.rejects(read("a", "get_radar_access", {}), error => error.code === "profile_required");
  assert.equal(state.catalogueReads, 0);
});
test("MCP calendar previews have no source URL leak and preserve stage meaning", async () => {
  const { read } = fixture(); const result = await read("a", "list_calendar_entries", {});
  assert.equal(result.items[0].stage.kind, "registration");
  assert.equal(result.items[0].stage.end, "2099-12-20");
  for (const value of privateValues) assert.ok(!JSON.stringify(result).includes(value), value);
});
test("MCP enforces supplied filters and bounded pagination", async () => {
  const { read } = fixture();
  assert.equal((await read("a", "search_opportunities", { stateCode: "RS" })).total, 0);
  const page = await read("a", "search_opportunities", { pageSize: 1, page: 2 });
  assert.equal(page.items.length, 1); assert.equal(page.total, 2); assert.equal(page.page, 2);
  for (const args of [{ pageSize: 25 }, { page: 0 }, { query: "x".repeat(201) }, { userId: "b" }, { stateCode: "XX" }]) {
    await assert.rejects(read("a", "search_opportunities", args), error => error.code === "invalid_arguments");
  }
});
test("MCP never exposes unavailable items or administrative tools", async () => {
  const { state, read } = fixture(); state.items = [{ ...item, deadline: "2020-01-01", eventStartsAt: "2020-01-02", discovery: undefined }];
  await assert.rejects(read("a", "get_opportunity", { id: item.id }), error => error.code === "not_found");
  await assert.rejects(read("a", "delete_opportunity", {}), error => error.code === "unknown_tool");
});

test("MCP calendar filters stage and period without manufacturing unknown deadlines", async () => {
  const { state, read } = fixture();
  state.items = [{ ...item, deadline: null, deadlineUnknown: true, discovery: undefined }];
  const dates = await read("a", "list_calendar_entries", { stage: "registration" });
  assert.equal(dates.items.length, 0);
  const events = await read("a", "list_calendar_entries", { stage: "event" });
  assert.equal(events.items[0].stage.start, "2099-12-25");
});

test("MCP reports catalogue failure instead of silently returning an empty or cached privileged result", async () => {
  const { state, read } = fixture(); state.items = null;
  await assert.rejects(read("a", "search_opportunities", {}));
});
