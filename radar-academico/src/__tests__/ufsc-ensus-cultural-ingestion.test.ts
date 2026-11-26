import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { prepareDiscoveredPage } from '@/lib/ingestion/international-discovered-page';
import { publicationIssue } from '@/lib/ingestion/publication';
import type { OfficialSource } from '@/lib/ingestion/types';
import { UFSC_DAC_PERFORMANCE_URL, UFSC_ENSUS_URL, UFSC_SECARTE_PERFORMANCE_URL } from '@/lib/ingestion/ufsc-discovery-policy';

const now = new Date('2026-11-22T22:00:00Z');
const ensusLink = 'https://www.even3.com.br/ensus-2027-783898/';
function source(baseUrl: string): OfficialSource {
  const url = new URL(baseUrl);
  return { id: 'auto-page-verified-ufsc', name: 'UFSC', institutionName: 'UFSC', institutionAcronym: 'UFSC',
    sourceType: 'federal_university', baseUrl, allowedDomains: [url.hostname], allowedPathPrefixes: [url.pathname],
    listingUrls: [baseUrl], extractionMode: 'html', audienceScope: [], geographicScope: [], categories: ['eventos'], priority: 50, active: true };
}
const detail = (title: string, body: string) => `<div id="content"><article class="post" id="post-42"><h2>${title}</h2><div class="content">${body}</div></article></div>`;
const ensus = (url = ensusLink) => detail('ENSUS 2027 abre inscrições e submissão de trabalhos científicos', `
  <p>Estão abertas as submissões de trabalhos para o XV Encontro de Sustentabilidade em Projeto (ENSUS 2027).</p>
  <ul><li>Prazo para submissão de trabalhos: 22 de janeiro de 2027;</li><li>Realização do evento: 24 a 26 de maio de 2027.</li></ul>
  <p>As orientações para submissão estão no site oficial do evento: <a href="${url}">Even3</a>.</p>`);
const culture = (access: string) => detail('Performance “Nada Será Devolvido em Silêncio”', `
  <p>O evento é realizado pela UFSC.</p><p>O quê: Performance Nada Será Devolvido em Silêncio<br>
  Quando: 27/11/2026 | sexta-feira | 10h<br>Onde: Teatro Carmen Fossari, Florianópolis – SC<br>Quanto: ${access}</p>`);

beforeEach(() => vi.setSystemTime(now));
afterEach(() => vi.useRealTimers());

it('keeps the exact ENSUS application link separate from the deadline and event dates', async () => {
  const official = source(UFSC_ENSUS_URL);
  const result = await prepareDiscoveredPage(ensus(), official);
  expect(result).toHaveProperty('candidate');
  if (!('candidate' in result)) throw new Error(result.reason);
  expect(result.candidate).toMatchObject({ applicationUrl: ensusLink, applicationRoute: 'direct_application',
    deadlineAt: '2027-01-22', deadlinePrecision: 'date_only', eventStartsAt: '2027-05-24', opportunityStatus: 'open' });
  expect(result.candidate.discovery?.editions[0].stages[1].end).toBe('2027-05-26');
  expect(publicationIssue(result.candidate, official, now)).toBeNull();
});

it('rejects an unrelated link, a hidden link and a crossed ENSUS deadline', async () => {
  const official = source(UFSC_ENSUS_URL);
  for (const html of [ensus('https://www.even3.com.br/outro-evento/'), ensus().replace('<a href=', '<a hidden href=')]) {
    expect(await prepareDiscoveredPage(html, official)).toEqual({ reason: 'application_route_unconfirmed' });
  }
  expect(await prepareDiscoveredPage(ensus().replace('22 de janeiro', '29 de maio'), official)).toEqual({ reason: 'invalid_deadline' });
});

it.each([UFSC_SECARTE_PERFORMANCE_URL, UFSC_DAC_PERFORMANCE_URL])('publishes the explicitly open cultural event from %s', async (url) => {
  const official = source(url);
  const result = await prepareDiscoveredPage(culture('Evento gratuito e aberto a toda a comunidade'), official);
  expect(result).toHaveProperty('candidate');
  if (!('candidate' in result)) throw new Error(result.reason);
  expect(result.candidate).toMatchObject({ eventStartsAt: '2026-11-27T10:00:00-03:00', deadlinePrecision: 'not_informed', opportunityStatus: 'open', stateCode: 'SC' });
  expect(publicationIssue(result.candidate, official, now)).toBeNull();
  expect(await prepareDiscoveredPage(culture('Evento gratuito para convidados'), official)).toEqual({ reason: 'application_route_unconfirmed' });
});
