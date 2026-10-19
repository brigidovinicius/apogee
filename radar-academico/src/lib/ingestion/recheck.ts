import { withAdminTransaction } from "@/lib/db/client";
import { fetchOfficialResource } from "./fetch-source";
import { normalizeOpportunity } from "./normalize-opportunity";
import { parseHtml } from "./parse-html";
import { persistCandidate, lockSource, type StoredOpportunity } from "./persist-candidate";
import type { OfficialSource, OpportunityCandidate } from "./types";
import { canonicalOpportunityKey } from "./revision-key";
import { normalizeProgrammeCatalogue, programmeCataloguePageCount, programmeSupplementUrl, programmeCatalogueCanBeEmpty } from "./programme-catalogue";
import { confirmedTerminalStatus } from "./publication";
import { normalizeAcateEvent } from "./normalize-acate-events";
import { FULBRIGHT_SOURCE_ID, normalizeFulbright } from "./normalize-fulbright";
import { PDAI_SOURCE_ID, capesPdaiTerminalEvidence } from "./normalize-capes-pdai";
import { PDSE_SOURCE_ID, capesPdseTerminalEvidence } from "./normalize-capes-pdse";

import { EVG_SOURCE_ID, normalizeEvgCourse, type EvgPolicy } from "./normalize-evg-courses";

function fapespPostingId(url: string) {
  return /^https:\/\/(?:www\.)?fapesp\.br\/oportunidades\/[^/]+\/(\d+)\/$/.exec(url)?.[1] ?? null;
}

