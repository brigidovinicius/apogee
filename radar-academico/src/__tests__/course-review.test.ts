import { readFile } from "node:fs/promises";
import { expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({ withAdminTransaction: vi.fn() }));
vi.mock("@/lib/db/client", () => database);

import { parseManualCsv } from "@/lib/ingestion/import-csv";
import { decideOpportunity, OpportunityReviewError } from "@/lib/official-sources/review";

it("the verified course batch remains unconfirmed and retains its real city and deadline", async () => {
  const files = ["ifpe", "ifmg"];
  const rows = (await Promise.all(files.map(async (name) => {
    const csv = await readFile(new URL(`../../references/cursos-pendentes-${name}-2026-10-11.csv`, import.meta.url), "utf8");
    return parseManualCsv(csv);
  }))).flat();
  expect(rows).toHaveLength(6);
  expect(rows.every((row) => row.candidate.reviewStatus === "needs_information" && row.candidate.isCourse)).toBe(true);
  expect(rows.find((row) => row.candidate.cityName === "Recife")?.candidate.deadlineAt).toBe("2026-10-23");
  expect(rows.find((row) => row.candidate.cityName === "Formiga")?.candidate.deadlineAt).toBe("2026-10-19");
  expect(rows.every((row) => row.candidate.nationallyEligible === false)).toBe(true);
});

it("legacy approval never publishes, including valid old decisions", async () => {
  await expect(decideOpportunity({ id: "11111111-1111-4111-8111-111111111111", decision: "approve", reviewer: "apogee:admin" })).rejects.toBeInstanceOf(OpportunityReviewError);
  expect(database.withAdminTransaction).not.toHaveBeenCalled();
});
