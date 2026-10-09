import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/lib/db/client", () => ({ queryPublic: vi.fn(async () => ({ rows: [] })), withAdminTransaction: vi.fn() }));
vi.mock("@/lib/ingestion", () => ({ runOfficialSourceIngestion: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn((url: string) => { throw new Error(url); }) }));
vi.mock("@/lib/auth/admin", () => ({ isAdmin: vi.fn() }));
vi.mock("@/lib/ingestion/import-csv", () => ({ parseManualCsv: vi.fn(() => { throw new Error("secret DB connection"); }) }));
import { queryPublic } from "@/lib/db/client";
import { listPublicOpportunities, getPublicOpportunity } from "@/lib/db/read-models";
import { GET } from "@/app/api/public/opportunities/route";
import { POST as cron } from "@/app/api/cron/ingest-official-sources/route";
import { POST as csv } from "@/app/api/admin/import-csv/route";
import { runOfficialSourceIngestion } from "@/lib/ingestion";
import { isAdmin } from "@/lib/auth/admin";
import Home from "@/app/page";
import Detail from "@/app/oportunidades/[id]/page";
beforeEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); });
it("unauthenticated catalogue does not reach database", async () => {
  expect((await GET(new Request("https://radar.example/api"))).status).toBe(401);
  expect(queryPublic).not.toHaveBeenCalled();
});
it("every outward SQL query includes editorial and publication constraints", async () => {
  vi.stubEnv("DATABASE_URL", "fixture-only"); vi.stubEnv("RADAR_ACADEMICO_API_TOKEN", "fixture-token");
  await listPublicOpportunities(); await getPublicOpportunity("fixture-id");
  await GET(new Request("https://radar.example/api", { headers: { authorization: "Bearer fixture-token" } }));
  expect(queryPublic).toHaveBeenCalledTimes(3);
  for (const [sql] of vi.mocked(queryPublic).mock.calls) {
    expect(sql).toContain("where"); expect(sql).toContain("o.review_status='approved'");
    expect(sql).toContain("o.published_at is not null"); expect(sql).toContain("o.human_verified_at is not null");
    expect(sql).toContain("o.opportunity_status='open'"); expect(sql).toContain("o.deadline_at >= now()");
  }
});
it("standalone pages redirect before reading full data", () => {
  expect(() => Home()).toThrow("https://apogee.community/oportunidades");
  expect(() => Detail()).toThrow("https://apogee.community/membros/oportunidades");
  expect(queryPublic).not.toHaveBeenCalled();
});
it("cron fails closed and does not disclose internal failures", async () => {
  expect((await cron(new Request("https://radar.example/cron"))).status).toBe(401);
  vi.stubEnv("CRON_SECRET", "fixture");
  vi.mocked(runOfficialSourceIngestion).mockRejectedValue(new Error("postgres://secret"));
  const response = await cron(new Request("https://radar.example/cron", { headers: { authorization: "Bearer fixture" } }));
  expect(response.status).toBe(500); expect(await response.text()).not.toMatch(/postgres|secret/);
});
it("CSV requires admin and returns only generic parser errors", async () => {
  vi.mocked(isAdmin).mockResolvedValue(false);
  expect((await csv(new Request("https://radar.example/csv", { method: "POST", body: "csv" }))).status).toBe(401);
  vi.mocked(isAdmin).mockResolvedValue(true);
  const response = await csv(new Request("https://radar.example/csv", { method: "POST", body: "csv" }));
  expect(response.status).toBe(400); expect(await response.text()).not.toMatch(/secret|connection/);
});
