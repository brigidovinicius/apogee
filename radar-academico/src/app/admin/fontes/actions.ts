"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import { withAdminTransaction } from "@/lib/db/client";
import { runOfficialSourceIngestion } from "@/lib/ingestion";
import { redirect } from "next/navigation";
import { sourceId, sourceDomains, sourceUrls, sourceSettings, sourceEvidenceUrl, sourceLocation, sourceType } from "@/lib/ingestion/source-settings";

function ingestionLimit(value: FormDataEntryValue | null, field: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 10) throw new Error(`${field} inválido`);
  return parsed;
}

export async function toggleSource(formData: FormData) {
  await requireAdmin();
  const id = sourceId(formData.get("id"));
  const rawActive = formData.get("active");
  if (rawActive !== "true" && rawActive !== "false") throw new Error("Configuração inválida");
  const active = rawActive === "true";
  await withAdminTransaction(async (client) => {
    if (!active) {
      await client.query("update official_sources set active=false, updated_at=now() where id=$1", [id]);
      return;
    }
    const updated = await client.query(
      "update official_sources set active=true, updated_at=now() where id=$1 and verification_status='verified' returning id",
      [id],
    );
    if (!updated.rows[0]) throw new Error("A fonte precisa ser auditada antes da ativação");
  });
  revalidatePath("/admin/fontes");
}

export async function runIngestion(formData: FormData) {
  await requireAdmin();
  const id = sourceId(formData.get("id"));
  const maxPages = ingestionLimit(formData.get("max_pages"), "Limite de páginas");
  const maxCandidates = ingestionLimit(formData.get("max_candidates"), "Limite de candidatos");
  await runOfficialSourceIngestion({ sourceId: id, maxPages, maxCandidates });
  revalidatePath("/admin/ingestoes");
  revalidatePath("/admin/revisao");
}

export async function createSource(formData: FormData) {
  await requireAdmin();
  const id = sourceId(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim();
  const institution = String(formData.get("institution") ?? "").trim();
  const domains = sourceDomains(formData.get("domains"));
  const listingUrls = sourceUrls(formData.get("listing_urls"), domains);
  const evidenceUrl = sourceEvidenceUrl(formData.get("audit_evidence_url"), domains);
  const location = sourceLocation(formData);
  const type = sourceType(formData.get("source_type"));
  if (!id || !name || name.length > 200 || !institution || institution.length > 200 || String(formData.get("acronym") ?? "").length > 40 || !domains.length || !listingUrls.length) throw new Error("Dados obrigatórios inválidos");
  await withAdminTransaction((client) => client.query(
    `insert into official_sources
     (id,name,institution_name,institution_acronym,source_type,base_url,allowed_domains,allowed_path_prefixes,listing_urls,extraction_mode,state_code,city_name,audit_evidence_url,priority,active,verification_status)
     values ($1,$2,$3,$4,$5,$6,$7,array['/'],$8,'manual_assisted',$9,$10,$11,10,false,'pending')`,
    [id, name, institution, String(formData.get("acronym") ?? ""), type, listingUrls[0], domains, listingUrls,
      location.stateCode, location.cityName, evidenceUrl],
  ));
  redirect("/admin/fontes");
}

export async function verifySource(formData: FormData) {
  await requireAdmin();
  const id = sourceId(formData.get("id"));
  if (formData.get("official_source") !== "confirmed" || formData.get("location_confirmed") !== "confirmed" || formData.get("collection_allowed") !== "confirmed") {
    throw new Error("Confirme os três itens de auditoria antes de verificar a fonte");
  }
  await withAdminTransaction(async (client) => {
    const updated = await client.query(
      `update official_sources set verification_status='verified', audited_at=now(), audited_by='admin',
       robots_checked_at=now(), terms_checked_at=now(), updated_at=now()
       where id=$1 and active=false and state_code is not null and audit_evidence_url is not null returning id`,
      [id],
    );
    if (!updated.rows[0]) throw new Error("Fonte sem evidência, localização ou elegibilidade para auditoria");
  });
  revalidatePath("/admin/fontes");
  revalidatePath(`/admin/fontes/${id}`);
}

export async function updateSourceSettings(formData: FormData) {
  await requireAdmin();
  const { id, domains, evidenceUrl, interval, mode } = sourceSettings(formData);
  await withAdminTransaction((client) => client.query(
    `update official_sources set allowed_domains=$1,crawl_interval_hours=$2,extraction_mode=$3,
     audit_evidence_url=$4,active=false,verification_status='pending',audited_at=null,audited_by=null,robots_checked_at=null,terms_checked_at=null,updated_at=now() where id=$5`,
    [domains, interval, mode, evidenceUrl, id],
  ));
  revalidatePath(`/admin/fontes/${id}`);
}
