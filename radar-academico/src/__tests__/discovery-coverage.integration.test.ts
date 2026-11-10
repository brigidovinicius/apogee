import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { beforeAll, beforeEach, afterAll, expect, it, vi } from 'vitest';
import type { PoolClient } from 'pg';
const state = vi.hoisted(() => ({ db: null as PGlite | null }));
vi.mock('@/lib/db/client', () => ({
  withAdminTransaction: (work: (client: PoolClient) => Promise<unknown>) => state.db!.transaction(tx => work(tx as unknown as PoolClient)),
  queryPublic: (sql: string, values: unknown[] = []) => state.db!.query(sql, values),
}));
vi.mock('@/lib/ingestion/fetch-source', () => ({ fetchOfficialResource: vi.fn() }));
import { fetchOfficialResource } from '@/lib/ingestion/fetch-source';
import { runScheduledDiscovery } from '@/lib/discovery/daily-discovery';
import { runScheduledLeadProcessing, claimDueDiscoveryLeads, finishDiscoveryLead } from '@/lib/discovery/process-leads';
import { listPublicOpportunities } from '@/lib/db/read-models';
const parent = 'https://official.example.org/';
const target = 'coverage-test';
const pages = new Map<string, { body: string; type: string; sitemaps?: string[] }>();
const page = (url: string, body: string, type = 'text/html', sitemaps?: string[]) => pages.set(url, { body, type, sitemaps });
const detail = (title = 'Bolsa de pesquisa em tecnologia') => `<main><h1>${title}</h1><p>Inscrições abertas até 31/12/2099.</p><p>Estudantes de graduação podem participar. Inscreva-se pelo formulário de inscrição.</p></main>`;
beforeAll(async () => {
  vi.stubEnv('DATABASE_EDITOR_URL', 'postgresql://isolated-test.invalid/unused');
  vi.stubEnv('DATABASE_READER_URL', 'postgresql://isolated-test.invalid/unused');
  state.db = new PGlite({ extensions: { pgcrypto } });
  const dir = new URL('../../db/migrations/', import.meta.url);
  for (const name of (await readdir(dir)).filter(n => n.endsWith('.sql')).sort()) await state.db.exec(await readFile(new URL(name, dir), 'utf8'));
}, 30000);
afterAll(async () => { await state.db?.close(); vi.unstubAllEnvs(); });
beforeEach(async () => {
  pages.clear();
  vi.mocked(fetchOfficialResource).mockClear();
  await state.db!.exec("delete from discovery_leads; delete from ingestion_runs; delete from opportunity_management_events; delete from opportunity_revisions; delete from opportunity_sources; delete from opportunities; delete from official_sources where id like 'auto-page-%' or id='registered-html-test'; update discovery_targets set enabled=false; update official_sources set active=false;");
  await state.db!.query('delete from discovery_targets where id=$1', [target]);
  await state.db!.query(`insert into discovery_targets(id,name,organizer,kind,official_url,evidence_url,enabled,
    official_verified_at,official_verified_url,official_verified_by,official_review_note)
    values($1,'Chamadas','Instituto de Tecnologia','site',$2,$2,true,now(),$2,'test','Autoria de teste verificada.')`, [target, parent]);
  vi.mocked(fetchOfficialResource).mockImplementation(async url => {
    const p = pages.get(url);
    if (!p) throw Error('Unexpected URL: ' + url);
    const body = Buffer.from(p.body);
    return { body, contentType: p.type, hash: createHash('sha256').update(body).digest('hex'), cached: false, discoverySitemaps: p.sitemaps };
  });
});
const due = () => state.db!.query('update discovery_targets set next_check_at=now() where id=$1', [target]);

