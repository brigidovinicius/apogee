"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import { withAdminTransaction } from "@/lib/db/client";
import { runOfficialSourceIngestion } from "@/lib/ingestion";
import { redirect } from "next/navigation";
import { sourceId, sourceDomains, sourceUrls, sourceSettings } from "@/lib/ingestion/source-settings";

export async function toggleSource(formData: FormData) {
  await requireAdmin();
  const id = sourceId(formData.get("id"));
  const rawActive = formData.get("active");
  if (rawActive !== "true" && rawActive !== "false") throw new Error("Configuração inválida");
  const active = rawActive === "true";
  await withAdminTransaction((client) => client.query("update official_sources set active=$1, updated_at=now() where id=$2", [active, id]));
  revalidatePath("/admin/fontes");
}

export async function runIngestion() {
  await requireAdmin();
  await runOfficialSourceIngestion();
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
  if (!id || !name || name.length > 200 || !institution || institution.length > 200 || String(formData.get("acronym") ?? "").length > 40 || !domains.length || !listingUrls.length) throw new Error("Dados obrigatórios inválidos");
  await withAdminTransaction((client) => client.query(
    `insert into official_sources
     (id,name,institution_name,institution_acronym,source_type,base_url,allowed_domains,allowed_path_prefixes,listing_urls,extraction_mode,priority,active,verification_status)
     values ($1,$2,$3,$4,'federal_university',$5,$6,array['/'],$7,'manual_assisted',10,false,'pending')`,
    [id, name, institution, String(formData.get("acronym") ?? ""), listingUrls[0], domains, listingUrls],
  ));
  redirect("/admin/fontes");
}

export async function updateSourceSettings(formData: FormData) {
  await requireAdmin();
  const { id, domains, interval, mode } = sourceSettings(formData);
  await withAdminTransaction((client) => client.query(
    "update official_sources set allowed_domains=$1,crawl_interval_hours=$2,extraction_mode=$3,updated_at=now() where id=$4",
    [domains, interval, mode, id],
  ));
  revalidatePath(`/admin/fontes/${id}`);
}