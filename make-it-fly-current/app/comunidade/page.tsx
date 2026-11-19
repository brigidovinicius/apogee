import type { Metadata } from "next";
import { communityReturnPath } from "@/lib/billing/community-navigation";
import { hasPublicBenefits } from "@/lib/benefits/store";
import { localStaticOfferPreview } from "@/lib/offer-preview";
import { CommunitySalesPage } from "@/components/community/community-sales-page";

const description = "Conheça a conta gratuita e a assinatura anual da Comunidade Apogee. Compare a Caixa de Ferramentas, a Trilha de IA, o Radar e os benefícios disponíveis.";

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
  return <CommunitySalesPage preview={preview} next={communityReturnPath(params.next ?? "/membros")} hasBenefits={preview ? null : await hasPublicBenefits()} />;
}
