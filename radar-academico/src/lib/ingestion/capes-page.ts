import * as cheerio from "cheerio";

const months: Record<string, string> = { janeiro: "01", fevereiro: "02", março: "03", abril: "04", maio: "05", junho: "06", julho: "07", agosto: "08", setembro: "09", outubro: "10", novembro: "11", dezembro: "12" };

export function readCapesPage(html: string, title: RegExp) {
  const $ = cheerio.load(html);
  $("script,style,noscript,nav,footer,header").remove();
  const page = $("#page-document").first();
  if (!page.length || !title.test(page.find("h1").first().text())) throw new Error("Página CAPES sem identidade verificável");
  page.find("p,h1,h2,h3,h4,li,div,br,tr,td,th").each((_, node) => { $(node).prepend(" ").append(" "); });
  return { $, page, text: page.text().replace(/\s+/g, " ").trim() };
}
export function capesDateOnly(text: string) {
  const m = /(\d{1,2}) de (\p{L}+) de (20\d{2})/iu.exec(text);
  if (!m || !months[m[2].toLowerCase()]) return null;
  const iso = `${m[3]}-${months[m[2].toLowerCase()]}-${m[1].padStart(2, "0")}`;
  const date = new Date(`${iso}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === iso ? iso : null;
}