it('rechecks version-seven formats and explicit deadlines once without reopening protected decisions', async () => {
  const inputs = [
    { path: 'bolsa-layout', reason: 'detail_layout_unrecognized', status: 'new', attempts: 1 },
    { path: 'bolsa-prazo', reason: 'invalid_deadline', status: 'reviewing', attempts: 2 },
    { path: 'bolsa-sem-ano', reason: 'invalid_deadline', status: 'new', attempts: 1 },
    { path: 'bolsa-encerrada', reason: 'invalid_deadline', status: 'new', attempts: 1 },
    { path: 'exhausted', reason: 'invalid_deadline', status: 'new', attempts: 4 },
    { path: 'dismissed', reason: 'invalid_deadline', status: 'dismissed', attempts: 1 },
    { path: 'manual', reason: 'manual_override', status: 'reviewing', attempts: 1 },
    { path: 'authority', reason: 'source_authority_unverified', status: 'new', attempts: 1 },
  ];
  for (const input of inputs) {
    const row = (await state.db!.query<{ id: string }>(`insert into discovery_leads(target_id,url,title,status,processing_status,processing_reason,processing_attempts)
      values($1,$2,'Bolsa de pesquisa',$3,'blocked',$4,$5) returning id`, [target, parent + input.path, input.status, input.reason, input.attempts])).rows[0];
    await state.db!.query(`insert into ingestion_runs(started_at,finished_at,status,execution_metadata)
      values(now(),now(),'completed_with_warnings',jsonb_build_object('component','discovery-lead','lead_id',$1::text,'source_expansion_version',7))`, [row.id]);
  }
  page(parent, inputs.slice(0,4).map(input => `<a href="${parent + input.path}">Bolsa de pesquisa</a>`).join(''));
  page(parent + 'bolsa-layout', '<body class="single-post"><div id="Subheader"><h1 class="title">Bolsa de pesquisa</h1></div><div id="Content"><div class="post-wrapper-content"><div class="the_content_wrapper"><p>Inscrições abertas até 31.12.2099 pelo formulário de inscrição.</p></div></div></div></body>');
  page(parent + 'bolsa-prazo', '<main><h1>Bolsa de pesquisa com calendário</h1><p>Inscrições abertas de 9 de março a 5 de maio de 2099 pelo formulário de inscrição.</p></main>');
  page(parent + 'bolsa-sem-ano', '<main><h1>Bolsa de pesquisa</h1><p>Inscrições abertas até 9 de novembro pelo formulário de inscrição.</p></main>');
  page(parent + 'bolsa-encerrada', '<main><h1>Bolsa de pesquisa</h1><p>Inscrições para Participantes: Encerradas.</p></main>');
  expect(await runScheduledLeadProcessing()).toMatchObject({ leadsChecked: 4, published: 2, sourcesRegistered: 2,
    reasons: { published: 2, invalid_deadline: 1, status_unconfirmed: 1 } });
  expect(await listPublicOpportunities()).toHaveLength(2);
  expect((await state.db!.query("select distinct execution_metadata->>'source_expansion_version' as version from ingestion_runs where execution_metadata->>'reason'='published'")).rows).toEqual([{ version: '8' }]);
  expect(await runScheduledLeadProcessing()).toMatchObject({ leadsChecked: 0, published: 0 });
  expect((await state.db!.query("select url,processing_attempts from discovery_leads where url=any($1::text[]) order by url", [inputs.slice(4).map(input => parent + input.path)])).rows)
    .toEqual(inputs.slice(4).sort((a,b) => a.path.localeCompare(b.path)).map(input => ({ url: parent + input.path, processing_attempts: input.attempts })));
  expect(fetchOfficialResource).not.toHaveBeenCalledWith(expect.stringMatching(/exhausted|dismissed|manual|authority/), expect.anything(), expect.anything());
});

