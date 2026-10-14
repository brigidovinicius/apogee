"use server";
import { requireAdmin } from "@/lib/auth/admin";
export async function reviewOpportunity(_formData: FormData) {
  await requireAdmin(); void _formData;
  throw new Error("Use o gerenciamento do catálogo na Apogee");
}
export async function reviewRevision(_formData: FormData) {
  await requireAdmin(); void _formData;
  throw new Error("Retificações agora passam por validação automática");
}
