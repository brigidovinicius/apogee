import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import targets from "../../references/radar-expansion-20261030/targets.json";
import { expansionSources, normalizeExpansion } from "@/lib/ingestion/normalize-expansion";
import { publicationIssue } from "@/lib/ingestion/publication";
import { discoveryObservation } from "@/lib/discovery/daily-discovery";
import type { DiscoveryTarget } from "@/lib/discovery/watchlist";
const now = new Date("2026-10-30T18:00:00Z");
const sources = expansionSources().map(source => ({ ...source, active: true }));
const htmlFor = (id: string) => readFileSync(new URL(`./fixtures/expansion/${id}.html`, import.meta.url), "utf8");
it.each(sources)("validates exact audited scope and closes expired events/registration for $id", source => {
 const html = htmlFor(source.id), candidates = normalizeExpansion(html, source, now);
 expect(candidates.length).toBeGreaterThan(0);
 for (const candidate of candidates) {
  if (candidate.title.includes("inscrições gerais")) { expect(candidate.opportunityStatus).toBe("unknown"); continue; }
  expect(candidate.opportunityStatus).toBe("open");
  expect(publicationIssue(candidate, source, now)).toBeNull();
 }
 expect(normalizeExpansion(html, source, new Date("2028-01-01T12:00:00Z")).every(candidate => candidate.opportunityStatus === "closed")).toBe(true);
 expect(() => normalizeExpansion(html, { ...source, baseUrl: "https://untrusted.example/" }, now)).toThrow();
});
it("keeps restricted/future school windows and ocean modalities separate, without publishing unknown windows", () => {
 const source = sources.find(s => s.id === "exp-obapo-2027")!;
 const [renewal, general] = normalizeExpansion(htmlFor(source.id), source, now);
 expect(renewal.applicantType).toBe("institution"); expect(renewal.requirementsText).toContain("2025 ou 2026");
 expect(general.opportunityStatus).toBe("unknown");
 expect(publicationIssue(general, source, now)).toBe("status_unconfirmed");
 expect(normalizeExpansion(htmlFor(source.id), source, new Date("2026-11-21T12:00:00Z")).map(c => c.opportunityStatus)).toEqual(["closed","open"]);
 const ocean = sources.find(s => s.id === "exp-oceano-2026")!;
 expect(normalizeExpansion(htmlFor(ocean.id), ocean, now).map(c => [c.deadlineAt,c.applicantType])).toEqual([["2026-11-20","professor"],["2026-12-10","mixed"]]);
});
it("does not mistake an RSVP, a learning day or service credits for competition entry or cash", () => {
 const hack = sources.find(s=>s.id === "exp-luma-hackbr-2026")!, shiva = sources.find(s=>s.id === "exp-luma-shiva-2026")!;
 const [launch] = normalizeExpansion(htmlFor(hack.id),hack,now), [day] = normalizeExpansion(htmlFor(shiva.id),shiva,now);
 expect(launch.categories).toEqual(["eventos"]); expect(launch.requirementsText).toContain("não inscreve o time");
 expect(day.categories).toEqual(["eventos"]); expect(day.amountText).toContain("sem prêmio");
 expect(day.requirementsText).toContain("aprovação");
});
it("uses available paid tickets, rejects missing price/registration evidence and closes sold-out/waitlist events", () => {
 const source = sources.find(s=>s.id === "exp-luma-platform-2026")!, html=htmlFor(source.id);
 const [paid]=normalizeExpansion(html,source,now);
 expect(paid.amountText).toContain("BRL 399.00"); expect(paid.amountText).not.toContain("Inscrição gratuita");
 expect(normalizeExpansion(html.replaceAll('https://schema.org/InStock','https://schema.org/SoldOut'),source,now)[0].opportunityStatus).toBe("closed");
 expect(normalizeExpansion(html.replace('Get Ticket','Join Waitlist'),source,now)[0].opportunityStatus).toBe("closed");
 expect(() => normalizeExpansion(html.replace('<button>Get Ticket</button>',''),source,now)).toThrow("Disponibilidade");
 expect(() => normalizeExpansion(html.replace('"price": 399','"price": null'),source,now)).toThrow("Disponibilidade");
});
it("updates Luma dates automatically without including attendees, hydration data or private addresses", () => {
 const source=sources.find(s=>s.id === "exp-luma-womakers-2026")!, html=htmlFor(source.id);
 const [original]=normalizeExpansion(html,source,now);
 const [updated]=normalizeExpansion(html.replaceAll('2026-12-03','2026-12-04')+'<script id="__NEXT_DATA__">{"email":"fixture@example.invalid","privateAddress":"PRIVATE-STREET"}</script>',source,now);
 expect(updated.eventStartsAt).toContain("2026-12-04"); expect(updated.contentHash).not.toBe(original.contentHash);
 expect(JSON.stringify(updated)).not.toMatch(/fixture@example|PRIVATE-STREET/);
 expect(() => normalizeExpansion(html.replace('https://luma.com/womakerscode','https://luma.com/unverified'),source,now)).toThrow();
 expect(() => normalizeExpansion(html.replaceAll('São Paulo','Rio de Janeiro'),source,now)).toThrow();
 expect(() => normalizeExpansion(html.replace('2026-12-03T09:30:00.000-03:00','2026-12-03T09:30:00'),source,now)).toThrow();
});
it("records stable meaningful observations while ignoring scripts/counters, and detects same-URL edition changes", () => {
 const target={ official_url:"https://example.edu.br/" } as DiscoveryTarget;
 const html='<main>Olimpíada 2026: inscrições encerradas</main><div class="countdown">20</div>';
 const first=discoveryObservation(html,target);
 expect(discoveryObservation(html.replace('>20<','>19<')+'<script>random=12</script>',target).hash).toBe(first.hash);
 expect(discoveryObservation(html.replace('encerradas','abertas'),target).hash).not.toBe(first.hash);
});
it("has distinct identifiers, HTTPS scopes, explicit pending identities and at least 88 scientific olympiad identities", () => {
 expect(targets.filter(t=>t.scientific_olympiad).length).toBeGreaterThanOrEqual(88);
 expect(new Set(targets.map(t=>t.id)).size).toBe(targets.length);
 expect(targets.every(t=>/^[a-z0-9][a-z0-9-]{0,79}$/.test(t.id) && t.url.startsWith('https://') && !/[?&]authuser=/.test(t.url))).toBe(true);
 expect(targets.some(t=>!t.identity_reviewed)).toBe(true);
 expect(expansionSources().every(s=>!s.active)).toBe(true);
});

