import type { Metadata } from "next";
import { StoreExperience } from "./store-experience";

export const metadata: Metadata = {
  title: "Loja | Apogee",
  description:
    "Peças, objetos e edições da comunidade Apogee Builders Club — primeira coleção em desenvolvimento.",
  alternates: { canonical: "/loja" },
  openGraph: {
    title: "Loja | Apogee",
    description: "Conheça os estudos da primeira coleção Apogee Builders Club, ainda em desenvolvimento.",
    url: "/loja", siteName: "Apogee", locale: "pt_BR", type: "website",
  },
  twitter: {
    card: "summary", title: "Loja | Apogee",
    description: "Conheça os estudos da primeira coleção Apogee Builders Club, ainda em desenvolvimento.",
  },
};

export default function StorePage() {
  return <StoreExperience />;
}
