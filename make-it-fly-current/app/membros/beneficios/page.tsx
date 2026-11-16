import { BenefitsWorkspace, type BenefitSearchParams } from "@/components/benefits/workspace";
export const dynamic = "force-dynamic";
export const metadata = { title: "Benefícios", robots: { index: false, follow: false } };
export default async function BenefitsPage({ searchParams }: { searchParams: Promise<BenefitSearchParams> }) {
  return <BenefitsWorkspace params={await searchParams} />;
}
