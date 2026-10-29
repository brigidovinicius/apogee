import { listRadarOpportunities } from "@/lib/opportunities/radar-client";
import { CALENDARS, publicOpportunityPath } from "@/lib/opportunities/discovery";
import type { MetadataRoute } from "next";
import { listPublicPostUrls } from "@/lib/blog/data";

const origin = "https://www.apogee.community";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await listPublicPostUrls();
  const opportunities = await listRadarOpportunities(true).catch(()=>[]);
  return [
    ...["/", "/oportunidades", "/galeria", "/loja", "/makeitfly", "/blog"].map(
      (path) => ({ url: new URL(path, origin).toString() }),
    ),
    ...CALENDARS.map(c=>({url:new URL(`/calendarios/${c.slug}`,origin).toString()})),
    {url:new URL("/calendarios",origin).toString()},
    ...opportunities.map(item=>({url:new URL(publicOpportunityPath(item),origin).toString()})),
    ...posts.map((post) => ({ url: new URL(`/blog/${post.slug}`, origin).toString(), lastModified: post.updatedAt })),
  ];
}
