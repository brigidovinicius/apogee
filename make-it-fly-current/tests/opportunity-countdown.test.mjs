import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
const source = await readFile(new URL("../lib/opportunities/countdown.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const { opportunityCountdown: countdown } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
const base = { categories: ["bolsas"], deadline: "2026-10-14" };
const now = Date.parse("2026-10-13T15:00:00Z");
test("scholarships count down to closure using the original exact timestamp", () => {
  const item = { ...base, deadlineAt: "2026-10-14T09:30:10-03:00" };
  assert.equal(countdown(item, now).value, "21h 30min 10s");
  assert.equal(countdown(item, now + 1000).value, "21h 30min 09s");
  assert.equal(countdown(item, now + 2000).label, "Encerramento das inscrições");
  assert.equal(countdown(item, now + 86_400_000).value, "Inscrições encerradas");
});
test("events target their confirmed start, independently of registration closure", () => {
  const item = { ...base, categories: ["eventos"], eventStartsAt: "2026-10-14T09:00:00-03:00", deadlineAt: "2026-10-13T16:00:00Z" };
  assert.equal(countdown(item, now).value, "21h 00min 00s");
  assert.equal(countdown(item, now).label, "Início do evento");
  assert.equal(countdown(item, Date.parse(item.eventStartsAt)).value, "Evento iniciado");
  assert.equal(countdown({ ...item, eventStartsAt: null }, now).value, "Data de início não informada");
});
test("date-only sources count Brazilian calendar days without inventing hours", () => {
  assert.equal(countdown(base, now).value, "Falta 1 dia");
  assert.equal(countdown(base, Date.parse("2026-10-14T02:59:59Z")).value, "Falta 1 dia");
  assert.equal(countdown(base, Date.parse("2026-10-14T03:00:00Z")).value, "Encerra hoje · horário não informado");
  assert.equal(countdown(base, Date.parse("2026-10-15T03:00:00Z")).value, "Inscrições encerradas");
  assert.equal(countdown({ ...base, categories: ["eventos"], eventStartsAt: "2026-10-14" }, now).value, "Falta 1 dia");
  assert.equal(countdown({ ...base, categories: ["eventos"], eventStartsAt: "2026-10-14" }, now + 86_400_000).value, "Evento hoje · horário não informado");
});
test("missing dates, malformed dates and continuous flows never produce fake countdowns", () => {
  for (const deadline of [null, "invalid", "2026-02-30", "2026-10-14T12:00:00"]) {
    assert.equal(countdown({ ...base, deadline }, now).target, null);
  }
  assert.equal(countdown(base, null).value, "Calculando tempo restante…");
  assert.equal(countdown({ ...base, deadline: "2026-10-16" }, now).value, "Faltam 3 dias");
});
test("time remaining handles rounding, zero, multi-day durations and tab-resume jumps", () => {
  const item = { ...base, deadlineAt: "2026-10-15T15:00:00Z" };
  assert.equal(countdown(item, now).value, "2d 00h 00min 00s");
  assert.equal(countdown(item, Date.parse(item.deadlineAt) - 1).value, "00h 00min 01s");
  assert.equal(countdown(item, Date.parse(item.deadlineAt) + 1).value, "Inscrições encerradas");
  assert.equal(countdown(item, now + 10_000).value, "1d 23h 59min 50s");
});


test("countdown colors switch at seven days for exact times, including sub-second boundaries", () => {
  const deadlineAt = new Date(now + 7 * 86_400_000).toISOString();
  const item = { ...base, deadlineAt };
  assert.equal(countdown(item, now - 1).tone, "safe");
  assert.equal(countdown(item, now).tone, "urgent");
  assert.equal(countdown(item, now + 1).tone, "urgent");
  assert.equal(countdown(item, Date.parse(deadlineAt)).tone, null);
});
test("calendar-day colors and event colors use the correct target; unknown dates stay neutral", () => {
  assert.equal(countdown({ ...base, deadline: "2026-10-21" }, now).tone, "safe");
  assert.equal(countdown({ ...base, deadline: "2026-10-20" }, now).tone, "urgent");
  assert.equal(countdown({ ...base, deadline: "2026-10-19" }, now).tone, "urgent");
  assert.equal(countdown({ ...base, deadline: null }, now).tone, null);
  assert.equal(countdown(base, null).tone, null);
  const event = { ...base, categories: ["eventos"], deadlineAt: new Date(now + 1000).toISOString(), eventStartsAt: new Date(now + 10 * 86_400_000).toISOString() };
  assert.equal(countdown(event, now).tone, "safe");
  assert.equal(countdown({ ...event, eventStartsAt: null }, now).tone, null);
});

test("submission countdown never describes its deadline as registration", () => {
 const item = { categories: ["competicoes"], deadline: "2026-12-15", deadlineKind: "submission" };
 assert.equal(countdown(item, now).label, "Encerramento dos envios");
 assert.equal(countdown(item, Date.parse("2026-12-16T03:00:00Z")).value, "Envios encerrados");
 assert.equal(countdown({ ...item, deadlineAt: "2026-12-15T23:59:00Z" }, Date.parse("2026-12-16T03:00:00Z")).value, "Envios encerrados");
});
