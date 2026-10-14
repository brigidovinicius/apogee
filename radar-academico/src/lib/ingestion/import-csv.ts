import crypto from "node:crypto";
import { officialSourceRegistry } from "./official-source-registry";
import { canStoreExternalApplicationUrl, isOfficialSourceUrl } from "./validate-url";
import type { ApplicantType, ApplicationRoute, OpportunityCandidate } from "./types";
import { normalizeBrazilianLocation } from "@/lib/location";

function parseLine(line: string) {
  const values: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && line[index + 1] === '"') { current += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { values.push(current.trim()); current = ""; }
    else current += char;
  }
  values.push(current.trim());
  return values;
}

const applicants = new Set(["undergraduate_student","postgraduate_student","high_school_student","graduate_professional","professor","researcher","company","institution","mixed"]);
const routes = new Set(["direct_student_application","direct_application","application_via_university","application_via_department","application_via_professor","application_via_project_coordinator","institutional_call","invitation_only","unclear"]);

function validDateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function parseManualCsv(csv: string) {
  const lines = csv.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  const headers = parseLine(lines.shift() ?? "");
  const required = ["official_source_name","source_page_url","title","institution","applicant_type","application_route","deadline","last_verified_at"];
  if (required.some((field) => !headers.includes(field))) throw new Error("CSV sem colunas obrigatórias");

  return lines.map((line, rowIndex) => {
    const values = parseLine(line);
    const row = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
    const source = officialSourceRegistry.find((item) => item.id === row.official_source_name || item.name === row.official_source_name);
    if (!source) throw new Error(`Linha ${rowIndex + 2}: fonte não cadastrada`);
    if (!row.title || !row.institution || row.title.length > 250 || row.institution.length > 200) {
      throw new Error(`Linha ${rowIndex + 2}: título ou instituição inválidos`);
    }
    if (!isOfficialSourceUrl(row.source_page_url, [source])) throw new Error(`Linha ${rowIndex + 2}: página não oficial`);
    if (row.official_document_url && !isOfficialSourceUrl(row.official_document_url, [source])) throw new Error(`Linha ${rowIndex + 2}: documento não oficial`);
    if (row.application_url && !canStoreExternalApplicationUrl({ applicationUrl: row.application_url, primaryOfficialUrl: row.source_page_url, source })) throw new Error(`Linha ${rowIndex + 2}: candidatura externa sem vínculo oficial`);
    if (!applicants.has(row.applicant_type) || !routes.has(row.application_route)) throw new Error(`Linha ${rowIndex + 2}: classificação inválida`);
    if (row.opportunity_kind && row.opportunity_kind !== "course") throw new Error(`Linha ${rowIndex + 2}: tipo inválido`);
    if (row.nationally_eligible && row.nationally_eligible !== "true") throw new Error(`Linha ${rowIndex + 2}: abrangência inválida`);
    const nationallyEligible = row.nationally_eligible === "true";
    if (nationallyEligible && !source.geographicScope.includes("Brasil")) throw new Error(`Linha ${rowIndex + 2}: fonte sem abrangência nacional`);
    const verifiedAt = Date.parse(row.last_verified_at);
    if (!row.deadline || !Number.isFinite(verifiedAt) || verifiedAt > Date.now()) {
      throw new Error(`Linha ${rowIndex + 2}: prazo ou verificação inválidos`);
    }
    if ((row.opportunity_kind === "course" || nationallyEligible) && !row.evidence_excerpt?.trim()) {
      throw new Error(`Linha ${rowIndex + 2}: evidência textual obrigatória`);
    }
    if (row.evidence_excerpt && row.evidence_excerpt.length > 1000) {
      throw new Error(`Linha ${rowIndex + 2}: evidência textual extensa demais`);
    }
    const continuous = /^fluxo contínuo$/i.test(row.deadline);
    if (!continuous && !validDateOnly(row.deadline)) throw new Error(`Linha ${rowIndex + 2}: prazo deve ser data YYYY-MM-DD ou fluxo contínuo`);
    const location = normalizeBrazilianLocation({
      stateCode: row.state_code || source.location?.stateCode,
      cityName: row.city_name || source.location?.cityName,
    });
    if (location.status === "invalid") throw new Error(`Linha ${rowIndex + 2}: localização estruturada inválida`);
    if (nationallyEligible && location.location.stateCode) throw new Error(`Linha ${rowIndex + 2}: abrangência nacional não admite UF`);

    const candidate: OpportunityCandidate = {
      officialSourceId: source.id, title: row.title, institution: row.institution,
      sourcePageUrl: row.source_page_url, officialDocumentUrl: row.official_document_url || undefined,
      applicationUrl: row.application_url || undefined, applicantType: row.applicant_type as ApplicantType,
      applicationRoute: row.application_route as ApplicationRoute, benefitType: "other",
      isCourse: row.opportunity_kind === "course", nationallyEligible,
      deadlineAt: continuous ? undefined : row.deadline, deadlinePrecision: continuous ? "continuous_flow" : "date_only",
      requirementsText: "Não informado na fonte oficial. Consulte o edital.",
      amountText: "Não informado na fonte oficial. Consulte o edital.",
      stateCode: location.location.stateCode, cityName: location.location.cityName,
      reviewStatus: "needs_information", opportunityStatus: "unknown", extractionMethod: "manual_assisted",
      evidenceJson: {
        deadline_at: { source_url: row.source_page_url, excerpt: row.deadline },
        ...(row.evidence_excerpt ? { requirements: { source_url: row.source_page_url, excerpt: row.evidence_excerpt } } : {}),
      },
      contentHash: crypto.createHash("sha256").update(JSON.stringify(row)).digest("hex"),
    };
    return { source, candidate };
  });
}