it('rechecks a version-six layout once and publishes its evidenced ticketed event through the native transaction', async () => {
  await state.db!.query("update discovery_targets set topics=array['eventos'] where id=$1", [target]);
  const url = parent + 'concerto';
  const inputs = [
    { url, reason: 'detail_layout_unrecognized', attempts: 1 },
    { url: parent + 'missing-deadline', reason: 'invalid_deadline', attempts: 1 },
    { url: parent + 'unchanged-authority', reason: 'source_authority_unverified', attempts: 1 },
    { url: parent + 'exhausted', reason: 'detail_layout_unrecognized', attempts: 4 },
  ];
  for (const input of inputs) {
    const row = (await state.db!.query<{ id: string }>(`insert into discovery_leads(target_id,url,title,processing_status,processing_reason,processing_attempts)
      values($1,$2,'Broadway: Um Encontro Musical','blocked',$3,$4) returning id`, [target, input.url, input.reason, input.attempts])).rows[0];
    await state.db!.query(`insert into ingestion_runs(started_at,finished_at,status,execution_metadata)
      values(now(),now(),'completed_with_warnings',jsonb_build_object('component','discovery-lead','lead_id',$1::text,'source_expansion_version',6))`, [row.id]);
  }
  const oldUrl = parent + 'workshop-antigo';
  const old = (await state.db!.query<{ id: string }>(`insert into discovery_leads(target_id,url,title,processing_status,processing_reason,processing_attempts,first_seen_at)
    values($1,$2,'Workshop de tecnologia antigo','blocked','detail_layout_unrecognized',1,now()-interval '2 days') returning id`, [target, oldUrl])).rows[0];
  await state.db!.query(`insert into ingestion_runs(started_at,finished_at,status,execution_metadata)
    values(now(),now(),'completed_with_warnings',jsonb_build_object('component','discovery-lead','lead_id',$1::text,'source_expansion_version',6))`, [old.id]);
  const html = (await readFile(new URL('./fixtures/pucpr-broadway-service-20261109.html', import.meta.url), 'utf8')).replaceAll('2026', '2099');
  page(parent, `<a href="${url}">Broadway: Um Encontro Musical</a><a href="${oldUrl}">Workshop de tecnologia antigo</a><a href="${parent}missing-deadline">Bolsa de pesquisa</a>`);
  page(url, html); page(oldUrl, '<div>Notícia antiga sem estrutura de candidatura.</div>');
  page(parent + 'missing-deadline', '<main><h1>Bolsa de pesquisa</h1><p>Inscrições abertas até 9 de novembro pelo formulário de inscrição.</p></main>');
  expect(await runScheduledLeadProcessing()).toMatchObject({ leadsChecked: 3, created: 1, published: 1, sourcesRegistered: 1,
    reasons: { published: 1, invalid_deadline: 1, detail_layout_unrecognized: 1 } });
  expect(vi.mocked(fetchOfficialResource).mock.calls.filter(([requested]) => requested !== parent).map(([requested]) => requested))
    .toEqual(expect.arrayContaining([url, oldUrl, parent + 'missing-deadline']));
  expect(await listPublicOpportunities()).toEqual([expect.objectContaining({ source_page_url: url })]);
  expect((await state.db!.query("select verification_method,publication_issue,deadline_at,deadline_precision,event_starts_at::text from opportunities")).rows)
    .toEqual([{ verification_method: 'automatic', publication_issue: null, deadline_at: null, deadline_precision: 'not_informed', event_starts_at: '2099-11-12' }]);
  expect((await state.db!.query("select execution_metadata->>'source_expansion_version' as version from ingestion_runs where execution_metadata->>'reason'='published'")).rows)
    .toEqual([{ version: '8' }]);
  expect(await runScheduledLeadProcessing()).toMatchObject({ leadsChecked: 0, published: 0 });
  expect((await state.db!.query("select url,processing_attempts from discovery_leads where processing_status='blocked' and url<>$1 order by url", [oldUrl])).rows)
    .toEqual(inputs.slice(1).sort((a,b) => a.url.localeCompare(b.url)).map(input => ({ url: input.url, processing_attempts: input.attempts + (input.reason === 'invalid_deadline' ? 1 : 0) })));
});

it('preserves crawl progress and canonical evidence paths for an origin stored without its implicit slash', async () => {
  const rawParent = parent.slice(0, -1);
  await state.db!.query('update discovery_targets set official_url=$2,official_verified_url=$2 where id=$1', [target, rawParent]);
  const body = Array.from({ length: 60 }, (_, i) => `<a href="${parent}bolsa/${i}">Bolsa de pesquisa ${i}</a>`).join('');
  page(parent, body); page(rawParent, body);
  expect(await runScheduledDiscovery()).toMatchObject({ newLeads: 30 });
  await due();
  expect(await runScheduledDiscovery()).toMatchObject({ newLeads: 30 });
  expect((await state.db!.query('select discovery_path from discovery_leads')).rows)
    .toEqual(Array.from({ length: 60 }, () => ({ discovery_path: [parent] })));
});

it('publishes an evidenced olympiad with its heading outside the nested article', async () => {
  await state.db!.query("update discovery_targets set topics=array['competicoes'] where id=$1", [target]);
  const url = parent + 'olimpiada-2026';
  page(parent, `<a href="${url}">Olimpíada de Matemática</a>`);
  page(url, '<main><h1>Olimpíada de Matemática</h1><article><p>Inscrições abertas até 31/12/2099.</p><p>Estudantes do ensino médio podem participar. Inscreva-se pelo formulário de inscrição.</p></article></main>');
  await runScheduledDiscovery();
  expect(await runScheduledLeadProcessing()).toMatchObject({ created: 1, published: 1 });
  expect(await listPublicOpportunities()).toEqual([expect.objectContaining({ title: 'Olimpíada de Matemática' })]);
  expect((await state.db!.query('select categories from opportunities')).rows).toEqual([
    { categories: expect.arrayContaining(['competicoes']) },
  ]);
});

it('drains more than two candidates in one native cycle while preserving atomic publication', async () => {
  const urls = Array.from({ length: 5 }, (_, i) => parent + 'bolsa-' + i);
  page(parent, urls.map((url, i) => `<a href="${url}">Bolsa de pesquisa ${i}</a>`).join(''));
  urls.forEach((url, i) => page(url, detail('Bolsa de pesquisa ' + i)));
  await runScheduledDiscovery();
  expect(await runScheduledLeadProcessing()).toMatchObject({ leadsChecked: 5, created: 5, published: 5 });
  expect(await listPublicOpportunities()).toHaveLength(5);
  expect((await state.db!.query("select count(*)::int as count from discovery_leads where processing_status='processing'")).rows).toEqual([{ count: 0 }]);
});

