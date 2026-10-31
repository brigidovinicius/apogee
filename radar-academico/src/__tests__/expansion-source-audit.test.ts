import * as cheerio from "cheerio";
import { writeFile } from "node:fs/promises";
import { expect, it } from "vitest";
import targets from "../../references/radar-expansion-20261030/targets.json";
import { expansionSources, normalizeExpansion } from "@/lib/ingestion/normalize-expansion";
import { fetchOfficialResource } from "@/lib/ingestion/fetch-source";
import { ingestionFailureReason } from "@/lib/ingestion/failure-reason";
import { publicText } from "@/lib/ingestion/structured-events";
import { publicationIssue } from "@/lib/ingestion/publication";
import type { OfficialSource } from "@/lib/ingestion/types";
const packageModule = new URL("../../scripts/radar-expansion-package.mjs", import.meta.url).href;

it.skipIf(!process.env.RADAR_EXPANSION_AUDIT_PATH)("audits public source access/robots and exact editions without database writes, email, registration or publication", async () => {
  const { expansionPackage } = await import(packageModule);
  const pkg = await expansionPackage();
  const results: Record<string, unknown>[] = [];
  const sources: { kind: string; source: OfficialSource; url: string }[] = [
    ...expansionSources().map(source => ({ kind: "source", source: { ...source, active: true }, url: source.baseUrl })),
    ...targets.map(target => ({ kind: "target", url: target.url, source: { id: target.id, name: target.name, institutionName: target.organizer,
      institutionAcronym: "", sourceType: "official_reference" as const, baseUrl: target.url, allowedDomains: [new URL(target.url).hostname],
      allowedPathPrefixes: ["/"], listingUrls: [target.url], extractionMode: "reference_only" as const,
      audienceScope: [], geographicScope: [], categories: target.topics, priority: target.priority, active: true } })),
  ];
  for (const { kind, source, url } of sources) {
    const row: Record<string, unknown> = { kind, id: source.id, url };
    try {
      const resource = await fetchOfficialResource(url, source, 2 * 1024 * 1024);
      if (!/text\/html|application\/xhtml/i.test(resource.contentType)) throw Error("unsupported_content");
      const html = resource.body.toString("utf8");
      if (html.length < 200 || /<title[^>]*>\s*(?:Access Denied|Just a moment|403 Forbidden)/i.test(html)) throw Error("unsupported_content");
      if (kind === "target") {
        const target = targets.find(target => target.id === source.id)!;
        const normalize = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/\s+/g, " ");
        const $ = cheerio.load(html);
        const labels = $("img[alt]").toArray().map(node => $(node).attr("alt")).join(" ");
        const text = normalize(`${publicText(html)} ${$("title").text()} ${labels}`);
        if (!target.identity_hints.some(hint => text.includes(normalize(hint)))) throw Error("identity_unconfirmed");
      }
      if (kind === "source") {
        const candidates = normalizeExpansion(html, source);
        if (!candidates.length || candidates.some(candidate => candidate.opportunityStatus === "open" && publicationIssue(candidate, source))) throw Error("candidate_unconfirmed");
        row.candidates = candidates.map(candidate => ({ title: candidate.title, status: candidate.opportunityStatus, deadline: candidate.deadlineAt ?? null, start: candidate.eventStartsAt ?? null }));
      }
      row.outcome = "checked";
    } catch (error) { row.outcome = "blocked"; row.reason = error instanceof Error && ["identity_unconfirmed", "unsupported_content", "candidate_unconfirmed"].includes(error.message) ? error.message : ingestionFailureReason(error); row.detail = kind === "source" && error instanceof Error && /^(Escopo diverge|Evidência, público|Rota de inscrição|Evento Luma|Organizador Luma|Condições do evento|Horário Luma)/.test(error.message) ? error.message : undefined; }
    results.push(row);
    // Checkpoint includes no page body, attendee data, credentials or private URLs.
    await writeFile(process.env.RADAR_EXPANSION_AUDIT_PATH!, JSON.stringify({ complete: false, manifestHash: pkg.manifestHash, checkedAt: new Date().toISOString(), results }, null, 2));
    console.log(JSON.stringify({ kind, id: source.id, outcome: row.outcome, reason: row.reason, detail: row.detail }));
  }
  expect(results).toHaveLength(sources.length);
  await writeFile(process.env.RADAR_EXPANSION_AUDIT_PATH!, JSON.stringify({ complete: true, manifestHash: pkg.manifestHash, checkedAt: new Date().toISOString(), results }, null, 2));
}, 1_800_000);
