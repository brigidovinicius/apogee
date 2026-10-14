import type { MetadataRoute } from "next";
import { listPublicPostUrls } from "@/lib/blog/data";

const origin = "https://www.apogee.community";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await listPublicPostUrls();
  return [
    ...["/", "/oportunidades", "/galeria", "/loja", "/makeitfly", "/blog"].map(
      (path) => ({ url: new URL(path, origin).toString() }),
    ),
    ...posts.map((post) => ({ url: new URL(`/blog/${post.slug}`, origin).toString(), lastModified: post.updatedAt })),
  ];
}
