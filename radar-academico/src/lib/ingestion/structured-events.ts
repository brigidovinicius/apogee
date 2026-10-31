import * as cheerio from "cheerio";

type JsonObject = Record<string, unknown>;
export const asObject = (value: unknown): JsonObject | null => value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : null;
/** Only public schema.org events; never read hydration state, attendee lists or profiles. */
export function structuredEvents(html: string): JsonObject[] {
  const $ = cheerio.load(html), events: JsonObject[] = [];
  function visit(value: unknown, depth: number) {
    if (depth > 8 || events.length >= 100) return;
    if (Array.isArray(value)) { value.slice(0, 100).forEach(item => visit(item, depth + 1)); return; }
    const data = asObject(value);
    if (!data) return;
    const types = Array.isArray(data["@type"]) ? data["@type"] : [data["@type"]];
    if (types.includes("Event")) { events.push(data); return; }
    // Do not traverse arbitrary user data or unrelated page metadata.
    for (const key of ["@graph", "itemListElement", "item"]) if (data[key]) visit(data[key], depth + 1);
  }
  $('script[type="application/ld+json"]').slice(0, 20).each((_, node) => {
    const raw = $(node).text();
    if (raw.length > 1_000_000) return;
    try { visit(JSON.parse(raw), 0); } catch { /* Invalid metadata is not evidence. */ }
  });
  return events;
}
export function publicText(html: string) {
  const $ = cheerio.load(html);
  $("script,style,noscript,nav,header,footer,aside,form").remove();
  $("p,div,h1,h2,h3,li,td,a").append(" ");
  return $("body").text().replace(/\s+/gu, " ").trim();
}
