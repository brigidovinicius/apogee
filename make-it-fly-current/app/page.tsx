import type { Metadata } from "next";
import { EditorialHome } from "@/components/home/editorial-home";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Apogee | Comunidade, ideias e experiências",
  description: "Descubra seu próximo salto na Apogee: explore o Radar de oportunidades, conheça os encontros Make It Fly e encontre uma comunidade para tirar ideias do papel",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Apogee | Comunidade, ideias e experiências",
    description: "Encontros Make It Fly, fotos da comunidade e oportunidades para dar o próximo passo",
    url: "/", siteName: "Apogee", locale: "pt_BR", type: "website",
  },
  twitter: {
    card: "summary",
    title: "Apogee | Comunidade, ideias e experiências",
    description: "Encontros Make It Fly, fotos da comunidade e oportunidades para dar o próximo passo",
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
