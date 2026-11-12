import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CommunitySalesPage } from "@/components/community/community-sales-page";

const description = "Comunidade gratuita da Apogee no WhatsApp: IA no dia a dia, oportunidades e curadoria. Conheça também a primeira turma de IA em preparação.";

export const metadata: Metadata = {
  title: "Comunidade Apogee",
  description,
  robots: { index: false, follow: false },
  openGraph: {
    title: "Comunidade Apogee",
    description,
    locale: "pt_BR",
    type: "website",
  },
  twitter: { card: "summary", title: "Comunidade Apogee", description },
};

export default function CommunityPage() {
  if (process.env.APOGEE_LOCAL_PREVIEW !== "1") notFound();
  return <CommunitySalesPage />;
}
