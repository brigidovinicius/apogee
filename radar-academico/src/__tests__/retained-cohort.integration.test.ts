import { readFileSync } from 'node:fs';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import type { PoolClient } from 'pg';
const state = vi.hoisted(() => ({ db: null as PGlite | null }));
vi.mock('@/lib/db/client', () => ({ withAdminTransaction: (work: (client: PoolClient) => Promise<unknown>) =>
  state.db!.transaction(tx => work(tx as unknown as PoolClient)) }));
vi.mock('@/lib/ingestion/fetch-source', () => ({ fetchOfficialResource: vi.fn() }));
import { fetchOfficialResource } from '@/lib/ingestion/fetch-source';
import { runScheduledLeadProcessing } from '@/lib/discovery/process-leads';
import { loadActiveOfficialSources } from '@/lib/ingestion/official-source-registry';
import { recheckKnownOpportunities } from '@/lib/ingestion/recheck';

const ufsc = 'xlsx-20261014-001-ufsc', obq = 'exp-olimpiada-brasileira-de-quimica';
const fixture = (name: string) => readFileSync(new URL(`./fixtures/retained-20261119/${name}.html`, import.meta.url), 'utf8');
type Lead = { id?: string; url: string; title: string; target_id: string; processing_reason: string;
  processing_attempts?: number; discovery_path?: string[] };
const pet = 'https://petletras.paginas.ufsc.br/2026/11/03/edital-022026pet-selecao-de-voluntariosases-estudantes-nao-bolsistas/';
const concert = 'https://noticias.ufsc.br/event/evento-concerto-dos-tenores-di-neoneli/?instance_id=7045';
const ceremony = 'https://obquimica.org/noticias/premiacao-nacional-das-olimpiadas-de-quimica-2026';
const resource = (html: string) => ({ body: Buffer.from(html), contentType: 'text/html',
  hash: createHash('sha256').update(html).digest('hex'), cached: false });
const samples = [
  { url: pet, title: 'Pet-Letras UFSC seleciona estudantes voluntários', target_id: ufsc, processing_reason: 'source_authority_unverified', page: 'ufsc-pet-volunteers' },
  { url: concert, title: 'Evento: Concerto dos Tenores di Neoneli', target_id: ufsc, processing_reason: 'response_limit_exceeded', page: 'ufsc-concert' },
  { url: ceremony, title: 'Premiação Nacional das Olimpíadas de Química 2026', target_id: obq, processing_reason: 'invalid_deadline', page: 'obq-ceremony' },
  { url: 'https://noticias.ufsc.br/2026/11/workshop/', title: 'UFSC sedia workshop', target_id: ufsc, processing_reason: 'detail_layout_unrecognized', page: 'ufsc-workshop' },
  { url: 'https://noticias.ufsc.br/event/exposicao/?instance_id=1', title: 'Exposição: Encontro de Olhares', target_id: ufsc, processing_reason: 'detail_layout_unrecognized', page: 'ufsc-recurrent-exhibition' },
  { url: 'https://drive.google.com/file/d/fixture/view', title: 'edital', target_id: ufsc, processing_reason: 'source_authority_unverified', page: '' },
];

beforeAll(async () => {
  vi.stubEnv('DATABASE_EDITOR_URL', 'postgresql://isolated-test.invalid/unused');
  state.db = new PGlite({ extensions: { pgcrypto } });
  const dir = new URL('../../db/migrations/', import.meta.url);
  for (const name of (await readdir(dir)).filter(name => name.endsWith('.sql')).sort()) {
    await state.db.exec(await readFile(new URL(name, dir), 'utf8'));
  }
}, 30000);
afterAll(async () => { await state.db?.close(); vi.useRealTimers(); vi.unstubAllEnvs(); });
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-19T13:00:00Z'));
  await state.db!.exec(`delete from discovery_leads;delete from ingestion_runs;delete from opportunity_management_events;
    delete from opportunity_revisions;delete from opportunity_sources;delete from opportunities;
    delete from official_sources where id like 'auto-page-%';update discovery_targets set enabled=false;
    update official_sources set active=false;`);
  for (const [id, organizer, root] of [[ufsc, 'UFSC', 'https://noticias.ufsc.br'], [obq, 'Associação Brasileira de Química, UFC e UFPI / PNOQ', 'https://obquimica.org/']]) {
    await state.db!.query(`insert into discovery_targets(id,name,organizer,kind,official_url,evidence_url,enabled,
      official_verified_at,official_verified_url,official_verified_by,official_review_note,topics)
      values($1,$2,$2,'site',$3,$3,true,now(),$3,'test','Fonte oficial revalidada no ensaio isolado.','{}')
      on conflict(id)do update set organizer=$2,official_url=$3,official_verified_url=$3,enabled=true,official_verified_at=now(),topics='{}'`, [id, organizer, root]);
  }
});

async function seed(leads: Lead[]) {
  for (const lead of leads) {
    const root = lead.target_id === ufsc ? 'https://noticias.ufsc.br/' : 'https://obquimica.org/';
    const added = await state.db!.query<{ id: string }>(`insert into discovery_leads(target_id,url,title,processing_status,
      processing_reason,processing_attempts,discovery_path)values($1,$2,$3,'blocked',$4,$5,$6)returning id`,
    [lead.target_id, lead.url, lead.title, lead.processing_reason, lead.processing_attempts ?? 1, lead.discovery_path ?? [root]]);
    await state.db!.query(`insert into ingestion_runs(started_at,finished_at,status,execution_metadata)
      values(now(),now(),'completed_with_warnings',$1)`, [{ component: 'discovery-lead', lead_id: added.rows[0].id, source_expansion_version: 9 }]);
  }
}