it("does not let closed sibling modalities close Educators/WOA, but honors explicit modality closure", () => {
 const source=sources.find(s=>s.id==='exp-oceano-2026')!, html=htmlFor(source.id);
 expect(normalizeExpansion(html.replace('</article>','<p>Inscrições encerradas para Conhecimento, Projetos e Produções.</p></article>'),source,now).map(c=>c.opportunityStatus)).toEqual(['open','open']);
 expect(normalizeExpansion(html.replace('</article>','<p>Educadores que Inspiram: inscrições encerradas.</p></article>'),source,now).map(c=>c.opportunityStatus)).toEqual(['closed','open']);
 const [closed]=normalizeExpansion(html.replace('</article>','<p>Educadores que Inspiram: inscrições encerradas.</p></article>'),source,now);
 expect(closed.evidenceJson.opportunity_status.excerpt).toBe('Educadores que Inspiram: inscrições encerradas');
 expect(normalizeExpansion(html.replace('</article>','<p>Inscrições encerradas para Educadores que Inspiram.</p></article>'),source,now)[0].opportunityStatus).toBe('closed');
});
it("uses the PMI main event in December while preserving the November registration deadline", () => {
 const source=sources.find(s=>s.id==='exp-pmi-impacto-2026')!;
 const [candidate]=normalizeExpansion(htmlFor(source.id),source,new Date('2026-11-08T12:00:00Z'));
 expect(candidate.eventStartsAt).toBe('2026-12-12'); expect(candidate.deadlineAt).toBe('2026-11-09'); expect(candidate.opportunityStatus).toBe('open');
});

it("preserves incomplete Luma metadata as an extraction failure instead of inventing closure",()=>{
 const source=sources.find(s=>s.id==='exp-luma-womakers-2026')!, html=htmlFor(source.id);
 const marker='<script type="application/ld+json">', start=html.indexOf(marker)+marker.length, end=html.indexOf('</script>',start);
 const event=JSON.parse(html.slice(start,end)); delete event.offers;
 expect(()=>normalizeExpansion(html.slice(0,start)+JSON.stringify(event)+html.slice(end),source,now)).toThrow('Disponibilidade');
 expect(()=>normalizeExpansion(html.replace('<button>Request to Join</button>','<button disabled>Request to Join</button>'),source,now)).toThrow('Disponibilidade');
});
