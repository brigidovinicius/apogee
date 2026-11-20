import { benefitBrand } from "@/lib/benefits/brands";
import { ProductMark } from "@/components/site/product-mark";

export function PartnerMark({ partner, offerId }: { partner: string; offerId: string }) {
  const brand = benefitBrand(partner);
  return <ProductMark name={partner} brand={brand && { image: brand.image, background: brand.background }}
    fallbackSrc={`/api/marcas?beneficio=${encodeURIComponent(offerId)}`} />;
}
