import { readFileSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
import { singleOpportunityArticle, normalizeDiscoveredPage, discoveredPageFailureReason } from '@/lib/ingestion/discovered-page';
import { publicationIssue } from '@/lib/ingestion/publication';
import { relevantOpportunityContent } from '@/lib/ingestion/normalize-opportunity';
import type { OfficialSource } from '@/lib/ingestion/types';

const fixture = readFileSync(new URL('./fixtures/pucpr-broadway-service-20261109.html', import.meta.url), 'utf8');
const source: OfficialSource = { id: 'auto-page-ten-links', name: 'Evento universitário',
  institutionName: 'Pontifícia Universidade Católica do Paraná', institutionAcronym: '', sourceType: 'official_reference',
  baseUrl: 'https://www.pucpr.br/pucpr-cultura/concerto/', allowedDomains: ['www.pucpr.br'],
  allowedPathPrefixes: ['/pucpr-cultura/concerto/'], listingUrls: [], extractionMode: 'html',
  audienceScope: [], geographicScope: [], categories: ['competicoes', 'eventos'], active: true, priority: 0 };
afterEach(() => vi.useRealTimers());
const today = () => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-09T17:00:00Z')); };

it('isolates the sole WordPress post from separate recommendation cards', () => {
  const article = singleOpportunityArticle(fixture);
  expect(article?.title).toBe('Broadway: Um Encontro Musical encerra o Circuito Cultural PUCPR 2026');
  expect(article?.text).not.toContain('2100');
  expect(singleOpportunityArticle(fixture.replace('<h3>Outra notícia recomendada</h3>', '<h1>Outra oportunidade</h1>'))).toBeNull();
  expect(singleOpportunityArticle(fixture.replace('single single-post', 'archive'))).toBeNull();
});

it.each([
  '<body class="single-post"><div class="elementor-location-single"><div class="elementor-widget-theme-post-title"><h1>Bolsa de pesquisa</h1></div><div class="elementor-widget-theme-post-content"><p>Inscrições abertas até 31/12/2099 pelo formulário de inscrição.</p></div></div></body>',
  '<body class="single-post"><div id="primary"><div id="post-123"><div class="post-detail-holder"><h1 class="entry-title">Bolsa de pesquisa</h1><div class="entry-content"><p>Inscrições abertas até 31/12/2099 pelo formulário de inscrição.</p></div></div><div class="related-post"><article><h1>Outra ficha</h1></article></div></div></div></body>',
])('reads bounded WordPress title/body widgets without borrowing metadata or related posts', html => {
  expect(normalizeDiscoveredPage(html, source)).toMatchObject({ title: 'Bolsa de pesquisa', deadlineAt: '2099-12-31' });
  expect(singleOpportunityArticle(html.replace('</body>', '<div class="elementor-location-single"><h1>Outra ficha</h1></div></body>'))).toBeNull();
});

it('recognizes an explicit event service and current ticket link without inventing a closing date or timezone', () => {
  today();
  const candidate = normalizeDiscoveredPage(fixture, source);
  expect(candidate).toMatchObject({ categories: ['eventos'], benefitType: 'other',
    eventStartsAt: '2026-11-12', deadlinePrecision: 'not_informed', opportunityStatus: 'open',
    applicationRoute: 'direct_application', applicationUrl: 'https://pucpr.app/concerto-broadway',
    stateCode: null, cityName: null, nationallyEligible: false });
  expect(candidate?.deadlineAt).toBeUndefined();
  expect(candidate?.evidenceJson.registration_availability.excerpt).toContain('Retire pelo Sympla');
  expect(publicationIssue(candidate!, source)).toBeNull();
});

it.each([
  ['no audited event topic', (s: string) => s, { ...source, categories: ['bolsas'] }],
  ['missing year', (s: string) => s.replace('12 de novembro de 2026', '12 de novembro'), source],
  ['invalid date', (s: string) => s.replace('12 de novembro de 2026', '31 de novembro de 2026'), source],
  ['publication date alone', (s: string) => s.replace('<strong>Data:</strong>', '<strong>Publicado em:</strong>'), source],
  ['multiple service dates', (s: string) => s.replace('<strong>Horário:</strong>', '<strong>Data:</strong> 13/11/2026<br/><strong>Horário:</strong>'), source],
  ['ambiguous date range', (s: string) => s.replace('12 de novembro de 2026 (quinta-feira)', '12/11/2026 ou 13/11/2026'), source],
  ['different edition', (s: string) => s.replace('<strong>Broadway: Um Encontro Musical</strong>', '<strong>Outro concerto</strong>'), source],
  ['missing ticket action', (s: string) => s.replace('Retire pelo Sympla', 'Saiba mais'), source],
  ['disabled ticket link', (s: string) => s.replace('target="_blank"', 'aria-disabled="true"'), source],
  ['unsafe ticket URL', (s: string) => s.replaceAll('https://pucpr.app/concerto-broadway', 'http://127.0.0.1/ticket'), source],
  ['malformed stated deadline', (s: string) => s.replace('</article>', '<p>Inscrições até 31/02/2027.</p></article>'), source],
  ['ticket closing date needing separate evidence', (s: string) => s.replace('Gratuita, com ingressos limitados', 'Gratuita. Ingressos até 31/02/2027'), source],
] satisfies [string, (s: string) => string, OfficialSource][])('keeps incomplete or ambiguous event evidence private: %s', (_label, change, officialSource) => {
  today(); expect(normalizeDiscoveredPage(change(fixture), officialSource)).toBeNull();
});

it.each(['Ingressos esgotados.', 'Evento cancelado.', 'Retirada de ingressos encerrada.'])('never publishes a terminal ticket notice: %s', notice => {
  today();
  const candidate = normalizeDiscoveredPage(fixture.replace('</article>', `<p>${notice}</p></article>`), source);
  expect(candidate && publicationIssue(candidate, source)).toBeTruthy();
});

it('withdraws a date-only ticketed event conservatively when its confirmed day starts in Brazil', () => {
  today(); const candidate = normalizeDiscoveredPage(fixture, source)!;
  expect(publicationIssue(candidate, source, new Date('2026-11-12T03:00:00Z'))).toBe('invalid_deadline');
});

it('reports an excluded public-service recruitment result as irrelevant instead of a broken deadline', () => {
  expect(discoveredPageFailureReason('<main><h1>Concurso Público da Educação: Resultado Definitivo</h1><p>Respostas aos recursos da avaliação de títulos.</p></main>')).toBe('irrelevant_link');
});

it('does not let service fields override the existing editorial exclusions', () => {
  today();
  expect(normalizeDiscoveredPage(fixture.replaceAll('Broadway: Um Encontro Musical', 'Concurso Público da Educação'), source)).toBeNull();
  expect(relevantOpportunityContent('Resultado', 'Concurso\npúblico com oportunidade')).toBe(false);
});

it('never turns a WordPress publication date next to an incomplete deadline into the closing date', () => {
  const html = '<main><h1>Concurso cultural de cartuns</h1><p>Inscrições abertas até 9 de agosto</p>' +
    '<div class="section__page__hero__meta"><div class="section__page__hero__meta--date">03/06/2099</div></div>' +
    '<p>Inscreva-se pelo formulário de inscrição.</p></main>';
  expect(singleOpportunityArticle(html)?.text).not.toContain('03/06/2099');
  expect(normalizeDiscoveredPage(html, source)).toBeNull();
  expect(discoveredPageFailureReason(html)).toBe('invalid_deadline');
});

it('does not bypass a malformed ticket-service date through the generic event fallback', () => {
  today();
  const html = fixture.replaceAll('Broadway: Um Encontro Musical', 'Encontro de empreendedorismo')
    .replace('12 de novembro de 2026', '31 de novembro de 2026')
    .replace('</article>', '<p>Inscrições abertas pelo formulário de inscrição. Data do evento: 13/11/2026.</p></article>');
  expect(normalizeDiscoveredPage(html, source)).toBeNull();
});
