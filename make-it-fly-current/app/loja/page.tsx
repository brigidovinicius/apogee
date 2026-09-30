import type { Metadata } from "next";
import { StoreExperience } from "./store-experience";

export const metadata: Metadata = {
  title: "Loja | Apogee",
  description:
    "Peças, objetos e edições da comunidade Apogee Builders Club — primeira coleção em desenvolvimento.",
};

export default function StorePage() {
  return <StoreExperience />;
}