it('publishes another target despite a large older backlog and leaves unstarted links pending at the batch limit', async () => {
  await state.db!.query(`insert into discovery_targets(id,name,organizer,kind,official_url,evidence_url,enabled,
    official_verified_at,official_verified_url,official_verified_by,official_review_note)
    select 'second-target',name,organizer,kind,official_url,evidence_url,true,official_verified_at,official_verified_url,
    official_verified_by,official_review_note from discovery_targets where id=$1`, [target]);
  for (let i = 0; i < 25; i++) await state.db!.query(`insert into discovery_leads(target_id,url,title,processing_next_at,first_seen_at)
    values($1,$2,'Bolsa de pesquisa',now()-interval '2 days',now()-interval '2 days')`, [target, parent + 'backlog-' + i + '.png']);
  await state.db!.query(`insert into discovery_leads(target_id,url,title) values('second-target',$1,'Bolsa nova')`, [parent + 'new-call']);
  page(parent, `<a href="${parent}new-call">Bolsa nova</a>`);
  page(parent + 'new-call', detail('Bolsa nova'));
  expect(await runScheduledLeadProcessing()).toMatchObject({ leadsChecked: 24, published: 1, blocked: 23 });
  expect(await listPublicOpportunities()).toEqual([expect.objectContaining({ title: 'Bolsa nova' })]);
  expect((await state.db!.query("select count(*)::int as count from discovery_leads where processing_status='pending'")).rows).toEqual([{ count: 2 }]);
  expect((await state.db!.query("select count(*)::int as count from discovery_leads where processing_status='processing'")).rows).toEqual([{ count: 0 }]);
  await state.db!.query("delete from discovery_leads where target_id='second-target'");
  await state.db!.query("delete from discovery_targets where id='second-target'");
});

it('rejects a legacy image candidate without making any public network request', async () => {
  await state.db!.query(`insert into discovery_leads(target_id,url,title) values($1,$2,'Inscrições da olimpíada')`, [target, parent + 'cartaz.png']);
  expect(await runScheduledLeadProcessing()).toMatchObject({ leadsChecked: 1, published: 0, reasons: { unsupported_content: 1 } });
  expect(fetchOfficialResource).not.toHaveBeenCalled();
});

it('revisits corrected extraction blocks even while the same target still has pending links', async () => {
  for (let i = 0; i < 26; i++) await state.db!.query(`insert into discovery_leads(target_id,url,title)
    values($1,$2,'Inscrições')`, [target, parent + 'pending-' + i + '.png']);
  await state.db!.query(`insert into discovery_leads(target_id,url,title,processing_status,processing_reason,processing_attempts)
    values($1,$2,'Bolsa de pesquisa corrigida','blocked','candidate_unconfirmed',1)`, [target, parent + 'bolsa-corrigida']);
  page(parent, `<a href="${parent}bolsa-corrigida">Bolsa de pesquisa corrigida</a>`);
  page(parent + 'bolsa-corrigida', detail('Bolsa de pesquisa corrigida'));
  expect(await runScheduledLeadProcessing()).toMatchObject({ leadsChecked: 24, published: 1 });
  expect(await listPublicOpportunities()).toEqual([expect.objectContaining({ title: 'Bolsa de pesquisa corrigida' })]);
});

it('rechecks version-four extraction failures once without retrying unchanged authority blocks or exhausted attempts', async () => {
  const inputs = [
    { url: parent + 'bolsa-corrigida', reason: 'candidate_unconfirmed', attempts: 1 },
    { url: parent + 'unverified', reason: 'source_authority_unverified', attempts: 1 },
    { url: parent + 'exhausted', reason: 'candidate_unconfirmed', attempts: 4 },
  ];
  for (const input of inputs) {
    const row = (await state.db!.query<{ id: string }>(`insert into discovery_leads(target_id,url,title,processing_status,processing_reason,processing_attempts)
      values($1,$2,'Bolsa de pesquisa','blocked',$3,$4) returning id`, [target, input.url, input.reason, input.attempts])).rows[0];
    await state.db!.query(`insert into ingestion_runs(started_at,finished_at,status,execution_metadata)
      values(now(),now(),'completed_with_warnings',jsonb_build_object('component','discovery-lead','lead_id',$1::text,'source_expansion_version',4))`, [row.id]);
  }
  page(parent, `<a href="${parent}bolsa-corrigida">Bolsa de pesquisa</a>`);
  page(parent + 'bolsa-corrigida', '<div class="cps-texto-conteudo"><h1>Bolsa de pesquisa</h1><p>Inscrições abertas até 10 de novembro de 2099 pelo formulário de inscrição.</p></div>');
  expect(await runScheduledLeadProcessing()).toMatchObject({ leadsChecked: 1, published: 1 });
  expect(await runScheduledLeadProcessing()).toMatchObject({ leadsChecked: 0, published: 0 });
  expect((await state.db!.query('select url,processing_attempts from discovery_leads where processing_status=\'blocked\' order by url')).rows)
    .toEqual([{ url: parent + 'exhausted', processing_attempts: 4 }, { url: parent + 'unverified', processing_attempts: 1 }]);
});

