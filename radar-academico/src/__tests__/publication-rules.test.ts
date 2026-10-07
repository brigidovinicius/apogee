import { describe, expect, it } from "vitest";
import { classifyApplicationRoute } from "@/lib/ingestion/classify-application-route";
import { normalizeOpportunity } from "@/lib/ingestion/normalize-opportunity";
import { isPublishable, isVisiblePublicOpportunity } from "@/lib/ingestion/save-review-item";
import type { OfficialSource, OpportunityCandidate } from "@/lib/ingestion/types";

const source: OfficialSource = {
  id: "ufsc", name: "UFSC", institutionName: "UFSC", institutionAcronym: "UFSC",
  sourceType: "federal_university", baseUrl: "https://propesq.ufsc.br/",
  allowedDomains: ["propesq.ufsc.br"], allowedPathPrefixes: ["/"],
  listingUrls: [], extractionMode: "html", audienceScope: ["mixed"],
  geographicScope: ["SC"], categories: [], priority: 1, active: true,
};

const candidate: OpportunityCandidate = {
  officialSourceId: "ufsc", title: "Bolsa", institution: "UFSC",
  sourcePageUrl: "https://propesq.ufsc.br/edital", applicantType: "undergraduate_student",
  applicationRoute: "direct_student_application", benefitType: "research_scholarship",
  deadlineAt: "2027-10-20T23:59:00-03:00", deadlinePrecision: "exact_datetime",
  requirementsText: "Consulte o edital", amountText: "Consulte o edital",
  reviewStatus: "approved", opportunityStatus: "open", evidenceJson: {},
  extractionMethod: "html", contentHash: "abc",
};

describe("regras de publicação", () => {
  it("não trata chamada institucional como candidatura direta", () => {
    expect(classifyApplicationRoute("Chamada institucional para universidades proponentes")).toBe("institutional_call");
  });

  it("item extraído sempre entra como pending_review", () => {
    const item = normalizeOpportunity({
      title: "Bolsa de iniciação científica",
      text: "Para estudante de graduação. Inscrições pelo formulário de inscrição até 20/10/2026.",
      url: "https://propesq.ufsc.br/edital", source,
    });
    expect(item?.reviewStatus).toBe("pending_review");
  });

  it("não publica sem prazo", () => {
    expect(isPublishable({ ...candidate, deadlineAt: undefined, deadlinePrecision: "not_informed", humanVerifiedAt: "2026-01-01" })).toBe(false);
  });

  it("não publica sem fonte oficial", () => {
    expect(isPublishable({ ...candidate, officialSourceId: "", humanVerifiedAt: "2026-01-01" })).toBe(false);
  });

  it("não publica sem revisão humana", () => {
    expect(isPublishable(candidate)).toBe(false);
  });

  it("oculta oportunidade vencida", () => {
    expect(isVisiblePublicOpportunity({ ...candidate, deadlineAt: "2025-01-01", humanVerifiedAt: "2024-12-01" }, new Date("2026-01-01"))).toBe(false);
  });
});