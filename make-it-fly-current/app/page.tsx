import type { Metadata } from "next";
import { EditorialHome } from "@/components/home/editorial-home";

export const dynamic = "force-dynamic";

const description = "Explore aplicações da IA na rotina, troque experiências na comunidade gratuita da Apogee e conheça o evento gratuito Codex Community.";

export const metadata: Metadata = {
  title: "Apogee | Comunidade, ideias e experiências",
  description,
  alternates: { canonical: "/" },
  openGraph: {
    title: "Apogee | Comunidade, ideias e experiências",
    description,
    url: "/", siteName: "Apogee", locale: "pt_BR", type: "website",
  },
  twitter: {
    card: "summary",
    title: "Apogee | Comunidade, ideias e experiências",
    description,
  },
};

export default function HomePage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite", "@id": "https://www.apogee.community/#website",
        name: "Apogee", url: "https://www.apogee.community/", inLanguage: "pt-BR",
        publisher: { "@id": "https://www.apogee.community/#organization" },
      },
      {
        "@type": "Organization", "@id": "https://www.apogee.community/#organization",
        name: "Apogee", url: "https://www.apogee.community/",
        logo: "https://www.apogee.community/brand/apogee-logo-navy.svg",
        description: "Comunidade e experiências para tirar ideias do papel",
      },
    ],
  };

  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
    <EditorialHome />
  </>;
}
