import { withAdminTransaction } from "@/lib/db/client";
import { runOfficialSourceIngestion } from "@/lib/ingestion";

const SOURCE_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,79}$/;

export class EditorialInputError extends Error {}
export class EditorialStateError extends Error {}

export type EditorialSource = {
  id: string;
  name: string;
  institutionName: string;
  institutionAcronym: string;
  stateCode: string | null;
  cityName: string | null;
  geographicScope: string[];
  auditEvidenceUrl: string | null;
  allowedDomains: string[];
  listingUrls: string[];
  extractionMode: string;
  verificationStatus: "pending" | "verified" | "rejected";
  active: boolean;
  auditedAt: string | null;
};

type EditorialSourceRow = {
  id: string;
  name: string;
  institution_name: string;
  institution_acronym: string;
  state_code: string | null;
  city_name: string | null;
  geographic_scope: string[];
  audit_evidence_url: string | null;
  allowed_domains: string[];
  listing_urls: string[];
  extraction_mode: string;
  verification_status: "pending" | "verified" | "rejected";
  active: boolean;
  audited_at: string | null;
};

function editorialSourceId(value: unknown) {
  const id = typeof value === "string" ? value : "";
  if (!SOURCE_ID_PATTERN.test(id)) throw new EditorialInputError("Fonte inválida");
  return id;
}

function ingestionLimit(value: unknown, label: string) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 10) {
    throw new EditorialInputError(`${label} inválido`);
  }
  return parsed;
}

function mapSource(row: EditorialSourceRow): EditorialSource {
  return {
    id: row.id,
    name: row.name,
    institutionName: row.institution_name,
    institutionAcronym: row.institution_acronym,
    stateCode: row.state_code,
    cityName: row.city_name,
    geographicScope: row.geographic_scope,
    auditEvidenceUrl: row.audit_evidence_url,
    allowedDomains: row.allowed_domains,
    listingUrls: row.listing_urls,
    extractionMode: row.extraction_mode,
    verificationStatus: row.verification_status,
    active: row.active,
    auditedAt: row.audited_at,
  };
}

export async function listEditorialSources(): Promise<EditorialSource[]> {
  return withAdminTransaction(async (client) => {
    const result = await client.query<EditorialSourceRow>(
      `select id,name,institution_name,institution_acronym,state_code,city_name,geographic_scope,
        audit_evidence_url,allowed_domains,listing_urls,extraction_mode,
        verification_status,active,audited_at
       from official_sources
       order by state_code nulls last, city_name nulls last, priority desc, name`,
    );
    return result.rows.map(mapSource);
  });
}

export async function setEditorialSourceActive(input: { sourceId: unknown; active: unknown }) {
  const id = editorialSourceId(input.sourceId);
  if (typeof input.active !== "boolean") throw new EditorialInputError("Configuração inválida");

  await withAdminTransaction(async (client) => {
    const result = input.active
      ? await client.query(
        `update official_sources set active=true, updated_at=now()
         where id=$1 and verification_status='verified' returning id`,
        [id],
      )
      : await client.query(
        "update official_sources set active=false, updated_at=now() where id=$1 returning id",
        [id],
      );
    if (!result.rows[0]) {
      throw new EditorialStateError(
        input.active ? "A fonte precisa ser auditada antes da ativação" : "Fonte não encontrada",
      );
    }
  });
}

export async function verifyEditorialSource(input: {
  sourceId: unknown;
  officialSource: unknown;
  locationConfirmed: unknown;
  collectionAllowed: unknown;
}) {
  const id = editorialSourceId(input.sourceId);
  if (input.officialSource !== true || input.locationConfirmed !== true || input.collectionAllowed !== true) {
    throw new EditorialInputError("Confirme os três itens de auditoria antes de verificar a fonte");
  }

  await withAdminTransaction(async (client) => {
    const updated = await client.query(
      `update official_sources set verification_status='verified', audited_at=now(), audited_by='admin',
       robots_checked_at=now(), terms_checked_at=now(), updated_at=now()
       where id=$1 and active=false and verification_status='pending'
         and audit_evidence_url is not null
         and (state_code is not null or (city_name is null and geographic_scope @> array['Brasil']::text[]))
       returning id`,
      [id],
    );
    if (!updated.rows[0]) {
      throw new EditorialStateError("Fonte sem evidência, localização ou elegibilidade para auditoria");
    }
  });
}

export async function runEditorialSourceIngestion(input: {
  sourceId: unknown;
  maxPages: unknown;
  maxCandidates: unknown;
}) {
  const sourceId = editorialSourceId(input.sourceId);
  const maxPages = ingestionLimit(input.maxPages, "Limite de páginas");
  const maxCandidates = ingestionLimit(input.maxCandidates, "Limite de candidatos");
  const report = await runOfficialSourceIngestion({ sourceId, maxPages, maxCandidates });

  return {
    pagesChecked: report.pagesChecked,
    discovered: report.discovered,
    published: report.published, blocked: report.blocked,
  };
}
