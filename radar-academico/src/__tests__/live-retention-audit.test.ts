import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import { fetchOfficialResource } from '@/lib/ingestion/fetch-source';
import { singleOpportunityArticle, normalizeDiscoveredPage, discoveredPageFailureReason } from '@/lib/ingestion/discovered-page';
import { detectDeadline } from '@/lib/ingestion/detect-deadline';
import { detectOpportunityStatus, publicationIssue } from '@/lib/ingestion/publication';
import { classifyApplicationRoute } from '@/lib/ingestion/classify-application-route';
import type { OfficialSource } from '@/lib/ingestion/types';

// Explicit read-only operator audit. Uses public HTTPS evidence and the production
// transport policy; never opens a DB connection or persists/publishes a candidate.
it.skipIf(!process.env.RADAR_RETENTION_AUDIT_SAMPLE)('explains a bounded sample of public-page extraction failures', async () => {
  const samples = JSON.parse(await readFile(process.env.RADAR_RETENTION_AUDIT_SAMPLE!, 'utf8')) as { url: string; organizer: string; categories?: string[] }[];
  expect(samples.length).toBeGreaterThan(0); expect(samples.length).toBeLessThanOrEqual(8);
  const folder = process.env.RADAR_RETENTION_AUDIT_OUTPUT!;
  await mkdir(folder, { recursive: true });
  const results = [];
  for (const sample of samples) {
    const url = new URL(sample.url);
    const source: OfficialSource = { id: 'auto-page-public-audit', name: 'Read-only public audit', institutionName: sample.organizer,
      institutionAcronym: '', sourceType: 'official_reference', baseUrl: sample.url, allowedDomains: [url.hostname],
      allowedPathPrefixes: [url.pathname], listingUrls: [sample.url], extractionMode: 'html', audienceScope: [],
      geographicScope: [], categories: sample.categories ?? [], priority: 0, active: true };
    try {
      const file = createHash('sha256').update(sample.url).digest('hex').slice(0, 12) + '.html';
      const replay = process.env.RADAR_RETENTION_AUDIT_REPLAY;
      const captured = replay ? await readFile(replay + '/' + file) : null;
      const resource = captured ? { body: captured, hash: createHash('sha256').update(captured).digest('hex') } :
        await fetchOfficialResource(sample.url, source, 2 * 1024 * 1024);
      const html = resource.body.toString('utf8'), $ = cheerio.load(html);
      const article = singleOpportunityArticle(html);
      const candidate = normalizeDiscoveredPage(html, source);
      await writeFile(folder + '/' + file, resource.body);
      results.push({ url: sample.url, file, hash: resource.hash, bytes: resource.body.length,
        structure: { h1: $('h1').length, main: $('main,[role="main"]').length, articles: $('article').length,
          entryTitle: $('.entry-title').length, entryContent: $('.entry-content').length, headings: $('h1,h2,h3').toArray().slice(0,12).map(n => $(n).text().trim()) },
        article: article ? { title: article.title, characters: article.text.length } : null,
        signals: article ? { deadline: detectDeadline(article.text), status: detectOpportunityStatus(article.text), route: classifyApplicationRoute(article.text) } : null,
        failureReason: candidate ? null : discoveredPageFailureReason(html),
        candidate: candidate ? { title: candidate.title, deadline: candidate.deadlineAt, precision: candidate.deadlinePrecision,
          status: candidate.opportunityStatus, route: candidate.applicationRoute, eventStartsAt: candidate.eventStartsAt,
          applicationUrl: candidate.applicationUrl, issue: publicationIssue(candidate, source) } : null });
    } catch (error) { results.push({ url: sample.url, error: error instanceof Error ? error.message : 'fetch_failed' }); }
  }
  await writeFile(folder + '/report.json', JSON.stringify({ checkedAt: new Date().toISOString(), readOnly: true, results }, null, 2));
  console.log(JSON.stringify(results));
}, 240_000);
