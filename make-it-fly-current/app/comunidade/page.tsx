import type { Metadata } from "next";
import { CommunitySalesPage } from "@/components/community/community-sales-page";

const description = "Conheça a Comunidade Apogee: Radar de oportunidades, cursos de IA em preparação e uma newsletter curada em construção.";

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
  return <CommunitySalesPage />;
}
