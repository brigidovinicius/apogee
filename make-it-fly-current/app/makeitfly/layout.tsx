import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  robots: { index: true, follow: true },
  alternates: { canonical: "https://www.apogee.community/makeitfly" },
  title: "Make it fly",
  description:
    "Um dia de coworking, comunidade e foco para tirar uma ideia do papel. Primeira edição com vagas limitadas. Energizados por Red Bull.",
  openGraph: {
    title: "Make it fly | Tire uma ideia do papel",
    description:
      "Coworking, comunidade e foco. Vagas limitadas.",
    locale: "pt_BR",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Make it fly | Tire uma ideia do papel",
    description:
      "Coworking, comunidade e foco. Vagas limitadas.",
  },
};

export default function MakeItFlyLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
