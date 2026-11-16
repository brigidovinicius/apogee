import { z } from "zod";
import { identifier } from "@/lib/deliverables/validation";
const clean = (max: number) => z.string().trim().max(max).refine(v => !/[\u0000-\u001f]/.test(v), "Texto inválido.");
export const benefitFilters = z.strictObject({ query: clean(100).default(""), category: z.string().regex(/^(?:[a-z0-9]+(?:-[a-z0-9]+)*)?$/).max(80).default("") });
export const savedBenefitInput = z.strictObject({ benefitId: identifier, saved: z.boolean() });
export const startBenefitInput = z.strictObject({ benefitId: identifier });
export const categoryInput = z.strictObject({ id: identifier.optional(), version: z.coerce.number().int().positive().optional(), name: clean(80).min(1), description: clean(240).default(""), status: z.enum(["draft", "published", "archived"]), sortOrder: z.coerce.number().int().min(0).max(10000) });
export const reviewRedemptionInput = z.strictObject({ id: identifier, revision: z.string().regex(/^[a-f0-9]{32}$/), status: z.enum(["confirmed", "rejected"]), evidenceReference: clean(500).min(8, "Informe uma referência privada da conferência.") });
export function benefitCategorySlug(name: string) { return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80).replace(/-$/, ""); }
