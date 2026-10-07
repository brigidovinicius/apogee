import { describe, expect, it, vi } from "vitest";
import { canStoreExternalApplicationUrl, isOfficialSourceUrl, resolveAndValidateOfficialUrl } from "@/lib/ingestion/validate-url";
import type { OfficialSource } from "@/lib/ingestion/types";

const source: OfficialSource = {
  id: "ufsc", name: "UFSC", institutionName: "UFSC", institutionAcronym: "UFSC",
  sourceType: "federal_university", baseUrl: "https://propesq.ufsc.br/",
  allowedDomains: ["propesq.ufsc.br"], allowedPathPrefixes: ["/editais/"],
  listingUrls: [], extractionMode: "html", audienceScope: ["mixed"],
  geographicScope: ["SC"], categories: [], priority: 1, active: true,
};

describe("validação de fontes oficiais", () => {
  it("aceita URL oficial permitida", () => {
    expect(isOfficialSourceUrl("https://propesq.ufsc.br/editais/2026", [source])).toBe(true);
  });

  it.each([
    "https://instagram.com/p/123",
    "https://querobolsa.com.br/bolsas",
    "https://bit.ly/edital",
    "http://propesq.ufsc.br/editais/2026",
    "https://user:pass@propesq.ufsc.br/editais/2026",
    "https://127.0.0.1/editais/2026",
  ])("rejeita origem proibida: %s", (url) => {
    expect(isOfficialSourceUrl(url, [source], true)).toBe(false);
  });

  it("bloqueia redirecionamento para domínio externo", async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 302, headers: { location: "https://evil.example/file" } })) as unknown as typeof fetch;
    const result = await resolveAndValidateOfficialUrl("https://propesq.ufsc.br/editais/2026", source, fetcher);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/externo/);
  });

  it("rejeita formulário externo sem página oficial", () => {
    expect(canStoreExternalApplicationUrl({
      applicationUrl: "https://docs.google.com/forms/d/e/example",
      primaryOfficialUrl: "https://medium.com/edital",
      source,
    })).toBe(false);
  });

  it("aceita formulário externo somente como candidatura vinculada", () => {
    expect(canStoreExternalApplicationUrl({
      applicationUrl: "https://docs.google.com/forms/d/e/example",
      primaryOfficialUrl: "https://propesq.ufsc.br/editais/2026",
      source,
    })).toBe(true);
  });
});