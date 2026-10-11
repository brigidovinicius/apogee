"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/access";
import { decideRadarReviewOpportunity, importRadarReviewCsv, mutateRadarEditorialSource } from "@/lib/opportunities/radar-editorial-client";

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

export async function decideRadarOpportunity(formData: FormData) {
  const admin = await requireAdmin("/admin/radar");
  const id = String(formData.get("id") ?? "");
  const decision = formData.get("decision");
  if (!/^[0-9a-f-]{36}$/i.test(id) || (decision !== "approve" && decision !== "reject")) {
    redirect("/admin/radar?resultado=erro-revisao");
  }
  const ok = await decideRadarReviewOpportunity({ id, decision, reviewer: `apogee:${admin.id}` });
  if (!ok) redirect("/admin/radar?resultado=erro-revisao");
  revalidatePath("/admin/radar");
  revalidatePath("/membros/oportunidades");
  revalidatePath("/oportunidades");
  redirect(`/admin/radar?resultado=${decision === "approve" ? "publicada" : "rejeitada"}`);
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
