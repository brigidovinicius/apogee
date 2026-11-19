import { BenefitsWorkspace, type BenefitSearchParams } from "@/components/benefits/workspace";
import { BenefitPreviewCatalogue } from "@/components/benefits/preview-catalogue";
import { MemberWorkspace } from "@/components/members/member-workspace";
import { deliverableMember } from "@/lib/deliverables/store";
import { benefitNavigation } from "@/lib/benefits/navigation";
export const dynamic = "force-dynamic";
export const metadata = { title: "Benefícios", robots: { index: false, follow: false } };
export default async function BenefitsPage({ searchParams }: { searchParams: Promise<BenefitSearchParams> }) {
  const params = await searchParams;
  const { member, access } = await deliverableMember(benefitNavigation(params, "catalogue").listHref);
  if (access.allowed) return <BenefitsWorkspace params={params} />;
  return <MemberWorkspace member={member} current="beneficios"><BenefitPreviewCatalogue params={params} userId={member.id} /></MemberWorkspace>;
}
