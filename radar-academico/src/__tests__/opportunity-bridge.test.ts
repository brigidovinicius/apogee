import { beforeEach, expect, it, vi } from "vitest";
const calls = vi.hoisted(() => ({ list: vi.fn(async () => []), manage: vi.fn(async () => ({ id: "test" })) }));
vi.mock("@/lib/db/live-catalogue", () => ({ listLiveCatalogue: calls.list }));
vi.mock("@/lib/official-sources/catalogue-management", () => ({ manageCatalogue: calls.manage, CatalogueError: class extends Error {} }));
import { GET, POST, PATCH, DELETE } from "@/app/api/internal/editorial/opportunities/route";
beforeEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); });
it("rejects missing or public-only credentials before any catalogue read or mutation", async () => {
 vi.stubEnv("RADAR_ACADEMICO_API_TOKEN", "public-token"); vi.stubEnv("RADAR_ACADEMICO_ADMIN_API_TOKEN", "admin-token");
 for (const token of ["", "public-token"]) for (const [method, handler] of Object.entries({ GET, POST, PATCH, DELETE })) {
  const req = new Request("https://radar.example/api", { method, headers: { authorization: `Bearer ${token}` }, ...(method !== "GET" ? { body: "invalid" } : {}) });
  expect((await handler(req)).status).toBe(401);
 }
 expect(calls.list).not.toHaveBeenCalled(); expect(calls.manage).not.toHaveBeenCalled();
});
it("returns the live catalogue and forwards authenticated CRUD methods", async () => {
 vi.stubEnv("RADAR_ACADEMICO_ADMIN_API_TOKEN", "admin-token");
 const headers = { authorization: "Bearer admin-token" };
 expect((await GET(new Request("https://radar.example/api", { headers }))).status).toBe(200);
 expect(calls.list).toHaveBeenCalledWith(true);
 for (const [method, handler] of Object.entries({ POST, PATCH, DELETE })) {
  expect((await handler(new Request("https://radar.example/api", { method, headers, body: JSON.stringify({ actor: "admin" }) }))).status).toBe(200);
  expect(calls.manage).toHaveBeenCalledWith(method, { actor: "admin" });
 }
});
it("rejects malformed and oversized bodies before persistence", async () => {
 vi.stubEnv("RADAR_ACADEMICO_ADMIN_API_TOKEN", "admin-token");
 for (const body of ["[]", "null", "invalid", "x".repeat(24_001)]) {
  expect((await POST(new Request("https://radar.example/api", { method: "POST", headers: { authorization: "Bearer admin-token" }, body }))).status).toBe(400);
 }
 expect(calls.manage).not.toHaveBeenCalled();
});
