"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import { withAdminTransaction } from "@/lib/db/client";
import { runOfficialSourceIngestion } from "@/lib/ingestion";
import { redirect } from "next/navigation";
import { isIP } from "node:net";

function domainsFrom(value: FormDataEntryValue | null) {
  return String(value ?? "").split(/[\s,]+/).map((item) => item.trim().toLowerCase()).filter(Boolean).filter((host) => isIP(host) === 0 && !host.includes("/") && host !== "localhost");
}

function urlsFrom(value: FormDataEntryValue | null) {
  return String(value ?? "").split(/\s+/).filter(Boolean).filter((item) => {
    try { return new URL(item).protocol === "https:"; } catch { return false; }
  });
}

export async function toggleSource(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const active = String(formData.get("active")) === "true";
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
  const id = String(formData.get("id") ?? "").toLowerCase().replace(/[^a-z0-9-]/g, "");
  const name = String(formData.get("name") ?? "").trim();
  const institution = String(formData.get("institution") ?? "").trim();
  const domains = domainsFrom(formData.get("domains"));
  const listingUrls = urlsFrom(formData.get("listing_urls"));
  if (!id || !name || !institution || !domains.length || !listingUrls.length) throw new Error("Dados obrigatórios inválidos");
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
  const id = String(formData.get("id") ?? "");
  const domains = domainsFrom(formData.get("domains"));
  const interval = Math.max(2, Number(formData.get("interval") ?? 24));
  const mode = String(formData.get("mode") ?? "manual_assisted");
  if (!domains.length) throw new Error("Ao menos um domínio autorizado é obrigatório");
  await withAdminTransaction((client) => client.query(
    "update official_sources set allowed_domains=$1,crawl_interval_hours=$2,extraction_mode=$3,updated_at=now() where id=$4",
    [domains, interval, mode, id],
  ));
  revalidatePath(`/admin/fontes/${id}`);
}