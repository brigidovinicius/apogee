import Parser from "rss-parser";

const parser = new Parser();

export async function parseRss(xml: string) {
  const feed = await parser.parseString(xml);
  return (feed.items ?? []).flatMap((item) => {
    if (!item.link || !item.title) return [];
    return [{
      title: item.title,
      url: item.link,
      excerpt: String(item.contentSnippet ?? item.content ?? "").replace(/\s+/g, " ").trim(),
      publishedAt: item.isoDate,
    }];
  });
}