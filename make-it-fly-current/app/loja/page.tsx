import type { Metadata } from "next";
import { StoreExperience } from "./store-experience";

const description = "Conheça as peças da coleção Apogee, incluindo a camiseta Need Money for Tokens. Entre na lista de espera para receber avisos dos próximos drops.";
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
