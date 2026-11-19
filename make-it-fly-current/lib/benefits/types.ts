import type { Benefit } from "@/lib/deliverables/store";
export const BENEFIT_AUDIENCES = {
  geral: "Público geral",
  estudantes: "Estudantes",
  startups: "Startups",
  "organizacoes-sem-fins-lucrativos": "Organizações sem fins lucrativos",
} as const;
export const BENEFIT_AUDIENCE_VALUES = ["geral", "estudantes", "startups", "organizacoes-sem-fins-lucrativos"] as const;
export type BenefitAudience = typeof BENEFIT_AUDIENCE_VALUES[number];
export type BenefitMonitor = { benefit_id: string; outcome: string | null; reason: string | null; checked_at: string | null; available: boolean };
export type BenefitView = "catalogue" | "saved" | "history";
export type BenefitCategory = { id: string; slug: string; name: string; description: string; status: string; sort_order: number; version: number; count?: number };
export type BenefitOrganization = { benefit_id: string; category_id: string | null; provider_label: string; provider_access: string; source_url: string };
export type CatalogueBenefit = Benefit & { audience: BenefitAudience; last_success_at: Date; category_name: string | null; category_slug: string | null; provider_label: string; provider_access: string; saved: boolean };
export type BenefitRedemption = { id: string; benefit_id: string; benefit_name: string; partner_name: string; status: "started" | "confirmed" | "rejected"; started_at: Date; reviewed_at: Date | null; available: boolean };
export type AdminRedemption = BenefitRedemption & { user_id: string; evidence_reference: string; revision: string };
export const BENEFIT_PATHS: Record<BenefitView, string> = { catalogue: "/membros/beneficios", saved: "/membros/beneficios/salvos", history: "/membros/beneficios/resgates" };
export const PROVIDER_ACCESS_LABELS: Record<string, string> = { unconfirmed: "Condições do fornecedor a conferir", free: "Acesso à oferta sem assinatura do fornecedor", premium: "Exige acesso Premium no fornecedor", included: "Acesso à oferta incluído no acordo" };
export const REDEMPTION_LABELS = { started: "Iniciado", confirmed: "Confirmado", rejected: "Não aprovado" };
