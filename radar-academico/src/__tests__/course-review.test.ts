import { readFile } from "node:fs/promises";
import { expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({ withAdminTransaction: vi.fn() }));
vi.mock("@/lib/db/client", () => database);

import { parseManualCsv } from "@/lib/ingestion/import-csv";
import { decideOpportunity, OpportunityReviewError } from "@/lib/official-sources/review";

it("the verified course batch remains pending and retains its real city and deadline", async () => {
  const files = ["ifpe", "ifmg"];
  const rows = (await Promise.all(files.map(async (name) => {
    const csv = await readFile(new URL(`../../references/cursos-pendentes-${name}-2026-10-11.csv`, import.meta.url), "utf8");
    return parseManualCsv(csv);
  }))).flat();
  expect(rows).toHaveLength(6);
  expect(rows.every((row) => row.candidate.reviewStatus === "pending_review" && row.candidate.isCourse)).toBe(true);
  expect(rows.find((row) => row.candidate.cityName === "Recife")?.candidate.deadlineAt).toBe("2026-10-23");
  expect(rows.find((row) => row.candidate.cityName === "Formiga")?.candidate.deadlineAt).toBe("2026-10-19");
  expect(rows.every((row) => row.candidate.nationallyEligible === false)).toBe(true);
});

it("approval refuses an inactive official source before publishing", async () => {
  const queries: string[] = [];
  database.withAdminTransaction.mockImplementationOnce(async (work: (client: { query: (sql: string) => Promise<unknown> }) => Promise<unknown>) =>
    work({ query: async (sql) => {
      queries.push(sql);
      if (sql.includes("from opportunities o")) return { rows: [{ official_source_id: "source", review_status: "pending_review" }] };
      if (sql.includes("from official_sources")) return { rows: [{ active: false, verification_status: "pending" }] };
      return { rows: [] };
    } }),
  );
  await expect(decideOpportunity({
    id: "11111111-1111-4111-8111-111111111111", decision: "approve", reviewer: "apogee:admin",
  })).rejects.toBeInstanceOf(OpportunityReviewError);
  expect(queries.some((sql) => sql.includes("review_status='approved'"))).toBe(false);
});

it("an eligible reviewed course is published with the human reviewer recorded", async () => {
  const calls: Array<{ sql: string; values: unknown[] | undefined }> = [];
  database.withAdminTransaction.mockImplementationOnce(async (work: (client: { query: (sql: string, values?: unknown[]) => Promise<unknown> }) => Promise<unknown>) =>
    work({ query: async (sql, values) => {
      calls.push({ sql, values });
      if (sql.includes("from opportunities o")) return { rows: [{
        official_source_id: "ifpe-cursos-2026", deadline_at: "2026-10-23",
        deadline_precision: "date_only", deadline_open: true, applicant_type: "mixed",
        evidence_json: { deadline_at: { source_url: "https://portal.ifpe.edu.br/noticias/", excerpt: "Prazo oficial" } },
      }] };
      if (sql.includes("from official_sources")) return { rows: [{ active: true, verification_status: "verified", geographic_scope: ["Pernambuco"] }] };
      if (sql.includes("from opportunity_sources")) return { rows: [{ source_count: 1 }] };
      return { rows: [] };
    } }),
  );
  await decideOpportunity({
    id: "11111111-1111-4111-8111-111111111111", decision: "approve", reviewer: "apogee:admin-id",
  });
  const publication = calls.find((call) => call.sql.includes("review_status='approved'"));
  expect(publication?.sql).toContain("published_at=now()");
  expect(publication?.values).toEqual(["11111111-1111-4111-8111-111111111111", "apogee:admin-id"]);
});

it("does not turn a local source into a national opportunity", async () => {
  const queries: string[] = [];
  database.withAdminTransaction.mockImplementationOnce(async (work: (client: { query: (sql: string) => Promise<unknown> }) => Promise<unknown>) =>
    work({ query: async (sql) => {
      queries.push(sql);
      if (sql.includes("from opportunities o")) return { rows: [{
        official_source_id: "ifpe-cursos-2026", nationally_eligible: true,
      }] };
      if (sql.includes("from official_sources")) return { rows: [{
        active: true, verification_status: "verified", geographic_scope: ["Pernambuco"],
      }] };
      return { rows: [] };
    } }),
  );
  await expect(decideOpportunity({
    id: "11111111-1111-4111-8111-111111111111", decision: "approve", reviewer: "apogee:admin",
  })).rejects.toThrow("Abrangência nacional");
  expect(queries.some((sql) => sql.includes("review_status='approved'"))).toBe(false);
});
