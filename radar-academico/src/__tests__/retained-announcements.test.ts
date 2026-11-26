import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { afterEach, expect, it, vi } from 'vitest';
import { normalizeDiscoveredPage, singleOpportunityArticle, discoveredPageFailureReason } from '@/lib/ingestion/discovered-page';
import { publicationIssue } from '@/lib/ingestion/publication';
import { auditedUfscChild, ufscDiscoveryGzip } from '@/lib/ingestion/ufsc-discovery-policy';
import type { OfficialSource } from '@/lib/ingestion/types';

const fixture = (name: string) => readFileSync(new URL(`./fixtures/retained-20261119/${name}.html`, import.meta.url), 'utf8');
const target = { target_id: 'xlsx-20261014-001-ufsc', target_official_url: 'https://noticias.ufsc.br', target_organizer: 'UFSC' };
function source(url: string, ufsc = true): OfficialSource {
  return { id: `auto-page-${createHash('sha256').update(url).digest('hex').slice(0, 32)}`,
    name: 'Fonte oficial', institutionName: ufsc ? 'UFSC' : 'Associação Brasileira de Química, UFC e UFPI / PNOQ',
    institutionAcronym: '', sourceType: 'official_reference', baseUrl: url,
    allowedDomains: [new URL(url).hostname], allowedPathPrefixes: [new URL(url).pathname], listingUrls: [url],
    extractionMode: 'html', audienceScope: [], geographicScope: [], categories: ['eventos'], priority: 1, active: true,
    notes: ufsc ? 'radar:discovery-page:v1; target=xlsx-20261014-001-ufsc; authority=https://noticias.ufsc.br' : undefined };
}
afterEach(() => vi.useRealTimers());
function today() { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-19T13:00:00Z')); }

it('reads the unique UFSC H2 title and bounded body without sidebar or publication metadata', () => {
  const page = fixture('ufsc-workshop'), article = singleOpportunityArticle(page)!;
  expect(article.title).toContain('UFSC Araranguá sedia workshop');
  expect(article.text).toContain('11 a 13 de dezembro de 2026');
  expect(article.text).not.toContain('31/12/2099');
  expect(singleOpportunityArticle(page.replace('</section>', page.match(/<article[\s\S]*<\/article>/)![0] + '</section>'))).toBeNull();
  expect(singleOpportunityArticle(page.replace('<h2>', '<h2>Outra chamada</h2><h2>'))).toBeNull();
});

it('keeps the workshop and antiracism news held when the closing/start year is absent', () => {
  today();
  for (const name of ['ufsc-workshop', 'ufsc-antiracism']) {
    const s = source(`https://noticias.ufsc.br/2026/11/${name}/`);
    expect(normalizeDiscoveredPage(fixture(name), s)).toBeNull();
    expect(discoveredPageFailureReason(fixture(name), s)).not.toBe('detail_layout_unrecognized');
  }
});

it('publishes the evidenced OBQ attendance ceremony without inventing a registration deadline or timezone', () => {
  today(); const s = source('https://obquimica.org/noticias/premiacao-nacional-das-olimpiadas-de-quimica-2026', false);
  const candidate = normalizeDiscoveredPage(fixture('obq-ceremony'), s)!;
  expect(candidate).toMatchObject({ categories: ['eventos'], benefitType: 'other', opportunityStatus: 'open',
    deadlinePrecision: 'not_informed', eventStartsAt: '2026-11-25' });
  expect(candidate.deadlineAt).toBeUndefined();
  expect(candidate.applicationUrl).toMatch(/^https:\/\/(?:forms\.gle|docs\.google\.com)\//);
  expect(publicationIssue(candidate, s)).toBeNull();
  expect(normalizeDiscoveredPage(fixture('obq-ceremony').replace(/confirmar sua presença/giu, 'Leia mais'), s)).toBeNull();
  vi.setSystemTime(new Date('2026-11-25T03:00:00Z'));
  expect(publicationIssue(normalizeDiscoveredPage(fixture('obq-ceremony'), s)!, s)).toBe('status_unconfirmed');
});

it('publishes the PET volunteer call as unpaid training with its explicit deadline and requirements', () => {
  today(); const s = source('https://petletras.paginas.ufsc.br/2026/11/03/edital-022026pet-selecao-de-voluntariosases-estudantes-nao-bolsistas/');
  const candidate = normalizeDiscoveredPage(fixture('ufsc-pet-volunteers'), s)!;
  expect(candidate).toMatchObject({ benefitType: 'unpaid_opportunity', categories: ['formacao'],
    applicantType: 'undergraduate_student', deadlinePrecision: 'date_only', deadlineAt: '2026-11-25', opportunityStatus: 'open' });
  expect(candidate.requirementsText).toContain('20 (vinte) horas');
  expect(candidate.employment).toBeUndefined(); expect(candidate.amountText).toContain('sem bolsa');
  expect(publicationIssue(candidate, s)).toBeNull();
  expect(normalizeDiscoveredPage(fixture('ufsc-pet-volunteers').replace(/de 2026/g, 'de 2027'), s)).toBeNull();
  vi.setSystemTime(new Date('2026-11-26T03:00:00Z'));
  expect(publicationIssue(normalizeDiscoveredPage(fixture('ufsc-pet-volunteers'), s)!, s)).toBe('status_unconfirmed');
});

it('uses the calendar start only for a single future event explicitly open to the public', () => {
  today(); const s = source('https://noticias.ufsc.br/event/evento-concerto-dos-tenores-di-neoneli/?instance_id=7045');
  const candidate = normalizeDiscoveredPage(fixture('ufsc-concert'), s)!;
  expect(candidate).toMatchObject({ categories: ['eventos'], eventStartsAt: '2026-11-26T20:00:00-03:00', opportunityStatus: 'open', deadlinePrecision: 'not_informed' });
  expect(publicationIssue(candidate, s)).toBeNull();
  expect(normalizeDiscoveredPage(fixture('ufsc-concert').replace('aberto ao público', 'restrito aos convidados'), s)).toBeNull();
  vi.setSystemTime(new Date('2026-11-26T23:00:00Z'));
  expect(publicationIssue(normalizeDiscoveredPage(fixture('ufsc-concert'), s)!, s)).toBe('status_unconfirmed');
});

it.each(['ufsc-recurrent-exhibition', 'ufsc-virology'])('does not reopen or multiply recurring calendar entries: %s', name => {
  today(); const s = source('https://noticias.ufsc.br/event/fixture/?instance_id=1');
  expect(normalizeDiscoveredPage(fixture(name), s)).toBeNull();
  expect(discoveredPageFailureReason(fixture(name), s)).toBe('listing_or_ambiguous');
});

it('does not derive a submission deadline year from an unrelated event start', () => {
  today(); const s = source('https://noticias.ufsc.br/event/3o-seminario-interno-labeur-labplan/?instance_id=6871');
  expect(normalizeDiscoveredPage(fixture('ufsc-seminar'), s)).toBeNull();
});

it('limits university authority and gzip to the recorded target and hosts', () => {
  const child = 'https://petletras.paginas.ufsc.br/2026/11/call/';
  expect(auditedUfscChild({ ...target, url: child })).toBe(true);
  for (const url of ['https://unreviewed.ufsc.br/call', 'https://ufsc.br.evil.example/call', 'https://drive.google.com/file/call', 'https://wp.ufpel.edu.br/water/']) {
    expect(auditedUfscChild({ ...target, url })).toBe(false);
  }
  expect(auditedUfscChild({ ...target, target_organizer: 'Outro organizador', url: child })).toBe(false);
  const s = source(child);
  expect(ufscDiscoveryGzip(s, child)).toBe(true);
  expect(ufscDiscoveryGzip({ ...s, notes: s.notes!.replace('001-ufsc', '001-other') }, child)).toBe(false);
  expect(ufscDiscoveryGzip(s, child + 'unverified')).toBe(false);
  expect(ufscDiscoveryGzip({ ...s, id: 'unverified-source' }, child)).toBe(false);
});

it('bounds a UFSC relative event date to the official article date and verifies public entry', () => {
  today();
  const s = source('https://noticias.ufsc.br/2026/11/mostra-dos-estudantes/');
  const html = `<meta property="article:published_time" content="2026-11-18T16:00:00Z">
    <article><h1>Estudantes apresentam os projetos do semestre</h1>
    <p>O instituto recebe, na próxima segunda-feira, 23 de novembro, a Feira de Tecnologia.
    A atividade será realizada das 10h às 12h, no Auditório, com entrada gratuita e aberta ao público, sem necessidade de inscrição.</p></article>`;
  const card = normalizeDiscoveredPage(html, s);
  expect(card).toMatchObject({ eventStartsAt: '2026-11-23', deadlinePrecision: 'not_informed',
    categories: ['eventos'], evidenceJson: { location: { excerpt: 'Auditório' } } });
  expect(publicationIssue(card!, s)).toBeNull();
  expect(normalizeDiscoveredPage(html.replace('23 de novembro', '24 de novembro'), s)).toBeNull();
  expect(normalizeDiscoveredPage(html.replace('article:published_time', 'article:modified_time'), s)).toBeNull();
  expect(normalizeDiscoveredPage(html.replace('aberta ao público', 'restrita aos convidados'), s)).toBeNull();
});
