import { afterEach, expect, it, vi } from "vitest";
import type { OfficialSource } from "@/lib/ingestion/types";

vi.mock("@/lib/ingestion/official-source-registry", () => ({
  claimDueOfficialSources: vi.fn(), completeScheduledSource: vi.fn(), loadOfficialSource: vi.fn(),
}));
vi.mock("@/lib/ingestion/fetch-source", () => ({
  fetchOfficialResource: vi.fn(), boundedInteger: (value: string | undefined, fallback: number) => value === undefined ? fallback : Number(value),
}));
vi.mock("@/lib/ingestion/save-review-item", () => ({ saveReviewItems: vi.fn() }));

import { claimDueOfficialSources, completeScheduledSource, loadOfficialSource } from "@/lib/ingestion/official-source-registry";
import { fetchOfficialResource } from "@/lib/ingestion/fetch-source";
import { saveReviewItems } from "@/lib/ingestion/save-review-item";
import { runOfficialSourceIngestion, runScheduledOfficialSourceIngestion } from "@/lib/ingestion";

const makeSource = (id: string): OfficialSource => ({
  id, name: id, institutionName: "Instituto Federal", institutionAcronym: "IF",
  sourceType: "federal_institute", baseUrl: "https://example.edu.br/",
  allowedDomains: ["example.edu.br"], allowedPathPrefixes: ["/"],
  listingUrls: [`https://example.edu.br/${id}/editais`], extractionMode: "html",
  audienceScope: ["mixed"], geographicScope: [], location: { stateCode: "SP", cityName: null },
  categories: [], priority: 1, active: true,
});

afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); });

it("varre várias fontes vencidas, lê páginas de detalhe e mantém publicação manual", async () => {
  vi.stubEnv("DATABASE_URL", "fixture");
  const sources = [makeSource("source-a"), makeSource("source-b")];
  vi.mocked(claimDueOfficialSources).mockResolvedValue(sources);
  vi.mocked(loadOfficialSource).mockImplementation(async (id) => sources.find((source) => source.id === id) ?? null);
  vi.mocked(fetchOfficialResource).mockImplementation(async (url) => {
    const body = url.endsWith("/editais")
      ? `<main><a href="/${url.includes("source-a") ? "source-a" : "source-b"}/curso">Curso gratuito de soldagem</a></main>`
      : "<article><h1>Curso gratuito de soldagem</h1><p>Inscrições até 20/10/2026 pelo formulário de inscrição para estudantes.</p></article>";
    return { body: Buffer.from(body), contentType: "text/html", hash: "fixture", cached: false };
  });
  vi.mocked(saveReviewItems).mockResolvedValue({ saved: 1, persistence: "postgres" });

  const report = await runScheduledOfficialSourceIngestion();
  expect(claimDueOfficialSources).toHaveBeenCalledWith(3);
  expect(report).toMatchObject({ sourcesChecked: 2, pagesChecked: 4, discovered: 2, sentToReview: 2, failed: 0, published: 0, automaticPublish: false });
  expect(vi.mocked(saveReviewItems).mock.calls[0][1].discovered[0]).toMatchObject({ isCourse: true, reviewStatus: "pending_review" });
  expect(completeScheduledSource).toHaveBeenCalledWith("source-a", false);
  expect(completeScheduledSource).toHaveBeenCalledWith("source-b", false);
});

it("avança pelos links sem repetir sempre os primeiros", async () => {
  vi.stubEnv("DATABASE_URL", "fixture");
  const source = makeSource("source-c");
  vi.mocked(loadOfficialSource).mockImplementation(async () => source);
  vi.mocked(fetchOfficialResource).mockImplementation(async (url) => {
    const body = url.endsWith("/editais")
      ? `<main>${[1, 2, 3].map((number) => `<a href="/source-c/curso-${number}">Curso gratuito ${number}</a>`).join("")}</main>`
      : "<article>Inscrições até 20/10/2026 pelo formulário de inscrição para estudantes.</article>";
    return { body: Buffer.from(body), contentType: "text/html", hash: "fixture", cached: false };
  });
  vi.mocked(saveReviewItems).mockResolvedValue({ saved: 1, persistence: "postgres" });

  const first = await runOfficialSourceIngestion({ sourceId: source.id, maxPages: 3, maxCandidates: 10 });
  expect(first.sources[0]).toMatchObject({ pagesChecked: 3, nextListingIndex: 0, nextLinkOffset: 2 });
  source.crawlLinkOffset = 2;
  const second = await runOfficialSourceIngestion({ sourceId: source.id, maxPages: 3, maxCandidates: 10 });
  expect(second.sources[0]).toMatchObject({ pagesChecked: 2, nextListingIndex: 0, nextLinkOffset: 0 });
  const urls = vi.mocked(fetchOfficialResource).mock.calls.map(([url]) => url);
  expect(urls).toEqual([
    source.listingUrls[0], "https://example.edu.br/source-c/curso-1", "https://example.edu.br/source-c/curso-2",
    source.listingUrls[0], "https://example.edu.br/source-c/curso-3",
  ]);
});
