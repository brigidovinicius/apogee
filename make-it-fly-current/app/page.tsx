import type { Metadata } from "next";
import { ApogeeHome } from "@/components/home/apogee-home";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function HomePage() {
  return <ApogeeHome />;
}
