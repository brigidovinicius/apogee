import { beforeEach, expect, it, vi } from "vitest";

const editorial = vi.hoisted(() => {
  class EditorialInputError extends Error {}
  return {
    EditorialInputError,
    listEditorialSources: vi.fn<() => Promise<unknown[]>>(async () => []),
    verifyEditorialSource: vi.fn(async () => undefined),
    setEditorialSourceActive: vi.fn(async () => undefined),
    runEditorialSourceIngestion: vi.fn(async () => ({ pagesChecked: 0, discovered: 0, sentToReview: 0, published: 0 })),
  };
});

vi.mock("@/lib/official-sources/editorial", () => editorial);

import { GET, POST } from "@/app/api/internal/editorial/sources/route";

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

it("the editorial bridge fails closed before any source operation", async () => {
  expect((await GET(new Request("https://radar.example/internal/editorial/sources"))).status).toBe(401);
  expect((await POST(new Request("https://radar.example/internal/editorial/sources", {
    method: "POST",
    body: JSON.stringify({ action: "verify", sourceId: "ufsc-propesq" }),
  }))).status).toBe(401);
  expect(editorial.listEditorialSources).not.toHaveBeenCalled();
  expect(editorial.verifyEditorialSource).not.toHaveBeenCalled();
  expect(editorial.setEditorialSourceActive).not.toHaveBeenCalled();
  expect(editorial.runEditorialSourceIngestion).not.toHaveBeenCalled();
});

it("the dedicated admin token permits only bounded editorial operations", async () => {
  vi.stubEnv("RADAR_ACADEMICO_ADMIN_API_TOKEN", "editorial-test-token");
  const headers = { authorization: "Bearer editorial-test-token", "content-type": "application/json" };

  editorial.listEditorialSources.mockResolvedValueOnce([{ id: "ufsc-propesq" }]);
  const listed = await GET(new Request("https://radar.example/internal/editorial/sources", { headers }));
  expect(listed.status).toBe(200);
  expect(await listed.json()).toEqual({ sources: [{ id: "ufsc-propesq" }] });

  const verified = await POST(new Request("https://radar.example/internal/editorial/sources", {
    method: "POST", headers,
    body: JSON.stringify({
      action: "verify", sourceId: "ufsc-propesq", officialSource: true, locationConfirmed: true, collectionAllowed: true,
    }),
  }));
  expect(verified.status).toBe(200);
  expect(editorial.verifyEditorialSource).toHaveBeenCalledWith({
    sourceId: "ufsc-propesq", officialSource: true, locationConfirmed: true, collectionAllowed: true,
  });

  const ingested = await POST(new Request("https://radar.example/internal/editorial/sources", {
    method: "POST", headers,
    body: JSON.stringify({ action: "ingest", sourceId: "ufsc-propesq", maxPages: 1, maxCandidates: 10 }),
  }));
  expect(ingested.status).toBe(200);
  expect(editorial.runEditorialSourceIngestion).toHaveBeenCalledWith({ sourceId: "ufsc-propesq", maxPages: 1, maxCandidates: 10 });
});

it("the bridge rejects an unknown operation without touching editorial state", async () => {
  vi.stubEnv("RADAR_ACADEMICO_ADMIN_API_TOKEN", "editorial-test-token");
  const response = await POST(new Request("https://radar.example/internal/editorial/sources", {
    method: "POST",
    headers: { authorization: "Bearer editorial-test-token", "content-type": "application/json" },
    body: JSON.stringify({ action: "publish-everything", sourceId: "ufsc-propesq" }),
  }));
  expect(response.status).toBe(400);
  expect(editorial.verifyEditorialSource).not.toHaveBeenCalled();
  expect(editorial.setEditorialSourceActive).not.toHaveBeenCalled();
  expect(editorial.runEditorialSourceIngestion).not.toHaveBeenCalled();
});
