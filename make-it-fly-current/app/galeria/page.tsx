import type { Metadata } from "next";
import { GalleryExperience } from "@/components/gallery/gallery-experience";

export const metadata: Metadata = {
  title: "Galeria da comunidade Apogee | Make It Fly",
  description:
    "Veja e compartilhe fotos do evento Make It Fly na galeria da comunidade Apogee, com nome e Instagram de quem fotografou.",
};

export default function GalleryPage() {
  return <GalleryExperience />;
}
