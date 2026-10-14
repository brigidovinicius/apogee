import { beforeEach, expect, it, vi } from "vitest";

const imports = vi.hoisted(() => ({
  parseManualCsv: vi.fn(() => [{ source: { id: "ifpe-cursos-2026" }, candidate: { title: "Curso 1" } },
    { source: { id: "ifpe-cursos-2026" }, candidate: { title: "Curso 2" } }]),
  saveReviewItems: vi.fn(async (_source: unknown, result: { discovered: unknown[] }) => ({ saved: result.discovered.length, published: 0, blocked: result.discovered.length })),
  withAdminTransaction: vi.fn(async (work: (client: { query: () => Promise<unknown> }) => Promise<unknown>) =>
    work({ query: async () => ({ rows: [{ id: "ifpe-cursos-2026" }] }) })),
}));
vi.mock("@/lib/ingestion/import-csv", () => ({ parseManualCsv: imports.parseManualCsv }));
vi.mock("@/lib/ingestion/save-review-item", () => ({ saveReviewItems: imports.saveReviewItems }));
vi.mock("@/lib/db/client", () => ({ withAdminTransaction: imports.withAdminTransaction }));

import { POST } from "@/app/api/internal/editorial/import/route";

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

it("requires the private admin token before parsing course data", async () => {
  const response = await POST(new Request("https://radar.example/api/internal/editorial/import", {
    method: "POST", body: "private course details",
  }));
  expect(response.status).toBe(401);
  expect(imports.parseManualCsv).not.toHaveBeenCalled();
  expect(imports.saveReviewItems).not.toHaveBeenCalled();
});

it("sends a verified same-source batch to automatic validation without inventing status", async () => {
  vi.stubEnv("RADAR_ACADEMICO_ADMIN_API_TOKEN", "import-token");
  const response = await POST(new Request("https://radar.example/api/internal/editorial/import", {
    method: "POST", body: "official_source_name,source_page_url\nfixture,https://example.org/",
    headers: { authorization: "Bearer import-token" },
  }));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ received: 2, saved: 2, blocked: 2, published: 0 });
  expect(imports.saveReviewItems).toHaveBeenCalledOnce();
  expect(imports.saveReviewItems.mock.calls[0]?.[1].discovered).toHaveLength(2);
});