it('rechecks version-five layout and deadline failures once while preserving other decisions and the attempt limit', async () => {
  const inputs = [
    { url: parent + 'curso-joomla', reason: 'detail_layout_unrecognized', attempts: 1 },
    { url: parent + 'invalid-deadline', reason: 'invalid_deadline', attempts: 1 },
    { url: parent + 'unconfirmed', reason: 'candidate_unconfirmed', attempts: 1 },
    { url: parent + 'unverified', reason: 'source_authority_unverified', attempts: 1 },
    { url: parent + 'exhausted', reason: 'detail_layout_unrecognized', attempts: 4 },
  ];
  for (const input of inputs) {
    const row = (await state.db!.query<{ id: string }>(`insert into discovery_leads(target_id,url,title,processing_status,processing_reason,processing_attempts)
      values($1,$2,'Instituto abre inscrições para curso de estatística','blocked',$3,$4) returning id`, [target, input.url, input.reason, input.attempts])).rows[0];
    await state.db!.query(`insert into ingestion_runs(started_at,finished_at,status,execution_metadata)
      values(now(),now(),'completed_with_warnings',jsonb_build_object('component','discovery-lead','lead_id',$1::text,'source_expansion_version',5))`, [row.id]);
  }
  page(parent, `<a href="${parent}curso-joomla">Instituto abre inscrições para curso de estatística</a>`);
  page(parent + 'curso-joomla', '<div class="com-content-article item-page"><h1>Instituto abre inscrições para curso de estatística</h1>' +
    '<div class="com-content-article__body"><p>Inscrições abertas. As inscrições podem ser feitas até 8 de novembro de 2099 pelo formulário de inscrição.</p></div></div>');
  page(parent + 'invalid-deadline', '<main><h1>Bolsa de pesquisa</h1><p>Inscrições abertas até 9 de novembro pelo formulário de inscrição.</p></main>');
  expect(await runScheduledLeadProcessing()).toMatchObject({ leadsChecked: 2, created: 1, published: 1 });
  expect(await listPublicOpportunities()).toEqual([expect.objectContaining({ title: 'Instituto abre inscrições para curso de estatística' })]);
  expect((await state.db!.query('select categories,is_course from opportunities')).rows).toEqual([{ categories: ['formacao'], is_course: true }]);
  expect(await runScheduledLeadProcessing()).toMatchObject({ leadsChecked: 0, published: 0 });
  expect((await state.db!.query('select url,processing_attempts from discovery_leads where processing_status=\'blocked\' order by url')).rows)
    .toEqual(inputs.slice(1).sort((a,b) => a.url.localeCompare(b.url)).map(input => ({ url: input.url, processing_attempts: input.attempts + (input.reason === 'invalid_deadline' ? 1 : 0) })));
});

it('reaches a corrected layout within the native batch despite older broad extraction blocks', async () => {
  for (let i = 0; i < 24; i++) await state.db!.query(`insert into discovery_leads(target_id,url,title)
    values($1,$2,'Inscrições')`, [target, parent + 'pending-' + i + '.png']);
  for (let i = 0; i < 12; i++) await state.db!.query(`insert into discovery_leads(target_id,url,title,processing_status,processing_reason,processing_attempts,first_seen_at)
    values($1,$2,'Bolsa antiga','blocked','candidate_unconfirmed',1,now()-interval '3 days')`, [target, parent + 'old-block-' + i]);
  const corrected = parent + 'curso-joomla';
  await state.db!.query(`insert into discovery_leads(target_id,url,title,processing_status,processing_reason,processing_attempts)
    values($1,$2,'Instituto abre inscrições para curso de estatística','blocked','detail_layout_unrecognized',1)`, [target, corrected]);
  page(parent, `<a href="${corrected}">Instituto abre inscrições para curso de estatística</a>`);
  page(corrected, '<div class="com-content-article item-page"><h1>Instituto abre inscrições para curso de estatística</h1>' +
    '<div class="com-content-article__body"><p>Inscrições abertas até 8 de novembro de 2099 pelo formulário de inscrição.</p></div></div>');
  expect(await runScheduledLeadProcessing()).toMatchObject({ leadsChecked: 24, created: 1, published: 1 });
  expect(await listPublicOpportunities()).toEqual([expect.objectContaining({ source_page_url: corrected })]);
  expect((await state.db!.query("select count(*)::int as count from discovery_leads where processing_status='processing'")).rows).toEqual([{ count: 0 }]);
});

