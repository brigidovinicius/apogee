import { expect, it } from "vitest";
import { parseEventStart } from "@/lib/ingestion/event-start";
it("preserves date-only precision, explicit timezone and absence", () => {
  for (const date of ["2026-10-14", "2026-10-14T09:00:00-03:00", "2026-10-14T12:00:00Z"]) expect(parseEventStart(date)).toBe(date);
  for (const empty of [null, undefined, ""]) expect(parseEventStart(empty)).toBeNull();
});
it("rejects impossible dates, missing timezones and invalid times", () => {
  for (const date of ["2026-02-30", "2026-13-01", "2026-10-14T09:00:00", "2026-10-14T25:00:00Z", "wrong", 123]) expect(() => parseEventStart(date)).toThrow();
});
