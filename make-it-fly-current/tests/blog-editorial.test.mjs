import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { opportunityLoader } from './helpers/load-opportunity-module.mjs';

const frame = {
  '@/components/site/site-header': { SiteHeader: () => null },
  '@/components/site/site-footer': { SiteFooter: () => null },
  '@/components/site/share-button': { ShareButton: () => null },
  'next/link': { __esModule: true, default: ({ children, href, ...props }) => React.createElement('a', { href, ...props }, children) },
  'next/navigation': { notFound: () => { throw new Error('not-found'); } },
};
const post = { id: 1, slug: 'teste', title: 'Ciência e ação', excerpt: 'Resumo de teste', category: 'ciencias',
  body: 'Texto <script>alert(1)</script>.\n\nFontes:\n[1] NASA test — https://www.nasa.gov/ (2026-11-10)',
  status: 'published', publishedAt: new Date('2026-11-10T12:00:00Z'), scheduledAt: null,
  updatedAt: new Date('2026-11-10T12:00:00Z'), authorName: 'Autoria de teste', coverMediaId: null, videoUrl: null, seoNoIndex: true };

test('artigo sem capa preserva o texto escapado e oferece as referências HTTPS existentes', async () => {
  const load = opportunityLoader({ ...frame, '@/lib/blog/data': { getPublicPost: async () => post, listPostMedia: async () => [] } });
  const page = await load('app/blog/[slug]/page.tsx').default({ params: Promise.resolve({ slug: 'teste' }) });
  const html = renderToStaticMarkup(page);
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(html.includes('href="https://www.nasa.gov/"'));
  assert.ok(html.includes('rel="noopener noreferrer"'));
  assert.ok(!html.includes('<figure'));
  assert.ok(!html.includes('<script>alert'));
});

test('artigo indisponível continua em 404 e não busca mídia', async () => {
  let mediaCalls = 0;
  const load = opportunityLoader({ ...frame, '@/lib/blog/data': { getPublicPost: async () => null, listPostMedia: async () => { mediaCalls++; return []; } } });
  const page = load('app/blog/[slug]/page.tsx');
  await assert.rejects(() => page.default({ params: Promise.resolve({ slug: 'privado' }) }), /not-found/);
  const metadata = await page.generateMetadata({ params: Promise.resolve({ slug: 'privado' }) });
  assert.equal(metadata.robots.index, false);
  assert.equal(mediaCalls, 0);
});

test('listagem mantém tema e página nas consultas e não exibe capa vinculada a outro artigo', async () => {
  const calls = [];
  const item = { ...post, coverMediaId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' };
  const load = opportunityLoader({ ...frame, '@/lib/blog/data': {
    listPublicPosts: async (...args) => { calls.push(args); return { posts: [item], total: 25, pages: 3 }; },
    getCoverMedia: async () => [{ id: item.coverMediaId, postId: 999, alt: 'Capa de outro artigo', width: 800, height: 600 }],
  } });
  const tree = await load('app/blog/page.tsx').default({ searchParams: Promise.resolve({ tema: 'ciencias', pagina: '2' }) });
  const html = renderToStaticMarkup(tree);
  assert.deepEqual(calls, [['ciencias', 2]]);
  assert.ok(html.includes('tema=ciencias&amp;pagina=3'));
  assert.ok(!html.includes('Capa de outro artigo'));
  assert.ok(!html.includes(item.coverMediaId));
});
