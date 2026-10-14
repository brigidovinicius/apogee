import { afterEach, expect, it, vi } from "vitest";
import type { OfficialSource } from "@/lib/ingestion/types";

vi.mock("@/lib/ingestion/official-source-registry", () => ({
  claimDueOfficialSources: vi.fn(), completeScheduledSource: vi.fn(), loadOfficialSource: vi.fn(),
}));
vi.mock("@/lib/ingestion/fetch-source", () => ({
  fetchOfficialResource: vi.fn(), boundedInteger: (value: string | undefined, fallback: number) => value === undefined ? fallback : Number(value),
}));
vi.mock("@/lib/ingestion/recheck", () => ({ recheckKnownOpportunities: vi.fn(async () => ({ pagesChecked: 0, failed: 0, published: 0 })) }));
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

it("varre várias fontes vencidas, lê páginas de detalhe e publica resultados válidos automaticamente", async () => {
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
  vi.mocked(saveReviewItems).mockResolvedValue({ saved: 1, published: 1, blocked: 0, created: 1, updated: 0, persistence: "postgres" });

  const report = await runScheduledOfficialSourceIngestion();
  expect(claimDueOfficialSources).toHaveBeenCalledWith(3);
  expect(report).toMatchObject({ sourcesChecked: 2, pagesChecked: 4, discovered: 2, sentToReview: 0, failed: 0, published: 2, automaticPublish: true });
  expect(vi.mocked(saveReviewItems).mock.calls[0][1].discovered[0]).toMatchObject({ isCourse: true, reviewStatus: "needs_information" });
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
  vi.mocked(saveReviewItems).mockResolvedValue({ saved: 1, published: 1, blocked: 0, created: 1, updated: 0, persistence: "postgres" });

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

it("extrai o hackathon global da página oficial mesmo quando o primeiro main é um modal", async () => {
  vi.stubEnv("DATABASE_URL", "fixture");
  const source: OfficialSource = {
    ...makeSource("nasa-space-apps-2026"),
    institutionName: "NASA Space Apps Challenge",
    baseUrl: "https://www.spaceappschallenge.org/2026/",
    allowedDomains: ["www.spaceappschallenge.org"],
    allowedPathPrefixes: ["/blog/", "/2026/"],
    listingUrls: ["https://www.spaceappschallenge.org/blog/explore-the-next-frontier-at-the-2026-nasa-space-apps-challenge/"],
    geographicScope: ["Global"],
    location: { stateCode: null, cityName: null },
  };
  vi.mocked(loadOfficialSource).mockResolvedValue(source);
  vi.mocked(fetchOfficialResource).mockImplementation(async (url) => {
    const body = url.includes("/blog/")
      ? '<a href="/2026/">2026 Hackathon</a>'
      : `<body><main>Third-Party Link</main><section>Welcome to the 2026 NASA Space Apps Challenge! Register to join us on November 14-15.
         REGISTER FOR THE HACKATHON August 26, 2026 To participate, you must first register for the 2026 NASA Space Apps Challenge.
         You can register up until the hackathon closes on November 15.
         Choose the virtual Universal Event if you cannot attend locally.</section></body>`;
    return { body: Buffer.from(body), contentType: "text/html", hash: "fixture", cached: false };
  });
  vi.mocked(saveReviewItems).mockResolvedValue({ saved: 1, published: 1, blocked: 0, created: 1, updated: 0, persistence: "postgres" });

  const report = await runOfficialSourceIngestion({ sourceId: source.id, maxPages: 5, maxCandidates: 10 });
  expect(report).toMatchObject({ pagesChecked: 2, discovered: 1, published: 1 });
  expect(vi.mocked(saveReviewItems).mock.calls[0][1].discovered[0]).toMatchObject({
    title: "NASA Space Apps Challenge 2026", categories: ["competicoes", "eventos"],
    deadlineAt: "2026-11-15", opportunityStatus: "open",
    geographicScopeKind: "global", countryCode: null, stateCode: null, cityName: null,
  });
});

it("publica o edital de intercâmbio do MinC com país e prazo exato, sem inventar UF ou cidade", async () => {
  vi.stubEnv("DATABASE_URL", "fixture");
  const url = "https://www.gov.br/cultura/pt-br/assuntos/editais/inscricoes-em-andamento/edital-de-intercambio-cultural-circulacao-e-participacao-audiovisual-no-exterior";
  const source: OfficialSource = {
    ...makeSource("minc-intercambio-audiovisual-2026"),
    institutionName: "Ministério da Cultura", baseUrl: "https://www.gov.br/cultura/pt-br/assuntos/editais/inscricoes-em-andamento",
    allowedDomains: ["www.gov.br"], allowedPathPrefixes: ["/cultura/pt-br/assuntos/editais/inscricoes-em-andamento"],
    listingUrls: ["https://www.gov.br/cultura/pt-br/assuntos/editais/inscricoes-em-andamento"],
    geographicScope: ["Brasil"], location: { stateCode: null, cityName: null },
  };
  vi.mocked(loadOfficialSource).mockResolvedValue(source);
  vi.mocked(fetchOfficialResource).mockImplementation(async (requestedUrl) => {
    const body = requestedUrl === source.listingUrls[0]
      ? `<main><a href="${url}">Edital de Intercâmbio Cultural - Circulação e Participação Audiovisual no Exterior</a></main>`
      : `<main><h1>Edital de Intercâmbio Cultural - Circulação e Participação Audiovisual no Exterior</h1>
         Poderão ser beneficiados(as) Pessoas Físicas, estudantes ou profissionais, do segmento audiovisual.
         Os recursos serão distribuídos nacionalmente, sendo vedado exceder o limite de 40% por região brasileira.
         As inscrições são gratuitas e estarão abertas, em regime de fluxo contínuo, iniciando-se em 15 de junho de 2026 e permanecendo disponíveis até as 18h (dezoito horas) do dia 6 de novembro de 2026, ou até o esgotamento dos recursos disponibilizados, ocasião em que as inscrições serão suspensas.
         O Sistema Mapa da Cultura é o sistema a ser, obrigatoriamente, utilizado para inscrição da proposta.</main>`;
    return { body: Buffer.from(body), contentType: "text/html", hash: "fixture", cached: false };
  });
  vi.mocked(saveReviewItems).mockResolvedValue({ saved: 1, published: 1, blocked: 0, created: 1, updated: 0, persistence: "postgres" });

  const report = await runOfficialSourceIngestion({ sourceId: source.id, maxPages: 3, maxCandidates: 10 });
  expect(report).toMatchObject({ pagesChecked: 2, discovered: 1, published: 1 });
  expect(vi.mocked(saveReviewItems).mock.calls[0][1].discovered[0]).toMatchObject({
    title: "Edital de Intercâmbio Cultural MinC 2026 — Audiovisual no Exterior",
    categories: ["intercambios", "bolsas"], deadlineAt: "2026-11-06T18:00:00-03:00",
    deadlinePrecision: "exact_datetime", opportunityStatus: "open", nationallyEligible: true,
    geographicScopeKind: "country", countryCode: "BR", stateCode: null, cityName: null,
  });
});

it("extrai bolsas de pesquisa da listagem oficial FAPESP sem duplicar os links em inglês", async () => {
  vi.stubEnv("DATABASE_URL", "fixture");
  const url = "https://fapesp.br/oportunidades/projeto-de-logica/9715/";
  const source: OfficialSource = {
    ...makeSource("fapesp-open-fellowships"),
    institutionName: "Fundação de Amparo à Pesquisa do Estado de São Paulo",
    baseUrl: "https://fapesp.br/oportunidades/",
    allowedDomains: ["fapesp.br", "www.fapesp.br"], allowedPathPrefixes: ["/oportunidades/"],
    listingUrls: ["https://fapesp.br/oportunidades/"],
    location: { stateCode: null, cityName: null },
  };
  vi.mocked(loadOfficialSource).mockResolvedValue(source);
  vi.mocked(fetchOfficialResource).mockImplementation(async (requestedUrl) => {
    const body = requestedUrl === source.listingUrls[0]
      ? `<h1>Oportunidades de Bolsas</h1><a href="${url}">Bolsa de PD em Lógica Instituição: Universidade Estadual de Campinas Cidade: Campinas Inscrições até: 15/10/2099</a><a href="${url}">Post-Doctoral Fellowship in Logic Institution: Universidade Estadual de Campinas</a>`
      : `<body>FAPESP | Fundo de Amparo à Pesquisa do Estado de São Paulo Bolsa de PD em Lógica
         Título do projeto: Racionalidade, Lógica e Probabilidade Project title: Rationality, Logic and Probability
         Valor da bolsa: R$ 12.570,00 Value: R$ 12,570.00
         Unidade/Instituição: Universidade Estadual de Campinas Unit/Instituition: Universidade Estadual de Campinas
         Data limite para inscrições: 15/10/2099 Deadline for submissions: 2099-10-15
         Localização: Campinas Locale: Campinas
         E-mail para inscrições: bolsas@unicamp.br E-mail for proposal submission: bolsas@unicamp.br</body>`;
    return { body: Buffer.from(body), contentType: "text/html", hash: "fixture", cached: false };
  });
  vi.mocked(saveReviewItems).mockResolvedValue({ saved: 1, published: 1, blocked: 0, created: 1, updated: 0, persistence: "postgres" });

  const report = await runOfficialSourceIngestion({ sourceId: source.id, maxPages: 5, maxCandidates: 10 });
  expect(report).toMatchObject({ pagesChecked: 2, discovered: 1, published: 1 });
  expect(vi.mocked(saveReviewItems).mock.calls[0][1].discovered[0]).toMatchObject({
    title: "Bolsa de PD em Lógica", institution: "Universidade Estadual de Campinas",
    categories: ["bolsas", "pesquisa"], applicationRoute: "direct_application",
    deadlineAt: "2099-10-15", deadlinePrecision: "date_only", opportunityStatus: "open",
    geographicScopeKind: "unknown", countryCode: null, stateCode: null, cityName: null,
  });
});