it('registers an exact external event page only when its structured organizer matches the verified institution', async () => {
  const external = 'https://conference.example.net/workshop';
  page(parent, `<a href="${external}">Workshop de tecnologia</a>`);
  page(external, `<script type="application/ld+json">${JSON.stringify({ '@type': 'EducationEvent',
    name: 'Workshop de tecnologia', url: external, startDate: '2099-12-01T09:00:00-03:00',
    organizer: { name: 'Instituto de Tecnologia', url: parent }, eventStatus: 'https://schema.org/EventScheduled',
    location: { address: { addressCountry: 'BR', addressRegion: 'SC', addressLocality: 'Florianópolis' } },
    offers: { url: external, price: 0, priceCurrency: 'BRL', availability: 'https://schema.org/InStock' },
  })}</script><main><h1>Workshop de tecnologia</h1><a href="${external}">Inscreva-se</a></main>`);
  expect(await runScheduledDiscovery()).toMatchObject({ newLeads: 1 });
  expect(await runScheduledLeadProcessing()).toMatchObject({ created: 1, sourcesRegistered: 1, published: 1 });
  expect(await listPublicOpportunities()).toEqual([expect.objectContaining({ source_page_url: external, institution: 'Instituto de Tecnologia' })]);
});

it('keeps an external event private when it names another organizer', async () => {
  const external = 'https://conference.example.net/workshop';
  page(parent, `<a href="${external}">Workshop de tecnologia</a>`);
  page(external, `<script type="application/ld+json">${JSON.stringify({ '@type': 'Event', name: 'Workshop de tecnologia',
    url: external, organizer: { name: 'Unverified organizer', url: parent }, startDate: '2099-12-01T09:00:00-03:00' })}</script>`);
  expect(await runScheduledDiscovery()).toMatchObject({ newLeads: 1 });
  expect(await runScheduledLeadProcessing()).toMatchObject({ created: 0, sourcesRegistered: 0, published: 0 });
  expect(await listPublicOpportunities()).toHaveLength(0);
});

