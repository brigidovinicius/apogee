import type { Metadata } from "next";
import { GalleryAdmin } from "@/components/gallery/gallery-admin";

export const metadata: Metadata = {
  title: "Gerenciar galeria | Make It Fly",
  robots: { index: false, follow: false, noarchive: true },
};

export default function ManageGalleryPage() {
  return <GalleryAdmin />;
}
