import { BenefitsWorkspace, type BenefitSearchParams } from "@/components/benefits/workspace";
export const dynamic = "force-dynamic";
export const metadata = { title: "Benefícios salvos", robots: { index: false, follow: false } };
export default async function SavedBenefitsPage({ searchParams }: { searchParams: Promise<BenefitSearchParams> }) {
  return <BenefitsWorkspace view="saved" params={await searchParams} />;
}
