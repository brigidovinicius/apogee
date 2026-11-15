import { notFound } from "next/navigation";
import { localOfferPreview } from "@/lib/offer-preview";
import { OfferPreviewPage } from "@/components/community/offer-preview";

export const metadata = { title: "Prévia local | Apogee", robots: { index: false, follow: false } };

export default async function PreviewPage({ params }: { params: Promise<{ screen: string }> }) {
  if (!localOfferPreview()) notFound();
  const { screen } = await params;
  if (screen !== "radar" && screen !== "membros" && screen !== "entrada") notFound();
  return <OfferPreviewPage screen={screen} />;
}
