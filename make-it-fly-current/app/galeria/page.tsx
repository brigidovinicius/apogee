import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GalleryExperience } from "@/components/gallery/gallery-experience";
import { listCommunityPhotos } from "@/lib/gallery";
import type { CommunityPhotoPage } from "@/lib/gallery-types";
import { GALLERY_PAGE_SIZE, galleryPageNumber, galleryPagePath } from "@/lib/gallery-pagination";

export const dynamic = "force-dynamic";
type GalleryPageProps = { searchParams: Promise<{ pagina?: string | string[] }> };

export async function generateMetadata({ searchParams }: GalleryPageProps): Promise<Metadata> {
  const page = galleryPageNumber((await searchParams).pagina);
  if (page === null) notFound();
  const title = page === 1 ? "Galeria da comunidade Apogee | Make It Fly" : `Galeria Apogee — página ${page} | Make It Fly`;
  const description = "Veja e compartilhe fotos do Make It Fly na galeria da comunidade Apogee, com créditos de quem fotografou ou envio anônimo.";
  return {
    title, description,
    alternates: { canonical: galleryPagePath(page) },
    openGraph: {
      title, description, url: galleryPagePath(page),
      siteName: "Apogee", locale: "pt_BR", type: "website",
    },
    twitter: { card: "summary", title, description },
  };
}

export default async function GalleryPage({ searchParams }: GalleryPageProps) {
  const page = galleryPageNumber((await searchParams).pagina);
  if (page === null) notFound();
  const offset = (page - 1) * GALLERY_PAGE_SIZE;
  const response = await listCommunityPhotos(
    new Request(`https://www.apogee.community/api/gallery?offset=${offset}`),
  );
  const initialPage: CommunityPhotoPage | undefined = response.ok ? await response.json() : undefined;
  if (initialPage && page > 1 && initialPage.photos.length === 0) notFound();
  return <GalleryExperience key={page} initialPage={initialPage} initialOffset={offset} pageNumber={page} />;
}
