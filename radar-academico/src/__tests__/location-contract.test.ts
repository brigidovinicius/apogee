import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  BRAZILIAN_STATE_CODES,
  normalizeBrazilianLocation,
} from "@/lib/location";
import { normalizeOpportunity } from "@/lib/ingestion/normalize-opportunity";
import type { OfficialSource } from "@/lib/ingestion/types";

const source: OfficialSource = {
  id: "structured-source", name: "Fonte", institutionName: "Instituição",
  institutionAcronym: "INST", sourceType: "federal_university",
  baseUrl: "https://example.edu.br/", allowedDomains: ["example.edu.br"],
  allowedPathPrefixes: ["/"], listingUrls: [], extractionMode: "html",
  audienceScope: ["undergraduate_student"], geographicScope: ["Santa Catarina"],
  categories: [], priority: 1, active: true,
};

describe("contrato canônico de localização", () => {
  it("mantém exatamente as 27 UFs e normaliza somente campos estruturados", () => {
    expect(BRAZILIAN_STATE_CODES).toHaveLength(27);
    expect(new Set(BRAZILIAN_STATE_CODES).size).toBe(27);
    expect(normalizeBrazilianLocation({ stateCode: " sp ", cityName: "Praia   Grande" })).toEqual({
      status: "valid", location: { stateCode: "SP", cityName: "Praia Grande" },
    });
    expect(normalizeBrazilianLocation({})).toEqual({
      status: "missing", location: { stateCode: null, cityName: null },
    });
    expect(normalizeBrazilianLocation({ cityName: "Santos" }).status).toBe("invalid");
    expect(normalizeBrazilianLocation({ stateCode: "XX", cityName: "Santos" }).status).toBe("invalid");
  });

  it("não infere cidade ou UF a partir do texto livre", () => {
    const candidate = normalizeOpportunity({
      title: "Bolsa de iniciação científica em Florianópolis SC",
      text: "Para estudante de graduação. Inscrições pelo formulário de inscrição até 20/10/2026.",
      url: "https://example.edu.br/edital",
      source,
    });
    expect(candidate?.stateCode).toBeNull();
    expect(candidate?.cityName).toBeNull();
  });

  it("usa a UF e cidade estruturadas como um par", () => {
    const candidate = normalizeOpportunity({
      title: "Bolsa de iniciação científica",
      text: "Para estudante de graduação. Inscrições pelo formulário de inscrição até 20/10/2026.",
      url: "https://example.edu.br/edital",
      source: { ...source, location: { stateCode: "SC", cityName: "Praia Grande" } },
    });
    expect(candidate).toMatchObject({ stateCode: "SC", cityName: "Praia Grande" });
  });

  it("mantém o monitor sanitizado, dependente e sem consulta por texto livre", async () => {
    const [page, filters, readModels] = await Promise.all([
      readFile(new URL("../app/admin/ingestoes/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/admin/ingestoes/location-filters.tsx", import.meta.url), "utf8"),
      readFile(new URL("../lib/db/read-models.ts", import.meta.url), "utf8"),
    ]);
    expect(page).toContain("Cobertura de localização");
    expect(page).toContain("Rejeitados na ingestão");
    expect(filters).toContain("params.delete(\"cidade\")");
    expect(filters).toContain("disabled={!stateCode || cities.length === 0}");
    expect(readModels).toContain("state_code=$");
    expect(readModels).not.toMatch(/title\s+(?:ilike|like)/i);
  });
});
