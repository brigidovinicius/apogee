import type { Metadata } from "next";
import { EditorialHome } from "@/components/home/editorial-home";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Apogee | Comunidade, ideias e experiências",
  description: "Descubra seu próximo salto na Apogee: explore conhecimento, encontre oportunidades e conheça a comunidade gratuita e o evento Codex Community.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Apogee | Comunidade, ideias e experiências",
    description: "Conhecimento, oportunidades e comunidade para colocar ideias em prática. Conheça o evento gratuito Codex Community da Apogee.",
    url: "/", siteName: "Apogee", locale: "pt_BR", type: "website",
  },
  twitter: {
    card: "summary",
    title: "Apogee | Comunidade, ideias e experiências",
    description: "Conhecimento, oportunidades e comunidade para colocar ideias em prática. Conheça o evento gratuito Codex Community da Apogee.",
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
