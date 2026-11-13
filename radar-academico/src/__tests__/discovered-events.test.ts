import { expect, it } from 'vitest';
import { normalizeDiscoveredPage } from '@/lib/ingestion/discovered-page';
import { publicationIssue } from '@/lib/ingestion/publication';
import type { OfficialSource } from '@/lib/ingestion/types';

const parent = 'https://institute.example.org/events';
const source: OfficialSource = {
  id: 'auto-page-test', name: 'Workshop de tecnologia', institutionName: 'Instituto de Tecnologia',
  institutionAcronym: '', sourceType: 'official_reference', baseUrl: 'https://institute.example.org/workshop',
  allowedDomains: ['institute.example.org'], allowedPathPrefixes: ['/workshop'], listingUrls: ['https://institute.example.org/workshop'], extractionMode: 'html',
  audienceScope: [], geographicScope: [], categories: [], priority: 1, active: true,
  notes: `radar:discovery-page:v1; target=test; authority=${parent}`,
};
function page(change: Record<string, unknown> = {}, luma = false) {
  const event = { '@type': 'EducationEvent', name: source.name, url: luma ? 'https://luma.com/workshop' : source.baseUrl,
    startDate: '2099-12-01T09:00:00-03:00', endDate: '2099-12-01T12:00:00-03:00',
    eventStatus: 'https://schema.org/EventScheduled',
    organizer: { '@type': 'Organization', name: source.institutionName, url: parent },
    description: 'Workshop de tecnologia e carreira. Consulte as condições de participação.',
    location: { '@type': 'Place', address: { addressCountry: 'BR', addressRegion: 'Santa Catarina', addressLocality: 'Florianópolis' } },
    offers: { '@type': 'Offer', url: luma ? 'https://luma.com/workshop' : source.baseUrl,
      price: '0', priceCurrency: 'BRL', availability: 'https://schema.org/InStock' }, ...change };
  return `<html><head><script type="application/ld+json">${JSON.stringify(event)}</script></head><body>
    <main><h1>${event.name}</h1><a href="${event.url}">Inscreva-se</a><button>Register</button></main></body></html>`;
}
it('publishes one structured educational event with evidenced location outside SP and RJ', () => {
  const candidate = normalizeDiscoveredPage(page(), source);
  expect(candidate).toMatchObject({ title: 'Workshop de tecnologia', stateCode: 'SC', cityName: 'Florianópolis',
    eventStartsAt: '2099-12-01T09:00:00-03:00', opportunityStatus: 'open', deadlinePrecision: 'not_informed' });
  expect(publicationIssue(candidate!, source)).toBeNull();
});
it('keeps a space hackathon in both event and competition categories and adds astronomy',()=>{
  const candidate=normalizeDiscoveredPage(page({name:'Hackathon de Astronomia'}),source)!;
  expect(candidate).toMatchObject({categories:['competicoes','eventos'],
    discovery:{primaryType:'competicoes',subtype:'hackathon',areas:['astronomia']}});
  expect(publicationIssue(candidate,source)).toBeNull();
});
it('accepts a verified Luma organizer in another Brazilian state', () => {
  const luma = { ...source, baseUrl: 'https://luma.com/workshop', allowedDomains: ['luma.com'], allowedPathPrefixes: ['/workshop'], listingUrls: ['https://luma.com/workshop'] };
  const candidate = normalizeDiscoveredPage(page({ '@type': 'Event' }, true), luma);
  expect(candidate).toMatchObject({ stateCode: 'SC', cityName: 'Florianópolis', opportunityStatus: 'open' });
  expect(publicationIssue(candidate!, luma)).toBeNull();
});
it('keeps online event location unknown instead of inventing a city or state', () => {
  const candidate = normalizeDiscoveredPage(page({ eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
    location: { '@type': 'VirtualLocation', url: 'https://video.example.org/room' } }), source);
  expect(candidate).toMatchObject({ stateCode: null, cityName: null, opportunityStatus: 'open' });
  expect(publicationIssue(candidate!, source)).toBeNull();
});
it('does not grant an unrelated organizer authority through an institutional agenda', () => {
  expect(normalizeDiscoveredPage(page({ organizer: { name: 'Another organizer', url: 'https://other.example.org/' } }), source)).toBeNull();
});
it('does not accept the generic gov.br root as proof of one specific agency', () => {
  const agency = { ...source, institutionName: 'CNPq', notes: 'radar:discovery-page:v1; target=test; authority=https://www.gov.br/cnpq/chamadas' };
  expect(normalizeDiscoveredPage(page({ organizer: { name: 'CNPq', url: 'https://www.gov.br/' } }), agency)).toBeNull();
});
it('accepts the canonical agency path as proof of the verified organizer', () => {
  const agency = { ...source, institutionName: 'CNPq', notes: 'radar:discovery-page:v1; target=test; authority=https://www.gov.br/cnpq/chamadas' };
  expect(normalizeDiscoveredPage(page({ organizer: { name: 'CNPq', url: 'https://www.gov.br/cnpq/' } }), agency))
    .toMatchObject({ institution: 'CNPq', opportunityStatus: 'open' });
});
it('does not mistake an unconfirmed offer for open registration', () => {
  expect(normalizeDiscoveredPage(page({ offers: { url: source.baseUrl, price: 0, priceCurrency: 'BRL' } }), source)).toBeNull();
});
it('ignores a malformed registration link while retaining the correctly evidenced offer', () => {
  const candidate = normalizeDiscoveredPage(page().replace('<main>', '<main><a href="https://[">Inscreva-se</a>'), source);
  expect(candidate?.opportunityStatus).toBe('open');
});
it('preserves confirmed sold out status instead of publishing it as open', () => {
  const candidate = normalizeDiscoveredPage(page({ offers: { url: source.baseUrl, price: 0, priceCurrency: 'BRL',
    availability: 'https://schema.org/SoldOut' } }), source);
  expect(candidate?.opportunityStatus).toBe('closed');
});
it('withdraws a waitlisted event instead of treating its stale InStock metadata as open', () => {
  const candidate = normalizeDiscoveredPage(page().replace('Register</button>', 'Join Waitlist</button>'), source);
  expect(candidate?.opportunityStatus).toBe('closed');
});
it('withdraws an explicitly closed registration even when offer metadata remains InStock', () => {
  const candidate = normalizeDiscoveredPage(page().replace('</main>', '<p>Registration Closed</p></main>'), source);
  expect(candidate?.opportunityStatus).toBe('closed');
});
it('records a material change when registration starts requiring organizer approval', () => {
  const direct = normalizeDiscoveredPage(page(), source);
  const approved = normalizeDiscoveredPage(page().replace('Register</button>', 'Request to Join</button>'), source);
  expect(approved?.requirementsText).toContain('sujeito à aprovação do organizador');
  expect(approved?.contentHash).not.toBe(direct?.contentHash);
});
it('records a changed registration deadline even when all structured event metadata stays the same', () => {
  const first = normalizeDiscoveredPage(page().replace('</main>', '<p>Inscrições abertas até 29/11/2099.</p></main>'), source);
  const second = normalizeDiscoveredPage(page().replace('</main>', '<p>Inscrições abertas até 30/11/2099.</p></main>'), source);
  expect(first?.deadlineAt).toBe('2099-11-29');
  expect(second?.deadlineAt).toBe('2099-11-30');
  expect(second?.contentHash).not.toBe(first?.contentHash);
});
it('does not copy attendee profile text into event evidence or its hash input', () => {
  const candidate = normalizeDiscoveredPage(page().replace('<main>', '<main><div class="attendees">AttendeePrivateFixtureName</div>'), source);
  expect(candidate?.opportunityStatus).toBe('open');
  expect(JSON.stringify(candidate)).not.toContain('AttendeePrivateFixtureName');
});
it('extracts a unique opportunity from semantic main without requiring an article tag', () => {
  const candidate = normalizeDiscoveredPage('<main><h1>Bolsa de pesquisa em tecnologia</h1><p>Inscrições abertas até 31/12/2099.</p><p>Estudantes de graduação podem participar. Inscreva-se pelo formulário de inscrição.</p></main>', source);
  expect(candidate?.title).toBe('Bolsa de pesquisa em tecnologia');
  expect(publicationIssue(candidate!, source)).toBeNull();
});
