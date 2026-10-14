import crypto from "node:crypto";
import { withAdminTransaction } from "@/lib/db/client";
import { loadOfficialSource } from "@/lib/ingestion/official-source-registry";
import { candidateColumns, findCandidate, lockSource, persistCandidate, type CandidateField, type StoredOpportunity } from "@/lib/ingestion/persist-candidate";
import { publicationIssue } from "@/lib/ingestion/publication";
import { normalizeBrazilianLocation } from "@/lib/location";
import type { OpportunityCandidate } from "@/lib/ingestion/types";
import { validCategories } from "@/lib/ingestion/categories";

export class CatalogueError extends Error { constructor(message: string, public status = 400) { super(message); } }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const applicants = ["undergraduate_student","postgraduate_student","high_school_student","graduate_professional","professor","researcher","company","institution","mixed"];
const routes = ["direct_student_application","direct_application","application_via_university","application_via_department","application_via_professor","application_via_project_coordinator","institutional_call","invitation_only"];
const benefits = ["academic_scholarship","research_scholarship","extension_scholarship","monitor_scholarship","internship","financial_aid","housing_aid","mobility_aid","prize","project_funding","unpaid_opportunity","other"];
function text(input: Record<string, unknown>, key: string, max = 500) {
  const value = input[key];
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new CatalogueError(`Campo inválido: ${key}`);
  return value.trim();
}
function choice(input: Record<string, unknown>, key: string, allowed: string[]) {
  const value = text(input, key);
  if (!allowed.includes(value)) throw new CatalogueError(`Campo inválido: ${key}`);
  return value;
}
export function parseCatalogueCandidate(input: Record<string, unknown>): OpportunityCandidate {
  const location = normalizeBrazilianLocation({ stateCode: input.stateCode || null, cityName: input.cityName || null });
  if (location.status === "invalid") throw new CatalogueError("Localização inválida");
  if (typeof input.isCourse !== "boolean" || typeof input.nationallyEligible !== "boolean") throw new CatalogueError("Classificação inválida");
  if (!validCategories(input.categories)) throw new CatalogueError("Selecione ao menos uma categoria válida, sem repetições");
  const sourcePageUrl = text(input, "officialUrl", 2000);
  const excerpt = text(input, "evidenceExcerpt", 4000);
  const evidence = { source_url: sourcePageUrl, excerpt };
  const candidate: OpportunityCandidate = {
    officialSourceId: text(input, "officialSourceId", 80), title: text(input, "title"), institution: text(input, "institution"), sourcePageUrl,
    applicantType: choice(input, "applicantType", applicants) as OpportunityCandidate["applicantType"],
    applicationRoute: choice(input, "applicationRoute", routes) as OpportunityCandidate["applicationRoute"],
    benefitType: choice(input, "benefitType", benefits) as OpportunityCandidate["benefitType"],
    categories: input.categories,
    opportunityStatus: choice(input, "opportunityStatus", ["open", "upcoming"]) as OpportunityCandidate["opportunityStatus"],
    deadlinePrecision: choice(input, "deadlinePrecision", ["date_only", "exact_datetime", "continuous_flow"]) as OpportunityCandidate["deadlinePrecision"],
    deadlineAt: input.deadlineAt === null || input.deadlineAt === "" ? undefined : text(input, "deadlineAt", 50),
    requirementsText: typeof input.requirementsText === "string" && !input.requirementsText.trim() ? "Não informado na fonte oficial." : text(input, "requirementsText", 6000),
    amountText: typeof input.amountText === "string" && !input.amountText.trim() ? "Não informado na fonte oficial." : text(input, "amountText", 2000),
    stateCode: location.location.stateCode, cityName: location.location.cityName,
    isCourse: input.isCourse, nationallyEligible: input.nationallyEligible,
    reviewStatus: "approved", extractionMethod: "manual_assisted",
    evidenceJson: { deadline_at: evidence, opportunity_status: evidence, requirements: evidence, ...(input.nationallyEligible ? { national_scope: evidence } : {}) },
    contentHash: "",
  };
  if (candidate.deadlinePrecision === "date_only" && !/^\d{4}-\d{2}-\d{2}$/.test(candidate.deadlineAt ?? "")) throw new CatalogueError("Informe a data no formato AAAA-MM-DD");
  if (candidate.deadlinePrecision === "exact_datetime" && !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(candidate.deadlineAt ?? "")) throw new CatalogueError("Horário precisa incluir fuso");
  candidate.contentHash = crypto.createHash("sha256").update(JSON.stringify(candidate)).digest("hex");
  return candidate;
}

