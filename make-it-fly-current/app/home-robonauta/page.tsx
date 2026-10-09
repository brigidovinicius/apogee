import type { Metadata } from "next";
import { ApogeeHome } from "@/components/home/apogee-home";

export const metadata: Metadata = {
  title: "Apogee — Home com Robonauta",
  description: "Comunidade e experiências para quem quer tirar uma ideia do papel.",
  robots: { index: false, follow: false },
};

export default function RobonautaHomePage() {
  return <ApogeeHome />;
}
