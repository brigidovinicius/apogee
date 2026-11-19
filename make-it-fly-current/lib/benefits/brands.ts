import brands from "@/content/benefit-brands.json";

const images = new Map(Object.entries(brands).map(([partner, brand]) => [partner.toLowerCase(), brand]));

export function benefitBrand(partner: string) {
  return images.get(partner.trim().toLowerCase());
}
