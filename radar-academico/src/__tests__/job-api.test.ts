import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/lib/ingestion/safe-request", () => ({ safeRequest: vi.fn() }));
vi.mock("@/lib/ingestion/fetch-source", () => ({ rateLimit: vi.fn() }));
import { safeRequest } from "@/lib/ingestion/safe-request";
import { fetchPublicJobApi } from "@/lib/ingestion/job-api";
import { jobSource } from "@/lib/ingestion/job-sources";
const source = { ...jobSource("jobs-whippy"), active: true };
beforeEach(() => vi.mocked(safeRequest).mockReset());
it("reads only the documented public Ashby feed when its separate robots resource requires authentication", async () => {
  vi.mocked(safeRequest).mockResolvedValueOnce(new Response(null, { status: 401 })).mockResolvedValueOnce(new Response('{"apiVersion":"1","jobs":[]}', { headers: { "content-type": "application/json" } }));
  expect((await fetchPublicJobApi(source)).contentType).toBe("application/json");
  expect(vi.mocked(safeRequest).mock.calls[1][0]).toBe(source.listingUrls[0]);
  expect(JSON.stringify(vi.mocked(safeRequest).mock.calls)).not.toMatch(/Authorization/);
});
it("explicit robots denial, forbidden, unavailable and foreign endpoints remain blocked", async () => {
  for (const response of [new Response("User-agent: *\nDisallow: /"), new Response(null, { status: 403 }), new Response(null, { status: 500 })]) {
    vi.mocked(safeRequest).mockReset().mockResolvedValueOnce(response);
    await expect(fetchPublicJobApi(source)).rejects.toThrow(); expect(safeRequest).toHaveBeenCalledTimes(1);
  }
  vi.mocked(safeRequest).mockReset();
  await expect(fetchPublicJobApi({ ...source, listingUrls: ["https://api.ashbyhq.com/private"] })).rejects.toThrow();
  expect(safeRequest).not.toHaveBeenCalled();
});
it("the API-specific 401 policy never applies to another provider", async () => {
  vi.mocked(safeRequest).mockResolvedValueOnce(new Response(null, { status: 401 }));
  await expect(fetchPublicJobApi({ ...jobSource("jobs-nortal"), active: true })).rejects.toThrow();
});
