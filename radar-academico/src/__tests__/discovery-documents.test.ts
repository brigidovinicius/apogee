import { expect, it } from 'vitest';
import { discoveryDocument } from '@/lib/discovery/documents';
const resource = (body: string, contentType: string, discoverySitemaps?: string[]) => ({ body: Buffer.from(body), contentType, discoverySitemaps });
it('does not follow a platform-wide robots sitemap from an institutional path on a shared host', () => {
  const parsed = discoveryDocument(resource('<main>Chamadas</main>', 'text/html', ['https://www.gov.br/sitemap.xml']),
    'https://www.gov.br/cnpq/pt-br/chamadas', 'https://www.gov.br/cnpq/pt-br/chamadas');
  expect(parsed.pages).toEqual([]);
});
it('does not follow the global Luma sitemap from a verified organizer calendar', () => {
  const parsed = discoveryDocument(resource('<main>Agenda</main>', 'text/html', ['https://luma.com/sitemap.xml']),
    'https://luma.com/womakerscode', 'https://luma.com/womakerscode');
  expect(parsed.pages).toEqual([]);
});
it('does not cross from one agency into another when following a shared-host feed', () => {
  const parsed = discoveryDocument(resource('<link rel="alternate" type="application/rss+xml" href="https://www.gov.br/outra-agencia/rss">', 'text/html'),
    'https://www.gov.br/cnpq/noticias', 'https://www.gov.br/cnpq/noticias');
  expect(parsed.pages).toEqual([]);
});
it('parses an official Atom feed without treating its HTML payload as executable code', () => {
  const parsed = discoveryDocument(resource('<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Bolsa de pesquisa</title><link rel="alternate" href="https://official.example.org/bolsa"/><summary>Inscrições abertas</summary></entry></feed>', 'application/atom+xml'),
    'https://official.example.org/feed', 'https://official.example.org/');
  expect(parsed.links).toEqual([{ url: 'https://official.example.org/bolsa', title: 'Bolsa de pesquisa', excerpt: 'Inscrições abertas' }]);
});
it('rejects XML external entities instead of resolving local or network content', () => {
  expect(() => discoveryDocument(resource('<!DOCTYPE rss [<!ENTITY secret SYSTEM "file:///etc/passwd">]><rss>&secret;</rss>', 'application/xml'),
    'https://official.example.org/feed', 'https://official.example.org/')).toThrow();
});
