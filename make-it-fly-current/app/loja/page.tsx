import type { Metadata } from "next";
import { StoreExperience } from "./store-experience";

const description = "Conheça o moletom Building the Future e o boné Made to Create da Apogee. Cadastre-se para receber novidades dos próximos drops.";
export const metadata: Metadata = {
  title: "Loja | Apogee",
  description,
  alternates: { canonical: "/loja" },
  openGraph: { title: "Loja | Apogee", description, url: "/loja", siteName: "Apogee", locale: "pt_BR", type: "website" },
  twitter: { card: "summary", title: "Loja | Apogee", description },
};

export default function StorePage() {
  return <StoreExperience />;
}
