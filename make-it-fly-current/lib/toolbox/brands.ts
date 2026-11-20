import catalogue from "@/content/tool-brands.json";
import { benefitBrand } from "@/lib/benefits/brands";

type Brand = { image: string; background: string };
type Product = { destinations: string[] } & (Brand | { benefitPartner: string });

const destinations = new Map<string, Brand>();
const namedProducts = new Map<string, { brand: Brand; hosts: Set<string> }>();
for (const [name, product] of Object.entries<Product>(catalogue)) {
  const asset = "benefitPartner" in product ? benefitBrand(product.benefitPartner) : product;
  if (!asset) continue;
  const brand = { image: asset.image, background: asset.background };
  for (const path of product.destinations) destinations.set(path, brand);
  namedProducts.set(name.toLowerCase(), {
    brand, hosts: new Set(product.destinations.map(path => path.split("/")[0])),
  });
}

export function toolBrand(name: string, href: string) {
  const url = new URL(href);
  const host = url.hostname.replace(/^www\./, "");
  const path = url.pathname.replace(/\/+$/, "");
  const exact = destinations.get(host + path);
  if (exact) return exact;
  const product = namedProducts.get(name.trim().toLowerCase());
  return product?.hosts.has(host) ? product.brand : undefined;
}
