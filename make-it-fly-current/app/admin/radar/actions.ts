"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/access";
import { mutateRadarCatalogue, importRadarReviewCsv, mutateRadarEditorialSource } from "@/lib/opportunities/radar-editorial-client";

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

export type CatalogueFormState = { error: string };
export async function saveRadarOpportunity(_state: CatalogueFormState, formData: FormData): Promise<CatalogueFormState> {
  const admin = await requireAdmin("/admin/radar");
  const id = String(formData.get("id") ?? "");
  const fields = ["title", "institution", "officialSourceId", "officialUrl", "benefitType", "applicantType", "applicationRoute", "opportunityStatus", "deadlineAt", "deadlinePrecision", "stateCode", "cityName", "requirementsText", "amountText", "evidenceExcerpt"];
  const input: Record<string, unknown> = Object.fromEntries(fields.map((field) => [field, String(formData.get(field) ?? "")]));
  input.isCourse = formData.get("isCourse") === "on";
  input.categories = formData.getAll("categories").map(String);
  input.nationallyEligible = formData.get("nationallyEligible") === "on";
  const result = await mutateRadarCatalogue(id ? "PATCH" : "POST", { ...input, id, version: Number(formData.get("version")), actor: `apogee:${admin.id}` });
  if (!result.ok) return { error: result.error };
  for (const path of ["/admin/radar", "/admin/curadoria", "/membros/oportunidades", "/oportunidades"]) revalidatePath(path);
  redirect("/admin/radar?resultado=salva");
}
export async function deleteRadarOpportunity(_state: CatalogueFormState, formData: FormData): Promise<CatalogueFormState> {
  const admin = await requireAdmin("/admin/radar");
  if (formData.get("confirmDelete") !== "on") return { error: "Marque a confirmação de exclusão." };
  const result = await mutateRadarCatalogue("DELETE", { id: String(formData.get("id") ?? ""), version: Number(formData.get("version")), actor: `apogee:${admin.id}` });
  if (!result.ok) return { error: result.error };
  for (const path of ["/admin/radar", "/admin/curadoria", "/membros/oportunidades", "/oportunidades"]) revalidatePath(path);
  redirect("/admin/radar?resultado=excluida");
}

export async function importRadarCsv(formData: FormData) {
  await requireAdmin("/admin/radar");
  const csv = formData.get("csv");
  if (typeof csv !== "string" || csv.length < 20 || csv.length > 20_000) {
    redirect("/admin/radar?resultado=erro-importacao");
  }
  if (!(await importRadarReviewCsv(csv))) redirect("/admin/radar?resultado=erro-importacao");
  revalidatePath("/admin/radar");
  redirect("/admin/radar?resultado=importada");
}
