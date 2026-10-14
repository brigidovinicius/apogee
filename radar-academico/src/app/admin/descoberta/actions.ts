"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import { withAdminTransaction } from "@/lib/db/client";
import { candidateUrl } from "@/lib/discovery/daily-discovery";

const slug = /^[a-z0-9][a-z0-9-]{0,79}$/;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function field(form: FormData, key: string, max: number) {
  const value = String(form.get(key) ?? "").trim();
  if (!value || value.length > max) throw new Error(`Campo ${key} inválido`);
  return value;
}

function dateField(form: FormData, key: string) {
  const value = String(form.get(key) ?? "").trim();
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) !== value) {
    throw new Error("Data inválida");
  }
  return value;
}

export async function createDiscoveryTarget(form: FormData) {
  await requireAdmin();
  const id = field(form, "id", 80);
  const name = field(form, "name", 200);
  const organizer = field(form, "organizer", 200);
  const kind = field(form, "kind", 20);
  const rawUrl = field(form, "official_url", 2048);
  const officialUrl = candidateUrl(rawUrl);
  const evidenceUrl = candidateUrl(field(form, "evidence_url", 2048));
  const topics = [...new Set(String(form.get("topics") ?? "").split(",").map((value) => value.trim()).filter(Boolean))];
  if (!slug.test(id) || !["site", "program", "event_series"].includes(kind) || !officialUrl || !evidenceUrl ||
    topics.length > 10 || topics.some((value) => value.length > 60)) throw new Error("Fonte de descoberta inválida");
  await withAdminTransaction((client) => client.query(
    `insert into discovery_targets(id,name,organizer,kind,official_url,topics,evidence_url,enabled)
     values($1,$2,$3,$4,$5,$6,$7,false)`,
    [id, name, organizer, kind, officialUrl, topics, evidenceUrl],
  ));
  revalidatePath("/admin/descoberta");
}

export async function toggleDiscoveryTarget(form: FormData) {
  await requireAdmin();
  const id = field(form, "id", 80);
  const enabled = field(form, "enabled", 5);
  if (!slug.test(id) || !["true", "false"].includes(enabled)) throw new Error("Fonte inválida");
  await withAdminTransaction((client) => client.query(
    "update discovery_targets set enabled=$2,next_check_at=null,updated_at=now() where id=$1",
    [id, enabled === "true"],
  ));
  revalidatePath("/admin/descoberta");
}

export async function addAnnualEventEdition(form: FormData) {
  await requireAdmin();
  const targetId = field(form, "target_id", 80);
  const year = Number(field(form, "edition_year", 4));
  const name = field(form, "edition_name", 200);
  const start = dateField(form, "starts_on");
  const end = dateField(form, "ends_on");
  const status = field(form, "status", 20);
  const evidenceUrl = candidateUrl(field(form, "evidence_url", 2048));
  const location = String(form.get("location_text") ?? "").trim();
  if (!slug.test(targetId) || !Number.isInteger(year) || year < 2020 || year > 2100 ||
    !["announced", "past", "cancelled", "unconfirmed"].includes(status) || !evidenceUrl ||
    location.length > 200 || (start && end && end < start) || status === "announced" && (!start || !end)) {
    throw new Error("Edição anual inválida");
  }
  const id = `${targetId}-${year}-${name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60)}`;
  await withAdminTransaction(async (client) => {
    const target = await client.query("select id from discovery_targets where id=$1 and kind='event_series'", [targetId]);
    if (!target.rows[0]) throw new Error("Série anual não encontrada");
    await client.query(
      `insert into annual_event_editions(id,target_id,edition_year,edition_name,starts_on,ends_on,location_text,status,evidence_url,checked_at)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9,now())`,
      [id, targetId, year, name, start, end, location || null, status, evidenceUrl],
    );
  });
  revalidatePath("/admin/descoberta");
}

export async function reviewDiscoveryLead(form: FormData) {
  await requireAdmin();
  const id = field(form, "id", 36);
  const status = field(form, "status", 10);
  if (!uuid.test(id) || !["reviewing", "dismissed"].includes(status)) throw new Error("Candidato inválido");
  await withAdminTransaction((client) => client.query(
    "update discovery_leads set status=$2,reviewed_at=now() where id=$1 and status in ('new','reviewing')",
    [id, status],
  ));
  revalidatePath("/admin/descoberta");
}
