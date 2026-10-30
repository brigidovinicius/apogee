import { afterEach, expect, it, vi } from "vitest";
vi.mock("@/lib/ingestion/safe-request", () => ({ safeRequest: vi.fn() }));
import { safeRequest } from "@/lib/ingestion/safe-request";
import { fetchOfficialResource } from "@/lib/ingestion/fetch-source";
import { calendarAuditSource } from "@/lib/ingestion/calendar-sources";
afterEach(() => vi.resetAllMocks());
it("never requests alternative Comvest content when robots disallows its path", async () => {
  vi.mocked(safeRequest).mockResolvedValue(new Response("User-agent: *\nDisallow: /noticias/", { status: 200 }));
  const source = calendarAuditSource("comvest-vestibular-2027");
  await expect(fetchOfficialResource(source.baseUrl, source)).rejects.toThrow("bloqueado por robots");
  expect(safeRequest).toHaveBeenCalledTimes(1);
});
it("never guesses a Fuvest calendar when robots cannot be consulted", async () => {
  vi.mocked(safeRequest).mockResolvedValue(new Response("Forbidden", { status: 403 }));
  const source = calendarAuditSource("fuvest-vestibular-2027");
  await expect(fetchOfficialResource(source.baseUrl, source)).rejects.toThrow("robots.txt indisponível");
  expect(safeRequest).toHaveBeenCalledTimes(1);
});
it("does not follow a new calendar redirect outside the audited scope", async () => {
  vi.mocked(safeRequest).mockResolvedValueOnce(new Response("", { status: 200 }))
    .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "https://unreviewed.example.org/calendar" } }));
  const source = calendarAuditSource("obmep-calendar-2026");
  await expect(fetchOfficialResource(source.baseUrl, source)).rejects.toThrow("URL fora do registro");
  expect(safeRequest).toHaveBeenCalledTimes(2);
});
