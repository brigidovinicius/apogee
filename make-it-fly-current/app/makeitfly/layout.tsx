import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  robots: { index: true, follow: true },
  alternates: { canonical: "https://www.apogee.community/makeitfly" },
  title: "Make It Fly | Coworking e comunidade Apogee",
  description:
    "Conheça o Make It Fly, encontro de coworking, comunidade e foco da Apogee para tirar uma ideia do papel. Veja a proposta e como participar.",
  openGraph: {
    title: "Make It Fly | Coworking e comunidade Apogee",
    description:
      "Um encontro de coworking, comunidade e foco para tirar uma ideia do papel.",
    url: "/makeitfly", siteName: "Apogee",
    locale: "pt_BR",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Make It Fly | Coworking e comunidade Apogee",
    description:
      "Um encontro de coworking, comunidade e foco para tirar uma ideia do papel.",
  },
};

export default function MakeItFlyLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
