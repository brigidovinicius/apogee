import type { CatalogueBenefit } from "./types";

// These names break editorial ties. A match never creates or publishes an offer.
const familiarPartners = new Set([
  "adobe", "amazon web services", "aws", "canva", "figma", "github", "google",
  "google cloud", "google workspace", "microsoft", "microsoft azure", "n8n",
  "notion", "teamwork", "teamwork.com",
]);
// Lead with a concrete, substantial advantage from providers members recognize.
// Each entry points at a campaign the existing availability check has accepted.
const recommended = new Map([
  "figma-education",
  "github-education-github-copilot",
  "aws-activate",
  "google-cloud-startups",
  "github-education-notion",
  "adobe-education-br",
  "github-education-microsoft-365",
  "notion-startups",
  "github-education-1password",
  "github-education-microsoft",
].map((id, index) => [id, index]));

export const rosaCampaignUrl = "https://www.hostgator.com.br/53289-77-3-32.html";
type RankedOffer = Pick<CatalogueBenefit, "id" | "partner" | "sort_order" | "provider_access">
  & { redemption_url?: string | null; rosa_campaign?: boolean };

function partnerPriority(offer: RankedOffer) {
  return familiarPartners.has(offer.partner.trim().toLowerCase()) ? 0 : 1;
}

function accessPriority(offer: RankedOffer) {
  return ["free", "included"].includes(offer.provider_access) ? 0 : 1;
}

function rosaPriority(offer: RankedOffer) {
  return (offer.rosa_campaign || offer.redemption_url === rosaCampaignUrl) && /^hostgator(?: brasil)?$/i.test(offer.partner.trim()) ? 0 : 1;
}

export function orderCatalogueOffers<T extends RankedOffer>(offers: T[]) {
  return [...offers].sort((a, b) =>
    rosaPriority(a) - rosaPriority(b) ||
    Number(b.sort_order === 0) - Number(a.sort_order === 0) ||
    (recommended.get(a.id) ?? recommended.size) - (recommended.get(b.id) ?? recommended.size) ||
    a.sort_order - b.sort_order ||
    partnerPriority(a) - partnerPriority(b) ||
    accessPriority(a) - accessPriority(b)
  );
}
