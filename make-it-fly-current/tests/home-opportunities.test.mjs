import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const code = await readFile(new URL("../lib/home-opportunities.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { homeOpportunityIsCurrent, selectHomeOpportunities, homeOpportunitySnapshot } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const now = new Date("2026-10-17T01:00:00Z"); // Still October 16 in São Paulo.
const item = (overrides = {}) => ({ id: "fixture", kind: "Programa", categories: [], deadline: "2026-10-16", opportunityStatus: "open", ...overrides });

test("homepage date-only cutoff uses São Paulo, while exact deadlines expire at the stated instant", () => {
  assert.equal(homeOpportunityIsCurrent(item(), now), true);
  assert.equal(homeOpportunityIsCurrent(item({ deadline: "2026-10-15" }), now), false);
  assert.equal(homeOpportunityIsCurrent(item({ deadlineAt: now.toISOString() }), now), false);
  assert.equal(homeOpportunityIsCurrent(item({ deadlineAt: "2026-10-17T01:01:00Z" }), now), true);
  assert.equal(homeOpportunityIsCurrent(item({ deadlineAt: "invalid" }), now), false);
});

test("unknown event deadlines never keep past events in the homepage preview", () => {
  const event = item({ deadline: null, deadlineUnknown: true });
  assert.equal(homeOpportunityIsCurrent(event, now), false);
  assert.equal(homeOpportunityIsCurrent({ ...event, eventStartsAt: "2026-10-15" }, now), false);
  assert.equal(homeOpportunityIsCurrent({ ...event, eventStartsAt: "2026-10-16" }, now), true);
  assert.equal(homeOpportunityIsCurrent({ ...event, eventStartsAt: "2026-10-17T00:30:00Z" }, now), false);
  assert.equal(homeOpportunityIsCurrent({ ...event, eventStartsAt: "2026-10-17T03:00:00Z" }, now), true);
  assert.equal(homeOpportunityIsCurrent({ ...event, eventStartsAt: "invalid" }, now), false);
});

test("future registrations remain out of the open preview; continuous entries keep their existing treatment", () => {
  assert.equal(homeOpportunityIsCurrent(item({ opportunityStatus: "upcoming" }), now), false);
  assert.equal(homeOpportunityIsCurrent(item({ deadline: null }), now), true);
});

test("presentation priority preserves relative order, source objects and the original catalogue", () => {
  const items = [item({ id: "course", kind: "Curso" }), item({ id: "event", categories: ["eventos"] }), item({ id: "prize", kind: "Prêmio" }), item({ id: "scholarship", kind: "Bolsa" }), item({ id: "hackathon", categories: ["competicoes"] })];
  const original = structuredClone(items);
  assert.deepEqual(selectHomeOpportunities(items, now).map((entry) => entry.id), ["event", "prize", "hackathon", "course", "scholarship"]);
  assert.deepEqual(selectHomeOpportunities(items, now, "competicoes").map((entry) => entry.id), ["hackathon"]);
  assert.deepEqual(items, original);
  assert.equal(selectHomeOpportunities(items, now)[0], items[1]);
});

test("preview snapshots retain both category choices without duplicates or expired items", () => {
  const items = Array.from({ length: 20 }, (_, index) => item({ id: String(index), categories: index < 8 ? ["eventos"] : ["competicoes"] }));
  items.push(item({ id: "expired", deadline: "2026-10-15" }));
  const snapshot = homeOpportunitySnapshot(items, now);
  assert.equal(new Set(snapshot.map((entry) => entry.id)).size, snapshot.length);
  assert.equal(snapshot.some((entry) => entry.id === "expired"), false);
  assert.equal(selectHomeOpportunities(snapshot, now, "competicoes").length, 6);
  assert.deepEqual(selectHomeOpportunities([], now), []);
});
