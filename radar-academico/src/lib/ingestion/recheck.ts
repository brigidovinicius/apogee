import { withAdminTransaction } from "@/lib/db/client";
import { fetchOfficialResource } from "./fetch-source";
import { normalizeOpportunity } from "./normalize-opportunity";
import { parseHtml } from "./parse-html";
import { persistCandidate, lockSource, type StoredOpportunity } from "./persist-candidate";
import type { OfficialSource, OpportunityCandidate } from "./types";

function fapespPostingId(url: string) {
  return /^https:\/\/(?:www\.)?fapesp\.br\/oportunidades\/[^/]+\/(\d+)\/$/.exec(url)?.[1] ?? null;
}

export async function recheckKnownOpportunities(source: OfficialSource, limit: number,
  readText: (body: Buffer, contentType: string) => Promise<string>) {
  if (limit < 1) return { pagesChecked: 0, failed: 0, published: 0 };
  const rows = await withAdminTransaction(async (client) => (await client.query<StoredOpportunity & { source_page_url: string }>(
    `select o.*,os.source_page_url from opportunities o join lateral (
      select source_page_url from opportunity_sources where opportunity_id=o.id and is_primary and active limit 1
    ) os on true where o.official_source_id=$1 and o.deleted_at is null
      and (o.next_source_check_at is null or o.next_source_check_at<=now())
    order by o.last_source_check_at nulls first,o.id limit $2`, [source.id, limit])).rows);
  let pagesChecked = 0, failed = 0, published = 0;
  for (const row of rows) {
    try {
      // These sources can remove a call from the open index before its detail
      // page changes. The current official listing is additional evidence.
      let stillListed = true;
      if (source.id === "minc-intercambio-audiovisual-2026" || source.id === "fapesp-open-fellowships") {
        const listingUrl = source.listingUrls[0];
        const listing = await fetchOfficialResource(listingUrl, source);
        pagesChecked += 1;
        const html = listing.body.toString("utf8");
        const expectedHeading = source.id === "fapesp-open-fellowships" ? /Oportunidades de Bolsas/i : /Editais em andamento/i;
        if (!/text\/html/i.test(listing.contentType) || !expectedHeading.test(html)) {
          throw new Error("Lista oficial indisponível para confirmação");
        }
        const links = parseHtml(html, listingUrl).map((link) => link.url);
        const peer = source.id === "fapesp-open-fellowships"
          ? links.some((url) => fapespPostingId(url))
          : links.some((url) => url.startsWith(`${listingUrl}/`));
        if (!peer) throw new Error("Lista oficial sem fichas verificáveis");
        const postingId = source.id === "fapesp-open-fellowships" ? fapespPostingId(row.source_page_url) : null;
        stillListed = postingId ? links.some((url) => fapespPostingId(url) === postingId) : links.includes(row.source_page_url);
      }
      let candidate: OpportunityCandidate | null = null;
      if (stillListed) {
        const response = await fetchOfficialResource(row.source_page_url, source);
        pagesChecked += 1;
        const text = await readText(response.body, response.contentType);
        candidate = text ? normalizeOpportunity({ title: String(row.title), text, url: row.source_page_url, source }) : null;
      }
      await withAdminTransaction(async (client) => {
        await lockSource(client, source);
        const current = (await client.query<StoredOpportunity>("select * from opportunities where id=$1 for update", [row.id])).rows[0];
        if (!current || current.deleted_at) return;
        // A concurrent admin edit can change the official URL; discard that stale response.
        const link = (await client.query("select source_page_url from opportunity_sources where opportunity_id=$1 and is_primary limit 1", [row.id])).rows[0];
        if (link?.source_page_url !== row.source_page_url) return;
        if (candidate) published += (await persistCandidate(client, source, candidate, { mode: "automatic", existing: current })).published;
        else {
          await client.query("update opportunities set publication_issue='unconfirmed_on_recheck',published_at=null,last_source_check_at=now(),version=version+1 where id=$1", [row.id]);
          await client.query("insert into opportunity_management_events (opportunity_id,actor,action,previous_data,new_data) values ($1,'radar:automatic','withdraw',$2,$3)", [row.id, current, { publicationIssue: "unconfirmed_on_recheck" }]);
        }
        await client.query("update opportunities set next_source_check_at=now()+interval '24 hours' where id=$1", [row.id]);
      });
    } catch {
      failed += 1;
      // A network failure does not claim a new successful verification or a closed opportunity.
      await withAdminTransaction((client) => client.query("update opportunities set next_source_check_at=now()+interval '1 hour' where id=$1", [row.id]));
    }
  }
  return { pagesChecked, failed, published };
}