function mockedPages(leads: Lead[], pages: Map<string, string>) {
  const roots = new Map(['https://noticias.ufsc.br/', 'https://obquimica.org/'].map(root => [root,
    '<main>' + leads.filter(l => l.target_id === (root.includes('ufsc') ? ufsc : obq))
      .map(l => `<a href="${l.url.replace(/&/g, '&amp;')}">${l.title}</a>`).join('') + '</main>']));
  vi.mocked(fetchOfficialResource).mockImplementation(async url => {
    const body = pages.get(url) ?? roots.get(url);
    if (body === undefined) throw Error('Unexpected official resource: ' + url);
    return resource(body);
  });
}

it('recovers eligible version-nine links automatically, keeps holds and rechecks daily without duplicates or AI cost', async () => {
  await seed(samples);
  mockedPages(samples, new Map(samples.filter(l => l.page).map(l => [l.url, fixture(l.page)])));
  const finance = (await state.db!.query<{ status: unknown }>('select radar_ai.status() as status')).rows[0].status;
  expect(await runScheduledLeadProcessing()).toMatchObject({ leadsChecked: 6, created: 3, published: 3, sourcesRegistered: 3, blocked: 3 });
  const saved = (await state.db!.query<{ id: string }>('select id from opportunities order by id')).rows;
  expect(saved).toHaveLength(3);
  expect((await state.db!.query("select distinct verification_method,publication_issue,ingestion_origin from opportunities")).rows)
    .toEqual([{ verification_method: 'automatic', publication_issue: null, ingestion_origin: 'automatic' }]);
  expect((await state.db!.query('select distinct processing_attempts from discovery_leads')).rows).toEqual([{ processing_attempts: 2 }]);
  expect(await runScheduledLeadProcessing()).toMatchObject({ leadsChecked: 0, created: 0, published: 0 });
  expect((await state.db!.query<{ status: unknown }>('select radar_ai.status() as status')).rows[0].status).toEqual(finance);
  vi.setSystemTime(new Date('2026-11-20T13:00:00Z'));
  await state.db!.exec("update opportunities set next_source_check_at=now()-interval '1 hour'");
  for (const source of await loadActiveOfficialSources()) {
    expect(await recheckKnownOpportunities(source, 5, async body => body.toString('utf8'))).toMatchObject({ failed: 0 });
  }
  expect((await state.db!.query('select id from opportunities order by id')).rows).toEqual(saved);
  expect((await state.db!.query('select count(*)::int as count from radar_ai.operation')).rows).toEqual([{ count: 0 }]);
  expect(vi.mocked(fetchOfficialResource).mock.calls.some(([url]) => /google|openai|instagram/.test(url))).toBe(false);
});

it('retains a changed or removed parent link instead of registering an unverified source', async () => {
  await seed([samples[0]]);mockedPages([], new Map([[pet, fixture('ufsc-pet-volunteers')]]));
  expect(await runScheduledLeadProcessing()).toMatchObject({ created: 0, published: 0, reasons: { source_link_missing: 1 } });
  expect((await state.db!.query('select id from opportunities')).rows).toEqual([]);
});

// Optional read-only replay of recorded public evidence. All writes remain in
// this disposable PGlite DB; no runtime credential, network or paid AI is used.
it.skipIf(!process.env.RADAR_RETAINED_COHORT)('replays every recorded retained link through the automatic transaction', async () => {
  const dir = process.env.RADAR_RETAINED_COHORT!;
  const cohort = JSON.parse(await readFile(dir + '/cohort.json', 'utf8')) as { leads: Lead[] };
  expect(cohort.leads).toHaveLength(21);
  const pages = new Map<string, string>();
  for (const lead of cohort.leads) {
    try { pages.set(lead.url, await readFile(dir + '/pages/' + lead.id + '.html', 'utf8')); }
    catch { /* Auxiliary hosts must be rejected before any resource read. */ }
  }
  pages.set('https://noticias.ufsc.br/', await readFile(dir + '/pages/ufsc-index.html', 'utf8'));
  pages.set('https://obquimica.org/', await readFile(dir + '/pages/obq-index.html', 'utf8'));
  pages.set('https://wp.ufpel.edu.br/water/the-venue/', await readFile(dir + '/pages/ufpel-venue.html', 'utf8'));
  await seed(cohort.leads);mockedPages(cohort.leads, pages);
  const reports = [];
  for (let cycle = 0; cycle < 4; cycle++) {
    const report = await runScheduledLeadProcessing();reports.push(report);
    if (!report.leadsChecked) break;
  }
  const results = (await state.db!.query<{ url: string; title: string; processing_status: string;
    processing_reason: string; processing_attempts: number; processing_opportunity_id: string | null }>(`select url,title,processing_status,processing_reason,processing_attempts,
    processing_opportunity_id from discovery_leads order by url`)).rows;
  expect(results).toHaveLength(21);
  expect(results.every(row => row.processing_attempts === 2)).toBe(true);
  const repeat = await runScheduledLeadProcessing();expect(repeat.leadsChecked).toBe(0);
  const published = (await state.db!.query(`select title,categories,deadline_at,deadline_precision,event_starts_at,
    review_status,opportunity_status,publication_issue,ingestion_origin from opportunities order by title`)).rows;
  expect(published.length).toBeGreaterThanOrEqual(2);
  if (process.env.RADAR_RETAINED_REPORT) await writeFile(process.env.RADAR_RETAINED_REPORT,
    JSON.stringify({ readOnlyReplay: true, productionWrites: 0, paidCalls: 0, reports, repeat, results, published }, null, 2));
});
