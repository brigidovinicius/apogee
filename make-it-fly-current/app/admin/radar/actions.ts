"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/access";
import { mutateRadarEditorialSource } from "@/lib/opportunities/radar-editorial-client";

const SOURCE_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,79}$/;

function sourceId(formData: FormData) {
  const id = String(formData.get("source_id") ?? "");
  if (!SOURCE_ID_PATTERN.test(id)) redirect("/admin/radar?resultado=erro");
  return id;
}

function limit(formData: FormData, field: string) {
  const value = Number(formData.get(field));
  if (!Number.isInteger(value) || value < 1 || value > 10) redirect("/admin/radar?resultado=erro");
  return value;
}

async function complete(mutation: Parameters<typeof mutateRadarEditorialSource>[0], result: string) {
  if (!(await mutateRadarEditorialSource(mutation))) redirect("/admin/radar?resultado=erro");
  revalidatePath("/admin/radar");
  redirect(`/admin/radar?resultado=${result}`);
}

export async function verifyRadarSource(formData: FormData) {
  await requireAdmin("/admin/radar");
  const id = sourceId(formData);
  if (formData.get("official_source") !== "confirmed" || formData.get("location_confirmed") !== "confirmed" ||
    formData.get("collection_allowed") !== "confirmed") redirect("/admin/radar?resultado=confirmacao");
  await complete({
    action: "verify", sourceId: id, officialSource: true, locationConfirmed: true, collectionAllowed: true,
  }, "verificada");
}

export async function setRadarSourceActive(formData: FormData) {
  await requireAdmin("/admin/radar");
  const id = sourceId(formData);
  const active = formData.get("active") === "true";
  if (formData.get("active") !== "true" && formData.get("active") !== "false") redirect("/admin/radar?resultado=erro");
  await complete({ action: "set-active", sourceId: id, active }, active ? "ativada" : "desativada");
}

export async function ingestRadarSource(formData: FormData) {
  await requireAdmin("/admin/radar");
  const id = sourceId(formData);
  await complete({
    action: "ingest", sourceId: id,
    maxPages: limit(formData, "max_pages"), maxCandidates: limit(formData, "max_candidates"),
  }, "coleta-iniciada");
}
