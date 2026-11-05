import { asObject } from "@/lib/ingestion/structured-events";
import { fetchOfficialResource } from "@/lib/ingestion/fetch-source";
import type { OfficialSource } from "@/lib/ingestion/types";
import { candidateUrl, discoveryDocument, sameDiscoveryScope, type DiscoveryResource, type DiscoveredLink } from "./documents";

type Cursor = { url: string; path: string[]; offset: number; pageOffset: number };
export type CrawlState = { version: 1; rootHash: string; queue: Cursor[]; visited: string[] };
function checkpoint(input: unknown, root: string, hash: string): CrawlState {
  const raw = asObject(input);
  const validUrl = (url: unknown): url is string => typeof url === "string" && candidateUrl(url) === url && sameDiscoveryScope(root, url);
  if (raw?.version === 1 && raw.rootHash === hash && Array.isArray(raw.queue) && raw.queue.length > 0 && raw.queue.length <= 40 &&
    Array.isArray(raw.visited) && raw.visited.length <= 64 && raw.visited.every(validUrl)) {
    const queue = raw.queue.map(asObject);
    if (queue.every(q => q && validUrl(q.url) && Array.isArray(q.path) && q.path.length <= 3 && q.path.every(validUrl) &&
      (q.path.length === 0 ? q.url === root : q.path[0] === root) && Number.isInteger(q.offset) && Number(q.offset) >= 0 && Number(q.offset) <= 10000 &&
      Number.isInteger(q.pageOffset) && Number(q.pageOffset) >= 0 && Number(q.pageOffset) <= 2000)) return raw as unknown as CrawlState;
  }
  return { version: 1, rootHash: hash, queue: [{ url: root, path: [], offset: 0, pageOffset: 0 }], visited: [] };
}

/** At most three documents and thirty candidate positions per cycle, with durable progress. */
export async function crawlDiscovery(target: { official_url: string; discovery_crawl?: unknown; id: string; name: string },
  source: OfficialSource, rootResource: DiscoveryResource, hash: string, known: ReadonlySet<string>, includeRoot: boolean) {
  const root = new URL(target.official_url).href;
  const state = checkpoint(target.discovery_crawl, root, hash);
  const leads: DiscoveredLink[] = [];
  // The caller has already fetched the root to validate the checkpoint.
  let remaining = 30, pagesChecked = 1, failures = 0;
  const visited = (url: string) => { state.visited.push(url); state.visited = state.visited.slice(-64); };
  while (state.queue.length && pagesChecked < 3 && remaining > 0) {
    const current = state.queue.shift()!;
    if (state.visited.includes(current.url)) continue;
    let resource: DiscoveryResource;
    if (current.url !== root) pagesChecked++;
    try { resource = current.url === root ? rootResource : await fetchOfficialResource(current.url, source, 2 * 1024 * 1024); }
    catch { failures++; visited(current.url); continue; }
    let parsed: ReturnType<typeof discoveryDocument>;
    try { parsed = discoveryDocument(resource, current.url, root); }
    catch { failures++; visited(current.url); continue; }
    if (current.url === root && includeRoot) parsed.links.unshift({ url: root, title: target.name, excerpt: "Página oficial de origem." });
    const selected = parsed.links.slice(current.offset, current.offset + remaining);
    remaining -= selected.length;
    current.offset += selected.length;
    for (const link of selected) if (!known.has(link.url) && !leads.some(l => l.url === link.url)) {
      leads.push({ ...link, discoveryPath: [...current.path, current.url] });
    }
    // Reserve a queue slot for this page's continuation so large sitemap indexes advance too.
    while (current.pageOffset < parsed.pages.length && state.queue.length < 38) {
      const next = parsed.pages[current.pageOffset++];
      if (current.path.length >= 3 || current.path.includes(next) || state.visited.includes(next) || state.queue.some(q => q.url === next) || next === current.url) continue;
      state.queue.push({ url: next, path: [...current.path, current.url], offset: 0, pageOffset: 0 });
    }
    if (current.offset < parsed.links.length || current.pageOffset < parsed.pages.length) state.queue.push(current);
    else visited(current.url);
  }
  return { leads, state, pagesChecked, failures };
}
