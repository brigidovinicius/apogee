import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../../integrations/google-sheets/Code.gs", import.meta.url), "utf8");
export const SHEETS_SECRET = "synthetic-sheets-secret-not-for-production-123456";
export const APPLICATION_ID = "abcdef01-2345-4678-9abc-0123456789ab";
export function application(changes = {}) {
  return { kind: "application", webhookSecret: SHEETS_SECRET, id: APPLICATION_ID, createdAt: "2026-10-20T12:00:00Z",
    name: "Pessoa Sintética", email: "person@example.test", phone: "11999999999", age: 28, profession: "Design",
    hasIdea: true, hasLaptop: true, usesPaidAI: true, eligible: true, ideaDescription: "",
    utmSource: "", utmMedium: "", utmCampaign: "", utmContent: "", referrer: "", ...changes };
}
export function journey(changes = {}) {
  return { eventId: "abcdef02-2345-4678-9abc-0123456789ab", journeyId: APPLICATION_ID, receivedAt: "2026-10-20T12:00:00Z",
    eventName: "page_view", path: "/", context: "landing", step: null, device: "desktop", ...changes };
}

// Só APIs externas do Google são simuladas. doPost, autenticação, validação,
// elegibilidade, deduplicação e tratamento de células executam o Code.gs real.
export function sheetsReceiver(options = {}) {
  const rows = { applications: [], journey: [] };
  const calls = { locks: 0, waits: 0, releases: 0, opens: 0, logs: 0 };
  const state = { secret: Object.hasOwn(options, "secret") ? options.secret : SHEETS_SECRET };
  const sheet = name => {
    assert.ok(["Aplicações", "Jornada"].includes(name));
    const target = name === "Aplicações" ? rows.applications : rows.journey;
    return {
      appendRow(row) { assert.equal(row.length, 20); target.push(Array.from(row)); },
      getLastRow: () => 5 + target.length,
      getRange(...args) {
        return {
          createTextFinder(id) { return {
            matchEntireCell(enabled) { assert.equal(enabled, true); return this; },
            findNext: () => target.find(row => String(row[0]).toLowerCase() === id.toLowerCase()) ?? null,
          }; },
          getValues() { assert.deepEqual(args, [6, 1, target.length, 1]); return target.map(row => [row[0]]); },
          setValues(batch) {
            assert.deepEqual(args, [6 + target.length, 1, batch.length, 8]);
            for (const row of batch) { assert.equal(row.length, 8); target.push(Array.from(row)); }
          },
        };
      },
    };
  };
  const context = vm.createContext({
    PropertiesService: { getScriptProperties: () => ({ getProperty(key) {
      assert.equal(key, "GOOGLE_SHEETS_WEBHOOK_SECRET");
      if (options.propertyFailure) throw new Error(`private property failure ${SHEETS_SECRET}`);
      return state.secret;
    } }) },
    Utilities: { newBlob: value => ({ getBytes: () => Array.from(Buffer.from(value, "utf8")) }) },
    LockService: { getScriptLock() { calls.locks++; return {
      waitLock() { calls.waits++; if (options.lockFailure) throw new Error(`private lock failure ${SHEETS_SECRET}`); },
      releaseLock() { calls.releases++; },
    }; } },
    SpreadsheetApp: { openById() {
      calls.opens++;
      if (options.sheetFailure) throw new Error(`private sheet failure ${SHEETS_SECRET}`);
      return { getSheetByName: sheet };
    } },
    ContentService: { MimeType: { JSON: "application/json" }, createTextOutput(value) { return {
      getContent: () => value, setMimeType(type) { assert.equal(type, "application/json"); return this; },
    }; } },
    console: { log() { calls.logs++; }, error() { calls.logs++; } },
  });
  vm.runInContext(source, context, { filename: "integrations/google-sheets/Code.gs" });
  return { rows, calls, state,
    raw: contents => JSON.parse(context.doPost({ postData: { contents } }).getContent()),
    post: data => JSON.parse(context.doPost({ postData: { contents: JSON.stringify(data) } }).getContent()),
  };
}