it('advances beyond the first thirty links instead of checking the same blocked links forever', async () => {
  page(parent, Array.from({ length: 60 }, (_, i) => `<a href="${parent}bolsa/${i}">Bolsa de pesquisa ${i}</a>`).join(''));
  expect(await runScheduledDiscovery()).toMatchObject({ targetsChecked: 1, newLeads: 30 });
  await due();
  expect(await runScheduledDiscovery()).toMatchObject({ targetsChecked: 1, newLeads: 30 });
  expect((await state.db!.query('select id from discovery_leads')).rows).toHaveLength(60);
});
it('discovers an RSS-only opportunity and revalidates the complete path before atomic publication', async () => {
  page(parent, '<link rel="alternate" type="application/rss+xml" href="/feed">');
  page(parent + 'feed', `<rss version="2.0"><channel><title>Chamadas</title><link>${parent}</link><description>Chamadas</description><item><title>Bolsa de pesquisa em tecnologia</title><link>${parent}bolsa</link></item></channel></rss>`, 'application/rss+xml');
  page(parent + 'bolsa', detail());
  expect(await runScheduledDiscovery()).toMatchObject({ newLeads: 1 });
  expect(await runScheduledLeadProcessing()).toMatchObject({ sourcesRegistered: 1, created: 1, published: 1 });
  expect(await listPublicOpportunities()).toEqual([expect.objectContaining({ title: 'Bolsa de pesquisa em tecnologia', source_page_url: parent + 'bolsa' })]);
  await due();
  expect(await runScheduledDiscovery()).toMatchObject({ newLeads: 0 });
  expect(await runScheduledLeadProcessing()).toMatchObject({ created: 0, published: 0 });
  expect(await listPublicOpportunities()).toHaveLength(1);
});
it('uses the improved extractor for a new page within an already registered official source', async () => {
  await state.db!.query(`insert into official_sources(id,name,institution_name,institution_acronym,source_type,base_url,
    allowed_domains,allowed_path_prefixes,listing_urls,extraction_mode,active,verification_status)
    values('registered-html-test','Chamadas','Instituto de Tecnologia','','official_reference',$1,
    array['official.example.org'],array['/'],array[$1],'html',true,'verified')`, [parent]);
  page(parent, `<a href="${parent}bolsa">Bolsa de pesquisa em tecnologia</a>`);
  page(parent + 'bolsa', detail());
  expect(await runScheduledDiscovery()).toMatchObject({ newLeads: 1 });
  expect(await runScheduledLeadProcessing()).toMatchObject({ created: 1, sourcesRegistered: 0, published: 1 });
  expect(await listPublicOpportunities()).toEqual([expect.objectContaining({ source_page_url: parent + 'bolsa' })]);
});
it('uses a sitemap advertised by robots without fetching an unrelated host', async () => {
  page(parent, '<main>Chamadas</main>', 'text/html', [parent + 'sitemap.xml', 'https://unverified.example.net/sitemap.xml']);
  page(parent + 'sitemap.xml', `<sitemapindex><sitemap><loc>${parent}calls.xml</loc></sitemap></sitemapindex>`, 'application/xml');
  page(parent + 'calls.xml', `<urlset><url><loc>${parent}bolsa-tecnologia</loc></url><url><loc>http://127.0.0.1/bolsa</loc></url></urlset>`, 'application/xml');
  page(parent + 'bolsa-tecnologia', detail());
  expect(await runScheduledDiscovery()).toMatchObject({ newLeads: 1 });
  expect(await runScheduledLeadProcessing()).toMatchObject({ sourcesRegistered: 1, created: 1, published: 1 });
  expect(await listPublicOpportunities()).toHaveLength(1);
});
it('blocks publication if the feed is no longer linked by the verified parent', async () => {
  page(parent, '<link rel="alternate" type="application/rss+xml" href="/feed">');
  page(parent + 'feed', `<rss version="2.0"><channel><title>Chamadas</title><link>${parent}</link><description>Chamadas</description><item><title>Bolsa de pesquisa</title><link>${parent}bolsa</link></item></channel></rss>`, 'application/rss+xml');
  expect(await runScheduledDiscovery()).toMatchObject({ newLeads: 1 });
  page(parent, '<main>Sem feed</main>');
  expect(await runScheduledLeadProcessing()).toMatchObject({ sourcesRegistered: 0, published: 0 });
  expect(await listPublicOpportunities()).toHaveLength(0);
});
it('re-evaluates an extraction block from the previous version once, without resetting a dismissal', async () => {
  page(parent, `<a href="${parent}bolsa">Bolsa de pesquisa em tecnologia</a>`);
  page(parent + 'bolsa', detail());
  const lead = (await state.db!.query<{ id: string }>(`insert into discovery_leads(target_id,url,title,processing_status,processing_reason,processing_attempts)
    values($1,$2,'Bolsa de pesquisa em tecnologia','blocked','candidate_unconfirmed',1) returning id`, [target, parent + 'bolsa'])).rows[0];
  await state.db!.query(`insert into ingestion_runs(started_at,finished_at,status,execution_metadata) values(now(),now(),'completed_with_warnings',
    jsonb_build_object('component','discovery-lead','lead_id',$1::text,'source_expansion_version',1))`, [lead.id]);
  await state.db!.query(`insert into discovery_leads(target_id,url,title,status,processing_status,processing_reason)
    values($1,$2,'Bolsa descartada','dismissed','ignored','previously_reviewed')`, [target, parent + 'dismissed']);
  expect(await runScheduledLeadProcessing()).toMatchObject({ leadsChecked: 1, created: 1, published: 1 });
  expect(await runScheduledLeadProcessing()).toMatchObject({ leadsChecked: 0, created: 0 });
  expect((await state.db!.query('select status,processing_status from discovery_leads where url=$1', [parent + 'dismissed'])).rows)
    .toEqual([{ status: 'dismissed', processing_status: 'ignored' }]);
});
it('does not repeatedly retry an unconfirmed candidate already checked by this extraction version', async () => {
  page(parent, `<a href="${parent}bolsa">Bolsa de pesquisa</a>`);
  page(parent + 'bolsa', '<main><h1>Bolsa de pesquisa</h1><p>Notícia sem inscrição ou prazo.</p></main>');
  expect(await runScheduledDiscovery()).toMatchObject({ newLeads: 1 });
  expect(await runScheduledLeadProcessing()).toMatchObject({ leadsChecked: 1, blocked: 1, published: 0 });
  expect(await runScheduledLeadProcessing()).toMatchObject({ leadsChecked: 0, published: 0 });
});
it('reports an unavailable discovery feed while still retaining verified links from the main page', async () => {
  page(parent, `<link rel="alternate" type="application/rss+xml" href="/unavailable"><a href="${parent}bolsa">Bolsa de pesquisa</a>`);
  expect(await runScheduledDiscovery()).toMatchObject({ newLeads: 1, pageFailures: 1 });
});
it('retains pending sitemap work after its bounded visited history fills', async () => {
  page(parent, '<main>Chamadas</main>', 'text/html', [parent + 'index.xml']);
  page(parent + 'index.xml', '<sitemapindex>' + Array.from({ length: 70 }, (_, i) =>
    `<sitemap><loc>${parent}map-${i}.xml</loc></sitemap>`).join('') + '</sitemapindex>', 'application/xml');
  for (let i = 0; i < 70; i++) page(parent + `map-${i}.xml`, `<urlset><url><loc>${parent}bolsa-${i}</loc></url></urlset>`, 'application/xml');
  for (let i = 0; i < 40; i++) { await due(); await runScheduledDiscovery(); }
  expect((await state.db!.query('select id from discovery_leads')).rows).toHaveLength(70);
});
it('charges failed child requests to the same per-cycle document budget', async () => {
  page(parent, '<main>Chamadas</main>', 'text/html', [parent + 'index.xml']);
  page(parent + 'index.xml', '<sitemapindex>' + Array.from({ length: 70 }, (_, i) =>
    `<sitemap><loc>${parent}unavailable-${i}.xml</loc></sitemap>`).join('') + '</sitemapindex>', 'application/xml');
  const report = await runScheduledDiscovery();
  expect(report.pageFailures).toBeLessThanOrEqual(2);
  await due();
  const next = await runScheduledDiscovery();
  expect(next.pageFailures).toBeLessThanOrEqual(2);
});


