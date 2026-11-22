import { z } from "zod";
import benefitOffers from "@/content/benefit-offers.json";
import { BENEFIT_AUDIENCE_VALUES } from "@/lib/benefits/types";

const text = (max: number) => z.string().trim().min(1, "Preencha os campos obrigatórios.").max(max).refine(v => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v), "Texto inválido.");
export const identifier = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/, "Identificador inválido.");

// Curated browser links only. No fetch/embedding, credentials, fragments or query
// parameters that could carry tokens, contacts or an Apogee session.
export const officialUrl = z.string().trim().max(1000).refine(value => {
  if (!value) return true;
  try {
    const u = new URL(value), host = u.hostname.toLowerCase();
    return u.protocol === "https:" && !u.username && !u.password && !u.port && !u.search && !u.hash &&
      host.length <= 253 && host.includes(".") && host.split(".").every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label)) && !host.endsWith(".local") && !host.endsWith(".localhost") && !host.endsWith(".test") &&
      !host.endsWith(".internal") && !host.endsWith(".invalid") && !host.includes(":") &&
      !/^\d[\d.]*$/.test(host) && !/[\\\s\u0000-\u001f]/.test(value);
  } catch { return false; }
}, "Use uma URL HTTPS oficial, pública, sem credenciais, parâmetros ou fragmentos.");

// Only the reviewed fragments of GitHub Education's public catalogue point
// members at specific campaigns. Keep other editorial links on the base rule.
const educationCampaignUrls = new Set(benefitOffers.flatMap(offer => [offer.source, offer.redeem])
  .filter(url => /^https:\/\/education\.github\.com\/pack#[a-z0-9-]+$/.test(url)));
export const officialBenefitUrl = z.string().trim().max(1000).refine(
  value => educationCampaignUrls.has(value) || officialUrl.safeParse(value).success,
  "Use um link oficial permitido no catálogo de benefícios.",
);

const common = {
  id: identifier.optional(), revision: z.string().regex(/^[a-f0-9]{32}$/, "Reabra a ficha para carregar sua revisão.").optional(),
  name: text(140), status: z.enum(["draft", "published", "preparing", "archived"]),
  sortOrder: z.coerce.number().int().min(0).max(10000),
};
const date = z.string().refine(v => !v || /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v, "Data inválida.");
export const benefitSchema = z.strictObject({
  ...common, status: z.enum(["draft", "published", "archived"]), partner: text(140), description: text(2000),
  evidenceUrl: officialBenefitUrl, eligibility: z.string().trim().max(2000), availability: z.string().trim().max(1000),
  startsAt: date, endsAt: date, verifiedOn: date.optional(), redemption: z.string().trim().max(4000), redemptionUrl: officialBenefitUrl,
  categoryId: z.union([identifier, z.literal("")]).optional(), providerLabel: z.string().trim().max(140).optional(),
  audience: z.enum(BENEFIT_AUDIENCE_VALUES).optional(),
  providerAccess: z.enum(["unconfirmed", "free", "premium", "included"]).optional(), sourceUrl: officialBenefitUrl.optional(),
}).superRefine((v, ctx) => {
  if (v.startsAt && v.endsAt && v.endsAt <= v.startsAt) ctx.addIssue({ code: "custom", message: "A vigência final deve ser posterior à inicial." });
  if (v.verifiedOn && (v.startsAt || v.endsAt)) {
    ctx.addIssue({ code: "custom", message: "Escolha a vigência anunciada ou a verificação periódica." });
  }
  if (v.verifiedOn && v.status === "published") {
    const elapsed = Date.now() - Date.parse(v.verifiedOn);
    if (elapsed < 0 || elapsed >= 7 * 86400000 || !v.redemptionUrl) {
      ctx.addIssue({ code: "custom", message: "Confira o resgate e informe uma verificação dos últimos sete dias em UTC." });
    }
  }
  const hasValidity = v.verifiedOn || (v.startsAt && v.endsAt);
  if (v.status === "published" && (!v.evidenceUrl || !v.eligibility || !v.availability || !hasValidity || !v.redemption)) {
    ctx.addIssue({ code: "custom", message: "Antes de publicar, comprove o acordo e informe elegibilidade, disponibilidade, vigência e procedimento de resgate." });
  }
});
export const trackSchema = z.strictObject({ ...common, description: text(2000) });
export const moduleSchema = z.strictObject({ ...common, trackId: identifier, description: text(4000), deliverable: text(2000) });
export const activitySchema = z.strictObject({ ...common, moduleId: identifier, instructions: text(12000), resourceUrl: officialUrl });
export type DeliverableKind = "benefit" | "track" | "module" | "activity";
