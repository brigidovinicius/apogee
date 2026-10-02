import * as cheerio from "cheerio";

export interface ParsedDocumentLink {
  title: string;
  url: string;
  excerpt: string;
}

export function parseHtml(html: string, baseUrl: string): ParsedDocumentLink[] {
  const $ = cheerio.load(html);
  $("script,style,noscript,nav,footer").remove();
  const links: ParsedDocumentLink[] = [];
  $("a[href]").each((_, element) => {
    const title = $(element).text().replace(/\s+/g, " ").trim();
    const href = $(element).attr("href");
    if (!href || title.length < 6) return;
    const context = $(element).closest("article,li,p,div").text().replace(/\s+/g, " ").trim().slice(0, 1200);
    try {
      links.push({ title, url: new URL(href, baseUrl).toString(), excerpt: context });
    } catch {}
  });
  return links;
}