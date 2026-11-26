import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionCookie } from "better-auth/cookies";
import { BenefitPreviewCatalogue } from "@/components/benefits/preview-catalogue";
import { EditorialPageShell } from "@/components/site/editorial-page-shell";
import { benefitNavigation, type BenefitSearchParams } from "@/lib/benefits/navigation";
import { getCurrentMember } from "@/lib/members/dal";

export const metadata: Metadata = { title: "Benefícios da Apogee", alternates: { canonical: "/beneficios" } };

export default async function PublicBenefitsPage({ searchParams }: { searchParams: Promise<BenefitSearchParams> }) {
  const params = await searchParams;
  const { listHref } = benefitNavigation(params, "catalogue");
  if (getSessionCookie(await headers()) && await getCurrentMember()) redirect(listHref);
  const memberHref = `/membros/entrar?next=${encodeURIComponent(listHref)}`;
  return <EditorialPageShell current="benefits" memberHref={memberHref}><main id="experiencia" tabIndex={-1}><BenefitPreviewCatalogue params={params} /></main></EditorialPageShell>;
}
