import { describe, expect, it } from "vitest";
import { classifyApplicationRoute } from "@/lib/ingestion/classify-application-route";
import { normalizeOpportunity } from "@/lib/ingestion/normalize-opportunity";
import { detectDeadline } from "@/lib/ingestion/detect-deadline";
import { parseManualCsv } from "@/lib/ingestion/import-csv";
import { isPublishable, isVisiblePublicOpportunity } from "@/lib/ingestion/save-review-item";
import type { OfficialSource, OpportunityCandidate } from "@/lib/ingestion/types";

const source: OfficialSource = {
  id: "ufsc", name: "UFSC", institutionName: "UFSC", institutionAcronym: "UFSC",
  sourceType: "federal_university", baseUrl: "https://propesq.ufsc.br/",
  allowedDomains: ["propesq.ufsc.br"], allowedPathPrefixes: ["/"],
  listingUrls: [], extractionMode: "html", audienceScope: ["mixed"],
  geographicScope: ["SC"], location: { stateCode: "SC", cityName: null },
  categories: [], priority: 1, active: true,
};

const candidate: OpportunityCandidate = {
  officialSourceId: "ufsc", title: "Bolsa", institution: "UFSC",
  sourcePageUrl: "https://propesq.ufsc.br/edital", applicantType: "undergraduate_student",
  applicationRoute: "direct_student_application", benefitType: "research_scholarship",
  deadlineAt: "2027-10-20T23:59:00-03:00", deadlinePrecision: "exact_datetime",
  requirementsText: "Consulte o edital", amountText: "Consulte o edital",
  stateCode: "SC", cityName: null,
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
    expect(item?.stateCode).toBe("SC");
    expect(item?.cityName).toBeNull();
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

  it("mantém prazo sem horário aberto até o fim do dia no Brasil", () => {
    const item = { ...candidate, deadlineAt: "2026-10-10", deadlinePrecision: "date_only" as const, humanVerifiedAt: "2026-10-01" };
    expect(isVisiblePublicOpportunity(item, new Date("2026-10-11T02:59:00Z"))).toBe(true);
    expect(isVisiblePublicOpportunity(item, new Date("2026-10-11T03:00:00Z"))).toBe(false);
  });

  it("fecha prazo com horário no instante indicado", () => {
    const item = { ...candidate, deadlineAt: "2026-10-10T18:00:00-03:00", humanVerifiedAt: "2026-10-01" };
    expect(isVisiblePublicOpportunity(item, new Date("2026-10-10T20:59:00Z"))).toBe(true);
    expect(isVisiblePublicOpportunity(item, new Date("2026-10-10T21:00:01Z"))).toBe(false);
  });

  it("descarta datas impossíveis antes de persistir candidatos extraídos", () => {
    expect(detectDeadline("Inscrições até 31/02/2026").precision).toBe("not_informed");
    expect(detectDeadline("Inscrições até 10/10/2026 às 25h00").precision).toBe("not_informed");
    expect(detectDeadline("Inscrições até 10/10/2026")).toEqual({
      deadlineAt: "2026-10-10", precision: "date_only",
    });
  });

  it("não confunde data de publicação com prazo de inscrição", () => {
    expect(detectDeadline("Publicado em 10/10/2026. Curso gratuito com seleção futura.").precision).toBe("not_informed");
    expect(detectDeadline("Inscrições de 10/10/2026 a 20/10/2026")).toEqual({ deadlineAt: "2026-10-20", precision: "date_only" });
  });

  it("identifica cursos de qualquer área para revisão", () => {
    const item = normalizeOpportunity({
      title: "Curso gratuito de soldagem",
      text: "Inscrições até 20/10/2026 pelo formulário de inscrição. Vagas para estudantes.",
      url: "https://propesq.ufsc.br/curso-soldagem", source,
    });
    expect(item).toMatchObject({ isCourse: true, reviewStatus: "pending_review", benefitType: "other" });
  });

  it("importação manual aceita somente data civil válida ou fluxo contínuo", () => {
    const header = "official_source_name,source_page_url,title,institution,applicant_type,application_route,deadline,last_verified_at";
    const row = (deadline: string) => `ufsc-propesq,https://propesq.ufsc.br/edital,Bolsa,UFSC,undergraduate_student,direct_student_application,${deadline},2026-10-01`;
    expect(() => parseManualCsv(`${header}\n${row("2026-02-31")}`)).toThrow(/prazo deve ser data/);
    expect(parseManualCsv(`${header}\n${row("2026-10-10")}`)[0].candidate.deadlinePrecision).toBe("date_only");
    expect(parseManualCsv(`${header}\n${row("fluxo contínuo")}`)[0].candidate.deadlinePrecision).toBe("continuous_flow");
  });
});
