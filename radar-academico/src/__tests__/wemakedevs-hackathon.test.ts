import { readFile } from 'node:fs/promises';
import { expect, it, vi } from 'vitest';
vi.mock('@/lib/ingestion/fetch-source', () => ({ fetchOfficialResource: vi.fn() }));
import { prepareDiscoveredPage, internationalEligibilityNote, BRAZIL_ELIGIBILITY_TOPIC } from '@/lib/ingestion/international-discovered-page';
import { discoveryDocument } from '@/lib/discovery/documents';
import { publicationIssue } from '@/lib/ingestion/publication';
import type { OfficialSource } from '@/lib/ingestion/types';

const root = 'https://www.wemakedevs.org/hackathons';
const url = root + '/flagsmith';
const source: OfficialSource = {
  id: 'auto-page-wemakedevs-test', name: 'Toggle Wars', institutionName: 'WeMakeDevs', institutionAcronym: '',
  sourceType: 'official_reference', baseUrl: url, allowedDomains: ['www.wemakedevs.org'],
  allowedPathPrefixes: ['/hackathons/flagsmith'], listingUrls: [url], extractionMode: 'html',
  audienceScope: [], geographicScope: [], categories: ['competicoes','eventos'], priority: 1, active: true,
  notes: `radar:discovery-page:v1${internationalEligibilityNote([BRAZIL_ELIGIBILITY_TOPIC])}; authority=${root}`,
};
const html = await readFile(new URL('./fixtures/wemakedevs-flagsmith.html', import.meta.url), 'utf8');

it('discovers creative event names only inside the audited hackathon index', () => {
  const body = Buffer.from('<h1>Hackathons</h1><a href="/hackathons/flagsmith">Remote Nov 26–29 Toggle Wars</a><a href="/privacy">Privacy</a>');
  const links = discoveryDocument({body,contentType:'text/html'},root,root).links;
  expect(links).toMatchObject([{url,title:expect.stringContaining('Hackathon')}]);
  expect(discoveryDocument({body,contentType:'text/html'},'https://other.example.org/hackathons','https://other.example.org/hackathons').links).toEqual([]);
});

it('extracts an eligible online event without turning project submission into a registration deadline', async () => {
  const result = await prepareDiscoveredPage(html,source);
  expect(result).toHaveProperty('candidate');
  if (!('candidate' in result)) throw Error(JSON.stringify(result));
  expect(result.candidate).toMatchObject({title:'Toggle Wars: The Flagsmith Experimentation Hackathon',
    eventStartsAt:'2099-11-26',deadlinePrecision:'not_informed',geographicScopeKind:'global',countryCode:null,
    categories:['competicoes','eventos'],opportunityStatus:'open',applicationUrl:url});
  expect(result.candidate.deadlineAt).toBeUndefined();
  expect(publicationIssue(result.candidate,source)).toBeNull();
  expect(result.candidate.evidenceJson.eligibility_br.excerpt).toContain('anywhere in the world');
});

it.each([
  ['unstated year', html.replace('November 26 to 29, 2099.', 'November 26 to 29.')],
  ['invalid calendar date', html.replaceAll('November 26', 'November 31')],
  ['missing availability', html.replaceAll('<button>Register now</button>', '<button disabled>Register now</button>')],
  ['ambiguous FAQ', html.replace('</section><footer>', '<details><summary>Who can take part?</summary><p>Only accepted teams.</p></details></section><footer>')],
  ['closed registration', html.replace('</body>', '<p>Registration closed.</p></body>')],
  ['suspended registration', html.replace('</body>', '<p>Registration is suspended.</p></body>')],
  ['new registration deadline', html.replace('</body>', '<p>Registration closes on November 20, 2099.</p></body>')],
  ['cancelled event', html.replace('</body>', '<p>Hackathon is cancelled.</p></body>')],
])('retains a changed or incomplete template: %s', async (_, changed) => {
  expect(await prepareDiscoveredPage(changed,source)).not.toHaveProperty('candidate');
});

it('does not derive worldwide eligibility from the footer or from another organizer', async () => {
  expect(await prepareDiscoveredPage(html.replace('Developers from anywhere in the world.', 'Only accepted applicants.'),source))
    .toEqual({reason:'eligibility_br_unconfirmed'});
  expect(await prepareDiscoveredPage(html,{...source,institutionName:'Other organizer'})).not.toHaveProperty('candidate');
});

it('keeps explicit Brazil exclusions and linked rules authoritative', async () => {
  expect(await prepareDiscoveredPage(html.replace('</body>', '<p>Not open to residents of Brazil.</p></body>'),source))
    .toEqual({reason:'eligibility_br_excluded'});
  expect(await prepareDiscoveredPage(html.replace('</body>', '<a href="https://other.example.org/rules">Rules</a></body>'),source))
    .toEqual({reason:'eligibility_br_unconfirmed'});
});

it('does not keep a started event open and does not assign an unstated currency', async () => {
  const result=await prepareDiscoveredPage(html.replaceAll('2099','2020'),source);
  expect(result).toHaveProperty('candidate');
  if(!('candidate'in result))throw Error('Expected parsed historical event');
  expect(result.candidate.opportunityStatus).toBe('closed');
  expect(publicationIssue(result.candidate,source)).not.toBeNull();
  expect(result.candidate.amountText).not.toContain('USD');
});

it.runIf(Boolean(process.env.RADAR_WEMAKEDEVS_FIXTURE))('checks the complete captured official page without making network requests', async () => {
  const captured=await readFile(process.env.RADAR_WEMAKEDEVS_FIXTURE!, 'utf8');
  const result=await prepareDiscoveredPage(captured,source);
  expect(result).toHaveProperty('candidate');
  if(!('candidate'in result))throw Error(JSON.stringify(result));
  expect(result.candidate.eventStartsAt).toBe('2026-11-26');
  expect(publicationIssue(result.candidate,source,new Date('2026-11-14T12:00:00Z'))).toBeNull();
});

it.runIf(Boolean(process.env.RADAR_WEMAKEDEVS_INDEX))('discovers the event in the complete captured official index', async () => {
  const body=await readFile(process.env.RADAR_WEMAKEDEVS_INDEX!);
  expect(discoveryDocument({body,contentType:'text/html'},root,root).links.some(link=>link.url===url)).toBe(true);
});
