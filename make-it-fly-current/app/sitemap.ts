import { listRadarOpportunities } from "@/lib/opportunities/radar-client";
import { CALENDARS, publicOpportunityPath } from "@/lib/opportunities/discovery";
import type { MetadataRoute } from "next";
import { listPublicPostUrls } from "@/lib/blog/data";
import {privacyPolicyReady} from "@/lib/privacy-policy";
import {termsOfUseReady} from "@/lib/terms-of-use";

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
    ...(privacyPolicyReady()&&process.env.APOGEE_LOCAL_PREVIEW!=='1'?[{url:new URL('/privacidade',origin).toString()}]:[]),
    ...(termsOfUseReady()&&process.env.APOGEE_LOCAL_PREVIEW!=='1'?[{url:new URL('/termos',origin).toString()}]:[]),
    ...opportunities.map(item=>({url:new URL(publicOpportunityPath(item),origin).toString()})),
    ...posts.map((post) => ({ url: new URL(`/blog/${post.slug}`, origin).toString(), lastModified: post.updatedAt })),
  ];
}
