import { afterEach, expect, it, vi } from 'vitest';
import { detectDeadline } from '@/lib/ingestion/detect-deadline';
import { singleOpportunityArticle, normalizeDiscoveredPage, discoveredPageFailureReason } from '@/lib/ingestion/discovered-page';
import { publicationIssue } from '@/lib/ingestion/publication';
import type { OfficialSource } from '@/lib/ingestion/types';

// Minimal structures observed on official pages on 2026-11-09. Dates in the
// positive examples are synthetic; this does not assert those pages are open.
const title = 'Bolsa de pesquisa';
const source: OfficialSource = { id: 'auto-page-format-deadline-test', name: 'Chamadas',
  institutionName: 'Instituto oficial', institutionAcronym: '', sourceType: 'official_reference',
  baseUrl: 'https://official.example.org/bolsa', allowedDomains: ['official.example.org'],
  allowedPathPrefixes: ['/bolsa'], listingUrls: [], extractionMode: 'html',
  audienceScope: [], geographicScope: [], categories: ['bolsas'], active: true, priority: 0 };
const content = '<p>Inscrições abertas até 31.12.2099. Inscreva-se pelo formulário de inscrição.</p>';
const layouts = [
  { name: 'BeTheme', render: (body: string) => `<body class="single-post"><div id="Subheader"><h1 class="title">${title}</h1></div><div id="Content"><div class="post-wrapper-content"><div class="the_content_wrapper">${body}</div></div></div></body>` },
  { name: 'Astra', render: (body: string) => `<body class="single-post ast-single-post"><div class="ast-single-entry-banner"><h1 class="entry-title">${title}</h1></div><main class="site-main"><article><div class="entry-content">${body}</div></article></main></body>` },
  { name: 'Neve', render: (body: string) => `<body id="neve_body" class="wp-singular"><div class="nv-post-cover"><h1 class="entry-title">${title}</h1></div><main id="content"><div class="nv-content-wrap entry-content">${body}</div></main></body>` },
  { name: 'ABDC', render: (body: string) => `<body><section id="interna"><div class="container noticia"><h2>Notícias</h2><h3>${title}</h3><span class="data">09.11.2026</span><div class="texto">${body}</div></div></section></body>` },
  { name: 'OBMEP', render: (body: string) => `<body><div id="outer-body"><div id="inner-content"><div class="center-content"><h1>${title}</h1>${body}</div></div></div></body>` },
];
afterEach(() => vi.useRealTimers());

it.each(layouts)('reads one bounded detail in $name and excludes dates outside it', ({ render }) => {
  const html = render(content).replace('</body>', '<div><h1>Outra chamada</h1><p>Inscrições até 31/12/2100.</p></div></body>');
  expect(singleOpportunityArticle(html)).toMatchObject({ title });
  expect(singleOpportunityArticle(html)?.text).not.toMatch(/2100|09\.11\.2026/);
  const candidate = normalizeDiscoveredPage(html, source);
  expect(candidate).toMatchObject({ title, deadlineAt: '2099-12-31', deadlinePrecision: 'date_only' });
  expect(publicationIssue(candidate!, source)).toBeNull();
});

it.each(layouts)('rejects multiple $name detail bodies and conflicting headings', ({ render }) => {
  expect(singleOpportunityArticle(render(content + '<h1>Outra bolsa</h1>'))).toBeNull();
  expect(singleOpportunityArticle(render(content) + render(content))).toBeNull();
});

it('does not use an ABDC news date as the deadline of an incomplete registration period', () => {
  const html = layouts[3].render('<p>Inscrições abertas até 9 de novembro pelo formulário de inscrição.</p>');
  expect(normalizeDiscoveredPage(html, source)).toBeNull();
  expect(discoveredPageFailureReason(html)).toBe('invalid_deadline');
});

it('separates calendar cells and preserves the closing hour after a weekday', () => {
  const html = layouts[1].render('<table><tr><td>Abertura das inscrições</td><td>09/01/2099</td></tr>' +
    '<tr><td>Encerramento das inscrições</td><td>26/01/2099 (Segunda-Feira) às 12:00 (Doze horas)</td></tr>' +
    '<tr><td>Realização da prova</td><td>27/01/2099 às 19:00</td></tr>' +
    '<tr><td>Divulgação do resultado</td><td>29/01/2099</td></tr></table><p>Inscrições abertas pelo formulário de inscrição.</p>');
  const candidate = normalizeDiscoveredPage(html, source);
  expect(candidate).toMatchObject({ deadlineAt: '2099-01-26T12:00:00-03:00', deadlinePrecision: 'exact_datetime' });
  expect(publicationIssue(candidate!, source, new Date('2099-01-26T15:00:01Z'))).toBe('invalid_deadline');
});

it.each([
  ['Inscrições de 9 de março a 5 de maio de 2099.', '2099-05-05'],
  ['Inscrições: 09/03 a 05/05/2099.', '2099-05-05'],
  ['É possível se inscrever até 31.12.2099 pelo formulário de inscrição.', '2099-12-31'],
  ['Interessados podem se candidatar até 31/12/2099.', '2099-12-31'],
])('reads an explicitly stated endpoint: %s', (text, deadlineAt) => {
  expect(detectDeadline(text)).toMatchObject({ deadlineAt, precision: 'date_only' });
});

it.each([
  'Inscrições abertas até 9 de novembro. Publicado em 23/10/2099.',
  'Inscrições abertas pelo formulário. Data do evento: 31/12/2099.',
  'Inscrições de 9 de março a 5 de maio.',
  'Inscrições até 31.02.2099.',
  'Inscrições até 31/12/2099 (Segunda-Feira) às 25:00.',
  'Inscrições até 30/12/2099 ou até 31/12/2099.',
])('retains incomplete, malformed or conflicting deadlines: %s', text => {
  expect(detectDeadline(text).precision).toBe('not_informed');
});

it('keeps a genuinely expired calendar private after recognizing its format', () => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-09T20:00:00Z'));
  expect(discoveredPageFailureReason(layouts[1].render(content.replace('31.12.2099', '26/01/2026')))).toBe('expired');
});

it('reports explicit closed registrations as status instead of a malformed deadline', () => {
  const html = '<main><h1>Inscrições da Olimpíada de Ilustração Científica</h1><p>Inscrições para Participantes: Encerradas.</p></main>';
  expect(normalizeDiscoveredPage(html, source)).toBeNull();
  expect(discoveredPageFailureReason(html)).toBe('status_unconfirmed');
});

it('does not confuse a conditional cancellation policy with a cancelled offer', () => {
  expect(discoveredPageFailureReason(layouts[0].render('<p>Inscrições abertas até 9 de novembro.</p><p>Em caso de cancelamento do curso haverá reembolso.</p>'))).toBe('invalid_deadline');
});