export async function recheckKnownOpportunities(source: OfficialSource, limit: number,
  readText: (body: Buffer, contentType: string) => Promise<string>, evgPolicy?: EvgPolicy) {
  if (limit < 1) return { pagesChecked: 0, failed: 0, published: 0 };
  const rows = await withAdminTransaction(async (client) => (await client.query<StoredOpportunity & { source_page_url: string }>(
    `select o.*,os.source_page_url from opportunities o join lateral (
      select source_page_url from opportunity_sources where opportunity_id=o.id and is_primary and active limit 1
    ) os on true where o.official_source_id=$1 and o.deleted_at is null
      and (o.next_source_check_at is null or o.next_source_check_at<=now())
    order by o.last_source_check_at nulls first,o.id limit $2`, [source.id, limit])).rows);
  let pagesChecked = 0, failed = 0, published = 0;
  let verifiedListingLinks: string[] | null = null;
  let catalogueCandidates: Map<string, OpportunityCandidate> | null = null;
  let catalogueTerminal: ReturnType<typeof capesPdaiTerminalEvidence> = null;
  const cataloguePages = programmeCataloguePageCount(source.id);
  if (cataloguePages && rows.length) {
    try {
      const courses = await fetchOfficialResource(source.listingUrls[0], source);
      pagesChecked += 1;
      let applicationHtml = "";
      if (cataloguePages === 2) {
        const application = await fetchOfficialResource(programmeSupplementUrl(source.id), source);
        pagesChecked += 1;
        applicationHtml = /application\/pdf/i.test(application.contentType)
          ? await readText(application.body, application.contentType) : application.body.toString("utf8");
      }
      if (source.id === PDAI_SOURCE_ID) catalogueTerminal = capesPdaiTerminalEvidence(courses.body.toString("utf8"), applicationHtml);
      if (source.id === PDSE_SOURCE_ID) catalogueTerminal = capesPdseTerminalEvidence(courses.body.toString("utf8"), applicationHtml);
      const candidates = catalogueTerminal ? [] : normalizeProgrammeCatalogue(courses.body.toString("utf8"), applicationHtml, source);
      // A valid PSG catalogue with no eligible places confirms withdrawal;
      // missing/invalid embedded JSON throws and preserves the previous evidence.
      if (!candidates.length && !programmeCatalogueCanBeEmpty(source.id)) throw new Error("Oferta não confirmada");
      catalogueCandidates = new Map(candidates.map((candidate) => [canonicalOpportunityKey(source.id, candidate.title, candidate.sourcePageUrl), candidate]));
    } catch {
      // A source failure is one failed check, even when many records share its URL.
      await withAdminTransaction((client) => client.query(
        "update opportunities set next_source_check_at=now()+interval '1 hour' where id=any($1::uuid[])",
        [rows.map((row) => row.id)],
      ));
      return { pagesChecked, failed: 1, published: 0 };
    }
  }
  for (const row of rows) {
    try {
      // These sources can remove a call from the open index before its detail
      // page changes. The current official listing is additional evidence.
      let stillListed = true;
      if (source.id === "minc-intercambio-audiovisual-2026" || source.id === "fapesp-open-fellowships") {
        if (!verifiedListingLinks) {
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
          verifiedListingLinks = links;
        }
        const postingId = source.id === "fapesp-open-fellowships" ? fapespPostingId(row.source_page_url) : null;
        stillListed = postingId ? verifiedListingLinks.some((url) => fapespPostingId(url) === postingId) : verifiedListingLinks.includes(row.source_page_url);
      }
      let candidate: OpportunityCandidate | null = null;
      let terminalStatus: OpportunityCandidate["opportunityStatus"] | null = catalogueTerminal?.status ?? null;
      let statusEvidence = catalogueTerminal?.evidence.excerpt ?? "";
      const statusEvidenceUrl = catalogueTerminal?.evidence.source_url ?? row.source_page_url;
      if (catalogueCandidates) candidate = catalogueCandidates.get(String(row.canonical_key)) ?? null;
      else if (stillListed) {
        const response = await fetchOfficialResource(row.source_page_url, source);
        pagesChecked += 1;
        const text = await readText(response.body, response.contentType);
        terminalStatus = source.id === EVG_SOURCE_ID ? null : confirmedTerminalStatus(text, String(row.title));
        if (terminalStatus) {
          const start = Math.max(0, text.search(/inscriç(?:ão|ões)|prazo/i));
          statusEvidence = text.slice(start, start + 1000);
        }
        if (source.id === EVG_SOURCE_ID) candidate = normalizeEvgCourse(response.body.toString("utf8"), row.source_page_url, source, evgPolicy);
        else if (source.id === FULBRIGHT_SOURCE_ID) candidate = normalizeFulbright(response.body.toString("utf8"), row.source_page_url, source);
        else if (source.id === "acate-audited-events") {
          try { candidate = normalizeAcateEvent(response.body.toString("utf8"), row.source_page_url, source); }
          catch (error) { if (!terminalStatus) throw error; }
        } else candidate = text ? normalizeOpportunity({ title: String(row.title), text, url: row.source_page_url, source }) : null;
        if (candidate && terminalStatus) candidate = { ...candidate, opportunityStatus: terminalStatus,
          evidenceJson: { ...candidate.evidenceJson, opportunity_status: { source_url: row.source_page_url, excerpt: statusEvidence } } };
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
          const issue = terminalStatus ? "status_unconfirmed" : "unconfirmed_on_recheck";
          await client.query(`update opportunities set publication_issue=$2,published_at=null,
            opportunity_status=coalesce($3::text,opportunity_status),
            evidence_json=case when $3::text is not null then evidence_json || $4::jsonb else evidence_json end,
            last_source_check_at=now(),version=version+1 where id=$1`,
          [row.id, issue, terminalStatus, { opportunity_status: { source_url: statusEvidenceUrl, excerpt: statusEvidence } }]);
          await client.query("insert into opportunity_management_events (opportunity_id,actor,action,previous_data,new_data) values ($1,'radar:automatic','withdraw',$2,$3)", [row.id, current, { publicationIssue: issue, ...(terminalStatus ? { opportunityStatus: terminalStatus, evidence: statusEvidence } : {}) }]);
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
