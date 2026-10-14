import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  BRAZILIAN_STATE_CODES,
  normalizeBrazilianLocation,
} from "@/lib/location";
import { normalizeOpportunity } from "@/lib/ingestion/normalize-opportunity";
import { sourceCoverage, sourceEvidenceUrl, sourceLocation } from "@/lib/ingestion/source-settings";
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

  it("marca elegibilidade nacional só com escopo oficial e texto explícito", () => {
    const nationalSource = { ...source, geographicScope: ["Brasil"], location: { stateCode: null, cityName: null } };
    const input = {
      title: "Curso gratuito de tecnologia",
      text: "Inscrições até 20/10/2026 pelo formulário de inscrição para estudantes de todo o Brasil.",
      url: "https://example.edu.br/curso", source: nationalSource,
    };
    expect(normalizeOpportunity(input)).toMatchObject({ nationallyEligible: true, stateCode: null, cityName: null });
    expect(normalizeOpportunity({ ...input, text: input.text.replace("de todo o Brasil", "da cidade") })?.nationallyEligible).toBe(false);
  });

  it("exige UF e evidência oficial para uma fonte em auditoria", () => {
    const form = new FormData();
    form.set("state_code", "pr"); form.set("city_name", "Curitiba");
    expect(sourceLocation(form)).toEqual({ stateCode: "PR", cityName: "Curitiba" });
    form.set("state_code", "");
    expect(() => sourceLocation(form)).toThrow("UF");
    expect(sourceEvidenceUrl("https://www.ufpr.br/auditoria", ["www.ufpr.br"])).toBe("https://www.ufpr.br/auditoria");
    expect(() => sourceEvidenceUrl("https://externo.example/evidencia", ["www.ufpr.br"])).toThrow();
  });

  it("permite fonte nacional somente com abrangência explícita e sem cidade inventada", () => {
    const form = new FormData();
    form.set("scope", "national"); form.set("state_code", ""); form.set("city_name", "");
    expect(sourceCoverage(form)).toEqual({ location: { stateCode: null, cityName: null }, geographicScope: ["Brasil"] });
    form.set("city_name", "Brasília");
    expect(() => sourceCoverage(form)).toThrow();
    form.set("scope", "state"); form.set("state_code", "DF");
    expect(sourceCoverage(form).location).toEqual({ stateCode: "DF", cityName: "Brasília" });
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
