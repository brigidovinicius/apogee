import type { MetadataRoute } from "next";

const origin = "https://www.apogee.community";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["/", "/oportunidades", "/galeria", "/loja", "/makeitfly"].map(
    (path) => ({ url: new URL(path, origin).toString() }),
  );
}
