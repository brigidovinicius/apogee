import * as cheerio from "cheerio";
import { isIP } from "node:net";
import { isAllowedHostname } from "@/lib/ingestion/validate-url";
import { structuredEvents } from "@/lib/ingestion/structured-events";
import { eventHasNotStarted } from "@/lib/ingestion/event-start";
import { parseHtml } from "@/lib/ingestion/parse-html";
import { discoveryLinkIssue } from "./link-selection";

const navigationLabel = /^(?:[«»\s]*(?:anterior|próximo)[«»\s]*|cursos|eventos e cursos|calendário de inscrições|inscrições e acompanhamento|chamadas (?:abertas|andamento)|ver todos os palestrantes|programação|destaques|a feira|acesso à informação)$/i;
export type DiscoveredLink = { url: string; title: string; excerpt: string; discoveryPath?: string[] };
export type DiscoveryResource = { body: Buffer; contentType: string; discoverySitemaps?: string[] };
const sharedHosts = new Set(["www.gov.br", "gov.br", "luma.com", "sites.google.com", "sympla.com.br", "www.sympla.com.br"]);

/** A shared platform's whole hostname does not belong to one verified institution. */
export function sameDiscoveryScope(root: string, input: string) {
  const base = new URL(root), url = new URL(input);
  if (base.origin !== url.origin) return false;
  if (!sharedHosts.has(base.hostname)) return true;
  const parts = base.pathname.split("/").filter(Boolean);
  const prefix = "/" + parts.slice(0, base.hostname === "sites.google.com" ? 2 : 1).join("/");
  return prefix === "/" ? url.pathname === "/" : url.pathname === prefix || url.pathname.startsWith(prefix + "/");
}

export function candidateUrl(input: string): string | null {
  try {
    const url = new URL(input);
    if (url.protocol !== "https:" || url.port && url.port !== "443" || url.username || url.password ||
      isIP(url.hostname) !== 0 || !isAllowedHostname(url.hostname) || input.length > 2048) return null;
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) if (/^(utm_.+|fbclid|gclid)$/i.test(key)) url.searchParams.delete(key);
    return url.toString();
  } catch { return null; }
}
function resolved(value: string, base: string) {
  try { return candidateUrl(new URL(value, base).href); } catch { return null; }
}

/** Parse public HTML/XML only. XML entities and external document declarations never run. */
export function discoveryDocument(resource: DiscoveryResource, url: string, root: string, now = new Date()) {
  const text = resource.body.toString("utf8");
  const html = /text\/html|application\/xhtml/i.test(resource.contentType);
  if (!html && (!/xml|rss|atom/i.test(resource.contentType) || /<!DOCTYPE|<!ENTITY/i.test(text))) throw Error("Unsupported discovery document");
  const links: DiscoveredLink[] = [], pages: string[] = [];
  const addPage = (raw: string) => {
    const next = resolved(raw, url);
    if (next && sameDiscoveryScope(root, next) && next !== url && !pages.includes(next)) pages.push(next);
  };
  if (html) {
    const $ = cheerio.load(text);
    $("header,aside").remove();
    // Institutional Plone pages share gov.br navigation with other agencies.
    // Only the bounded content and its pagination supply discovery links.
    const plone = $('#content #content-core');
    if ($('#content h1.documentFirstHeading').length === 1 && plone.length === 1) {
      $('body').html(plone.clone());
    }
    const events = structuredEvents(text);
    const unavailable = new Set(events.filter(e => typeof e.startDate === "string" &&
      (!eventHasNotStarted(e.startDate, now) || e.eventStatus === "https://schema.org/EventCancelled")).map(e => e.url));
    for (const e of events) if (typeof e.url === "string" && typeof e.name === "string" && typeof e.startDate === "string" &&
      !unavailable.has(e.url)) links.push({ url: e.url, title: e.name, excerpt: `${e.name}; ${e.startDate}` });
    links.push(...parseHtml($.html(), url).filter(l => !unavailable.has(l.url)));
    $('link[rel~="alternate"],link[rel~="sitemap"],link[rel~="next"],a[rel~="next"],a[href]').each((_, node) => {
      const type = $(node).attr("type") ?? "", rel = $(node).attr("rel") ?? "", label = $(node).text().trim();
      if (/\bnofollow\b/i.test(rel)) return;
      if (/rss|atom|xml/i.test(type) || /\b(?:sitemap|next)\b/i.test(rel) || /^(?:próxim[oa]|next|seguinte|mais (?:eventos|oportunidades))\b/i.test(label)) {
        addPage($(node).attr("href") ?? "");
      }
    });
  } else {
    const $ = cheerio.load(text, { xml: true });
    const local = (name: string) => name.split(":").pop()?.toLowerCase();
    $("*").each((_, node) => {
      if (!("tagName" in node)) return;
      const name = local(node.tagName);
      if (name === "loc") {
        const value = $(node).text().trim(), parent = node.parent;
        if (parent && "tagName" in parent && local(parent.tagName) === "sitemap") addPage(value);
        else {
          const safe = resolved(value, url);
          if (safe && sameDiscoveryScope(root, safe)) {
            let title = new URL(safe).pathname;
            try { title = decodeURIComponent(title).split('/').filter(Boolean).at(-1)?.replace(/[-_]/g, " ").trim() || title; } catch { /* Keep encoded pathname. */ }
            links.push({ url: safe, title, excerpt: "URL presente no sitemap oficial." });
          }
        }
      }
      if (name === "item" || name === "entry") {
        const title = $(node).find("title").first().text().trim();
        const link = $(node).find('link[rel="alternate"],link:not([rel])').first();
        const value = link.attr("href") ?? link.text().trim();
        if (value && title) links.push({ url: value, title, excerpt: $(node).find("description,summary").first().text().slice(0, 500) });
      }
    });
  }
  // Site-wide maps cannot inherit the authority of one path/tenant on a shared site.
  if (new URL(root).pathname === "/" && !sharedHosts.has(new URL(root).hostname)) {
    for (const sitemap of resource.discoverySitemaps ?? []) addPage(sitemap);
  }
  const seen = new Set<string>();
  const candidates = links.flatMap(link => {
    const safe = resolved(link.url, url);
    if (!safe || safe === url || seen.has(safe) || navigationLabel.test(link.title) ||
      discoveryLinkIssue({ ...link, url: safe })) return [];
    seen.add(safe);
    return [{ url: safe, title: link.title.slice(0, 240), excerpt: link.excerpt.slice(0, 500) }];
  });
  return { links: candidates.slice(0, 10000), pages: pages.slice(0, 2000) };
}

/** Verify a chain edge again; a stored URL list alone never grants publication authority. */
export function discoveryEdge(resource: DiscoveryResource, from: string, to: string, root: string) {
  const parsed = discoveryDocument(resource, from, root);
  if (parsed.pages.includes(to) || parsed.links.some(l => l.url === to)) return true;
  if (/text\/html|application\/xhtml/i.test(resource.contentType)) {
    const text = resource.body.toString("utf8");
    const $ = cheerio.load(text);
    return structuredEvents(text).some(e => e.url === to) || $("a[href]").toArray()
      .some(node => resolved($(node).attr("href")!, from) === to);
  }
  return false;
}
