import { expect, it } from 'vitest';
import { detectDeadline } from '@/lib/ingestion/detect-deadline';
import { detectOpportunityStatus, publicationIssue } from '@/lib/ingestion/publication';
import { normalizeDiscoveredPage, singleOpportunityArticle, discoveredPageFailureReason } from '@/lib/ingestion/discovered-page';
import type { OfficialSource } from '@/lib/ingestion/types';

const source: OfficialSource = { id: 'auto-page-regression', name: 'Chamada oficial', institutionName: 'Instituição oficial',
  institutionAcronym: '', sourceType: 'official_reference', baseUrl: 'https://official.example.org/call',
  allowedDomains: ['official.example.org'], allowedPathPrefixes: ['/call'], listingUrls: ['https://official.example.org/call'],
  extractionMode: 'html', audienceScope: [], geographicScope: [], categories: ['bolsas'], active: true, priority: 0 };
const body = '<p>Inscrições abertas até 10 de novembro de 2099 pelo formulário de inscrição. Estudantes de graduação podem participar.</p>';

it('reads explicit written dates without deriving a year from publication or event dates', () => {
  expect(detectDeadline('Inscrições abertas até 10 de novembro de 2099, às 23h59.'))
    .toEqual({ deadlineAt: '2099-11-10T23:59:00-03:00', precision: 'exact_datetime' });
  expect(detectDeadline('Prazo de candidaturas: 1º de março de 2099.'))
    .toEqual({ deadlineAt: '2099-03-01', precision: 'date_only' });
  expect(detectDeadline('A data limite para a submissão das propostas é até 6 de novembro de 2023.'))
    .toEqual({ deadlineAt: '2023-11-06', precision: 'date_only' });
  expect(discoveredPageFailureReason('<main><h1>Chamada de pesquisa</h1><p>Submissão até 6 de novembro de 2023.</p></main>'))
    .toBe('expired');
  expect(detectDeadline('Inscrições até 31 de novembro de 2099.')).toMatchObject({ precision: 'not_informed', stated: true });
  expect(detectDeadline('Inscrições até 123/11/2099.')).toMatchObject({ precision: 'not_informed', stated: true });
  expect(detectDeadline('Inscrições até 10/11/2099 às 23h5.')).toMatchObject({ precision: 'not_informed', stated: true });
  expect(detectDeadline('Publicado em 04/11/2026. Inscrições até 9 de novembro. Evento em 30/11/2026.'))
    .toMatchObject({ precision: 'not_informed', stated: true });
});

it('uses the application closing date rather than later results or event dates in a flattened timetable', () => {
  expect(detectDeadline('Abertura das inscrições 09/10/2026 Encerramento das inscrições 02/11/2026 às 23h59 Divulgação da classificação 11/11/2026 Realização 24/11/2026'))
    .toEqual({ deadlineAt: '2026-11-02T23:59:00-03:00', precision: 'exact_datetime' });
  expect(detectDeadline('Inscrições abertas até 10/11/2099. Resultado em 20/11/2099.'))
    .toEqual({ deadlineAt: '2099-11-10', precision: 'date_only' });
  expect(detectDeadline('Inscrições até 10/11/2099. Prazo de recursos até 20/11/2099.'))
    .toEqual({ deadlineAt: '2099-11-10', precision: 'date_only' });
  expect(detectDeadline('Inscrições até às 17h do dia 10 de novembro de 2099.'))
    .toEqual({ deadlineAt: '2099-11-10T17:00:00-03:00', precision: 'exact_datetime' });
});

it('retains conflicting application deadlines instead of choosing the first or last date', () => {
  expect(detectDeadline('Inscrições até 10/11/2099. Prazo final de inscrições: 20/11/2099.'))
    .toMatchObject({ precision: 'not_informed', stated: true });
});

it('honors written registration windows before generic open copy', () => {
  const text = 'Inscrições abertas. Inscrições de 10 de novembro de 2026 a 20 de novembro de 2026.';
  expect(detectOpportunityStatus(text, new Date('2026-11-04T12:00:00Z'))).toBe('upcoming');
  expect(detectOpportunityStatus(text, new Date('2026-11-15T12:00:00Z'))).toBe('open');
  expect(detectOpportunityStatus(text, new Date('2026-11-21T12:00:00Z'))).toBe('closed');
});

it('extracts one CPS-theme detail without borrowing deadlines from surrounding recommendations', () => {
  const html = '<div class="cps-texto-conteudo"><div class="cabecalho-secao"><h1>Bolsa de mobilidade acadêmica</h1></div>' + body + '</div>' +
    '<section class="related-posts"><h2>Outra chamada</h2><p>Inscrições até 31/12/2100.</p></section>';
  const candidate = normalizeDiscoveredPage(html, source);
  expect(candidate).toMatchObject({ title: 'Bolsa de mobilidade acadêmica', deadlineAt: '2099-11-10', opportunityStatus: 'open' });
  expect(publicationIssue(candidate!, source)).toBeNull();
  expect(singleOpportunityArticle(html)?.text).not.toContain('2100');
});

it('keeps an expired primary call expired despite future dates in related news', () => {
  const html = '<div class="cps-texto-conteudo"><h1>Concurso cultural</h1><p>Inscrições abertas pelo formulário de inscrição até 02 de novembro de 2026.</p></div>' +
    '<aside><p>Inscrições abertas até 30/11/2099.</p></aside>';
  const candidate = normalizeDiscoveredPage(html, source);
  expect(candidate?.deadlineAt).toBe('2026-11-02');
  expect(publicationIssue(candidate!, source, new Date('2026-11-04T12:00:00Z'))).toBe('invalid_deadline');
});

it('reads a main detail after removing a separately marked related-news section', () => {
  const html = '<main><h1>Bolsa de pesquisa</h1>' + body + '<section class="section__related">' +
    '<article><h2>Outra notícia</h2></article><article><h2>Outro evento</h2></article></section></main>';
  expect(normalizeDiscoveredPage(html, source)).toMatchObject({ title: 'Bolsa de pesquisa', deadlineAt: '2099-11-10' });
  expect(singleOpportunityArticle('<main><article><h1>Bolsa A</h1></article><article><h1>Bolsa B</h1></article></main>')).toBeNull();
});

it('accepts a duplicated WordPress banner title only when it repeats the exact primary title', () => {
  const html = '<main><h1 class="wp-block-post-title">Olimpíada de pesquisa</h1><div class="wp-block-post-content">' +
    '<h1>Olimpíada de pesquisa</h1>' + body + '</div></main>';
  expect(normalizeDiscoveredPage(html, source)?.title).toBe('Olimpíada de pesquisa');
  expect(singleOpportunityArticle(html.replace('<h1>Olimpíada de pesquisa</h1>', '<h1>Outra competição</h1>'))).toBeNull();
});
