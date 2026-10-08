import type { Metadata } from "next";
import { GalleryAdmin } from "@/components/gallery/gallery-admin";
import { requireAdmin } from "@/lib/members/dal";

export const metadata: Metadata = {
  title: "Gerenciar galeria | Make It Fly",
  robots: { index: false, follow: false, noarchive: true },
};

export default async function ManageGalleryPage() {
  await requireAdmin("/gerenciar-galeria");
  return <GalleryAdmin />;
}
