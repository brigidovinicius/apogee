import type { Metadata } from "next";
import { BlogIndex } from "@/components/blog/blog-index";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Blog | Apogee",
  description: "Ideias, estudos, empreendedorismo, tecnologia, ciências e atualidades para ampliar caminhos.",
  alternates: { canonical: "/blog" },
  openGraph: { title: "Blog | Apogee", description: "Conhecimento, ideias e perspectivas para seguir em frente.", url: "/blog", type: "website" },
};

export default async function BlogPage({ searchParams }: { searchParams: Promise<{ tema?: string; pagina?: string }> }) {
  return BlogIndex({ searchParams });
}
