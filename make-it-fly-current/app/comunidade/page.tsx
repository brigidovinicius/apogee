import type { Metadata } from "next";
import { communityReturnPath } from "@/lib/billing/community-navigation";
import { hasPublicBenefits } from "@/lib/benefits/store";
import { localStaticOfferPreview } from "@/lib/offer-preview";
import { CommunitySalesPage } from "@/components/community/community-sales-page";

const description = "Troque experiências sobre IA na comunidade gratuita da Apogee, descubra oportunidades e explore aplicações práticas para o trabalho e a rotina.";

export const metadata: Metadata = {
  title: "Comunidade Apogee",
  description,
  robots: { index: true, follow: true },
  alternates: { canonical: "https://www.apogee.community/comunidade" },
  openGraph: {
    title: "Comunidade Apogee",
    description,
    locale: "pt_BR",
    type: "website",
  },
  twitter: { card: "summary", title: "Comunidade Apogee", description },
};

export default async function CommunityPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const preview = localStaticOfferPreview();
  return <CommunitySalesPage preview={preview} next={communityReturnPath(params.next)} hasBenefits={preview ? null : await hasPublicBenefits()} />;
}