it('gives a newly discovered call a bounded turn while preserving the older pending backlog', async () => {
  for (let i = 0; i < 30; i++) await state.db!.query(`insert into discovery_leads(target_id,url,title,first_seen_at,processing_next_at)
    values($1,$2,'Inscrições antigas',now()-interval '3 days',now()-interval '3 days')`, [target, parent + 'old-' + i + '.png']);
  const url = parent + 'nova-bolsa';
  await state.db!.query(`insert into discovery_leads(target_id,url,title) values($1,$2,'Nova bolsa com inscrições abertas')`, [target,url]);
  page(parent, `<a href="${url}">Nova bolsa com inscrições abertas</a>`);
  page(url, detail('Nova bolsa com inscrições abertas'));
  expect(await runScheduledLeadProcessing()).toMatchObject({ leadsChecked: 24, created: 1, published: 1 });
  expect(await listPublicOpportunities()).toEqual([expect.objectContaining({ source_page_url: url })]);
  expect((await state.db!.query("select count(*)::int as count from discovery_leads where processing_status='pending'")).rows).toEqual([{ count: 7 }]);
});


it('reserves pending work between layout re-evaluations rather than treating a null reason as a blocked lead', async () => {
  for (let i = 0; i < 30; i++) await state.db!.query(`insert into discovery_leads(target_id,url,title,processing_status,processing_reason)
    values($1,$2,'Bolsa antiga','blocked','detail_layout_unrecognized')`, [target, parent + 'layout-' + i]);
  const url=parent+'nova-bolsa';
  await state.db!.query(`insert into discovery_leads(target_id,url,title) values($1,$2,'Nova bolsa')`, [target,url]);
  page(parent, `<a href="${url}">Nova bolsa</a>`); page(url,detail('Nova bolsa'));
  expect(await runScheduledLeadProcessing()).toMatchObject({ leadsChecked:24,created:1,published:1 });
});

it('returns an unstarted budget deferral to the queue without spending the final real attempt', async () => {
  const url=parent+'waiting-budget';
  await state.db!.query(`insert into discovery_leads(target_id,url,title,processing_attempts) values($1,$2,'Bolsa',3)`,[target,url]);
  const [lead]=await claimDueDiscoveryLeads(1);
  expect(lead.processing_attempts).toBe(4);
  expect(await finishDiscoveryLead(lead,{reason:'processing_budget_exhausted'})).toMatchObject({state:'retry',deferred:true,published:0});
  expect((await state.db!.query('select processing_attempts,processing_reason from discovery_leads')).rows)
    .toEqual([{processing_attempts:3,processing_reason:'processing_budget_exhausted'}]);
  expect((await state.db!.query("select status,items_failed,execution_metadata->'attempt_consumed' as consumed from ingestion_runs")).rows)
    .toEqual([{status:'completed_with_warnings',items_failed:0,consumed:false}]);
  expect(await claimDueDiscoveryLeads(1)).toEqual([]);
  await state.db!.query("update discovery_leads set processing_next_at=now()-interval '1 minute'");
  const [last]=await claimDueDiscoveryLeads(1);
  expect(await finishDiscoveryLead(last,{reason:'request_timeout',retry:true})).toMatchObject({state:'blocked',reason:'retry_exhausted'});
  expect((await state.db!.query('select processing_attempts from discovery_leads')).rows).toEqual([{processing_attempts:4}]);
  expect((await state.db!.query('select id from opportunities')).rows).toHaveLength(0);
});
