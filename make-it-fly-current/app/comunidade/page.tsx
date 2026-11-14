import type { Metadata } from "next";
import { radarDetailReturnPath } from "@/lib/opportunities/detail-path";
import { localOfferPreview } from "@/lib/offer-preview";
import { CommunitySalesPage } from "@/components/community/community-sales-page";

const description = "Conheça a Comunidade Apogee: Radar, Learn, Perks e Community. Comece gratuitamente com até 10 eventos distintos no Radar e descubra a assinatura.";

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
  return <CommunitySalesPage preview={localOfferPreview()} next={radarDetailReturnPath(params.next)} />;
}
