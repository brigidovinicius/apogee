import * as cheerio from "cheerio";
import { normalizeOpportunity } from "./normalize-opportunity";
import { asObject, publicText, structuredEvents } from "./structured-events";
import { normalizeLuma } from "./normalize-expansion";
import type { OfficialSource, OpportunityCandidate } from "./types";
import { brazilianStateCode } from "@/lib/location";
import { normalizePublicEvent } from "./public-event";

export const isDiscoveredPageSource = (source: Pick<OfficialSource, "id">) => source.id.startsWith("auto-page-");
const clean = (text: string) => text.normalize("NFC").replace(/\s+/gu, " ").trim();

/** Shared semantic HTML extraction; dedicated source normalizers keep their own policy. */
export function singleOpportunityArticle(html: string) {
  const $ = cheerio.load(html);
  $("script,style,noscript,nav,footer,aside,.entry-meta,.postmetadata").remove();
  const articles = $("article");
  const article = articles.length === 1 && articles.find("h1").length === 1 ? articles : $("main,[role='main']");
  if (articles.length > 1) return null;
  if (article.length !== 1 || article.find("h1").length !== 1) return null;
  const title = clean(article.find("h1").first().text());
  article.find("p,div,h1,h2,h3,li,a").append(" ");
  const text = clean(article.text()).slice(0, 30_000);
  return title && text ? { title, text } : null;
}

/** A detail page must identify one opportunity; navigation and mixed listings fail closed. */
export function normalizeDiscoveredPage(html: string, source: OfficialSource): OpportunityCandidate | null {
  const events = structuredEvents(html);
  if (events.length && (new URL(source.baseUrl).hostname !== "luma.com" ||
    events[0].eventAttendanceMode === "https://schema.org/OnlineEventAttendanceMode")) {
    return events.length === 1 ? normalizePublicEvent(html, events[0], source) : null;
  }
  if (new URL(source.baseUrl).hostname === "luma.com") {
    if (events.length !== 1) return null;
    const event = events[0];
    const organizer = (Array.isArray(event.organizer) ? event.organizer : [event.organizer])
      .map(asObject).find(org => typeof org?.name === "string" && clean(org.name) === clean(source.institutionName));
    const address = asObject(asObject(event.location)?.address);
    const region = address?.addressRegion;
    const state = brazilianStateCode(region);
    const authorityUrl = /; authority=(.+)$/.exec(source.notes ?? "")?.[1];
    const description = typeof event.description === "string" ? clean(publicText(event.description)).slice(0, 2000) : "";
    // Luma city aggregators do not establish an organizer's identity. Only an
    // independently verified organizer calendar can authorize these events.
    if (!organizer || typeof organizer.url !== "string" || organizer.url !== authorityUrl ||
      !state || typeof address?.addressLocality !== "string" ||
      typeof event.name !== "string" || event.url !== source.baseUrl ||
      !/hackathon|workshop|\bia\b|inteligência artificial|programaç|tecnologia|empreendedor|startup|ciência|carreira|builders|pitch/i
        .test(`${event.name} ${typeof event.description === "string" ? publicText(event.description) : ""}`)) return null;
    return normalizeLuma(html, source, {
      id: source.id, url: source.baseUrl, title: clean(event.name), organizer: source.institutionName,
      organizer_name: String(organizer.name), organizer_url: organizer.url,
      state: String(state), city: address.addressLocality,
      checks: description ? [description] : [], competition: /hackathon|competição|desafio/i.test(event.name),
      requirements: description || "Consulte os requisitos na página oficial do organizador.",
      conditions: "Consulte as condições do evento na fonte oficial.",
    }, new Date());
  }
  const article = singleOpportunityArticle(html);
  return article ? normalizeOpportunity({ ...article, url: source.baseUrl, source }) : null;
}
