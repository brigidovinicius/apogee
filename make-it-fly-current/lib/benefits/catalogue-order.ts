import type { CatalogueBenefit } from "./types";

// These names break editorial ties. A match never creates or publishes an offer.
const familiarPartners = new Set([
  "adobe", "amazon web services", "aws", "canva", "figma", "github", "google",
  "google cloud", "google workspace", "microsoft", "microsoft azure", "n8n",
  "notion", "teamwork", "teamwork.com",
]);

function partnerPriority(offer: CatalogueBenefit) {
  return familiarPartners.has(offer.partner.trim().toLowerCase()) ? 0 : 1;
}

function accessPriority(offer: CatalogueBenefit) {
  return ["free", "included"].includes(offer.provider_access) ? 0 : 1;
}

export function orderCatalogueOffers(offers: CatalogueBenefit[]) {
  // Stable sort retains the database's name and id order when priorities match.
  return [...offers].sort((a, b) =>
    a.sort_order - b.sort_order ||
    partnerPriority(a) - partnerPriority(b) ||
    accessPriority(a) - accessPriority(b)
  );
}
