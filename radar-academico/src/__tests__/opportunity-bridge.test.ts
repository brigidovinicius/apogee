import { beforeEach, expect, it, vi } from "vitest";

const review = vi.hoisted(() => ({
  listPendingOpportunities: vi.fn(async () => []),
  decideOpportunity: vi.fn(async () => undefined),
  OpportunityReviewError: class OpportunityReviewError extends Error {},
}));
vi.mock("@/lib/official-sources/review", () => review);

import { GET, POST } from "@/app/api/internal/editorial/opportunities/route";

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

it("rejects unauthenticated review calls before reading the queue or body", async () => {
  expect((await GET(new Request("https://radar.example/api/internal/editorial/opportunities"))).status).toBe(401);
  expect((await POST(new Request("https://radar.example/api/internal/editorial/opportunities", {
    method: "POST", body: "invalid",
  }))).status).toBe(401);
  expect(review.listPendingOpportunities).not.toHaveBeenCalled();
  expect(review.decideOpportunity).not.toHaveBeenCalled();
});

it("uses the dedicated token and forwards only the explicit review decision", async () => {
  vi.stubEnv("RADAR_ACADEMICO_ADMIN_API_TOKEN", "review-token");
  const headers = { authorization: "Bearer review-token", "content-type": "application/json" };
  expect((await GET(new Request("https://radar.example/api/internal/editorial/opportunities", { headers }))).status).toBe(200);
  expect(review.listPendingOpportunities).toHaveBeenCalledOnce();
  expect((await POST(new Request("https://radar.example/api/internal/editorial/opportunities", {
    method: "POST", headers,
    body: JSON.stringify({ id: "11111111-1111-4111-8111-111111111111", decision: "approve", reviewer: "apogee:admin" }),
  }))).status).toBe(200);
  expect(review.decideOpportunity).toHaveBeenCalledWith({
    id: "11111111-1111-4111-8111-111111111111", decision: "approve", reviewer: "apogee:admin",
  });
});