export async function manageCatalogue(method: "POST" | "PATCH" | "DELETE", input: Record<string, unknown>) {
  const actor = text(input, "actor", 128);
  if (!/^[a-zA-Z0-9:_-]+$/.test(actor)) throw new CatalogueError("Autor inválido");
  if (method !== "POST" && (typeof input.id !== "string" || !uuid.test(input.id) || !Number.isInteger(input.version) || Number(input.version) < 1)) throw new CatalogueError("Identificador ou versão inválida");
  const candidate = method === "DELETE" ? null : parseCatalogueCandidate(input);
  const source = candidate ? await loadOfficialSource(candidate.officialSourceId) : null;
  if (candidate && (!source || publicationIssue(candidate, source))) throw new CatalogueError("Confira fonte ativa, evidência, localização, estado e prazo vigente");
  return withAdminTransaction(async (client) => {
    let existing: StoredOpportunity | undefined;
    if (method !== "POST") {
      // Match the ingestion lock order: source first, row second.
      const ref = await client.query<{ official_source_id: string }>("select official_source_id from opportunities where id=$1", [input.id]);
      if (!ref.rows[0]) throw new CatalogueError("Oportunidade não encontrada", 404);
      await client.query("select pg_advisory_xact_lock(hashtextextended($1,0))", [ref.rows[0].official_source_id]);
      existing = (await client.query<StoredOpportunity>("select * from opportunities where id=$1 for update", [input.id])).rows[0];
      if (!existing || existing.deleted_at) throw new CatalogueError("Oportunidade não encontrada", 404);
      if (existing.version !== input.version) throw new CatalogueError("A ficha mudou. Recarregue antes de salvar", 409);
    }
    if (method === "DELETE" && existing) {
      await client.query("update opportunities set deleted_at=now(),published_at=null,version=version+1,updated_at=now() where id=$1", [existing.id]);
      await client.query("insert into opportunity_management_events (opportunity_id,actor,action,previous_data) values ($1,$2,'delete',$3)", [existing.id, actor, existing]);
      return { id: existing.id };
    }
    if (!candidate || !source) throw new CatalogueError("Fonte inválida");
    if (existing && existing.official_source_id !== source.id) throw new CatalogueError("A fonte da ficha não pode ser trocada");
    await lockSource(client, source);
    if (!existing && await findCandidate(client, candidate)) throw new CatalogueError("Essa ficha já existe, inclusive no histórico de exclusões", 409);
    const overrides: Partial<OpportunityCandidate> = { ...existing?.management_overrides };
    for (const [field, column] of Object.entries(candidateColumns)) {
      const value = candidate[field as CandidateField] ?? null;
      let prior = existing?.[column] ?? null;
      if (prior instanceof Date) prior = candidate.deadlinePrecision === "date_only" ? prior.toISOString().slice(0,10) : prior.toISOString();
      const same = field === "categories" ? JSON.stringify(value) === JSON.stringify(prior) :
        field === "deadlineAt" && value && prior ? Date.parse(String(value)) === Date.parse(String(prior)) : value === prior;
      if (!same) Object.assign(overrides, { [field]: value });
    }
    // An edited title keeps its original ingestion identity. URL changes are explicit overrides too.
    const link = existing ? (await client.query("select source_page_url from opportunity_sources where opportunity_id=$1 and is_primary limit 1", [existing.id])).rows[0] : null;
    if (!existing || link?.source_page_url !== candidate.sourcePageUrl) overrides.sourcePageUrl = candidate.sourcePageUrl;
    return persistCandidate(client, source, candidate, { mode: "admin", actor, existing, overrides });
  });
}
