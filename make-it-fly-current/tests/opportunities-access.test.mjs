import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");
const require = createRequire(import.meta.url);

async function loadRadarConsumer() {
  const helperSource = await readFile(new URL("../../radar-academico/src/lib/auth/radar-consumer.ts", import.meta.url), "utf8");
  const output = ts.transpileModule(helperSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const loaded = { exports: {} };
  new Function("require", "module", "exports", output)(require, loaded, loaded.exports);
  return loaded.exports;
}

test("public and member access share the live source without static fallback", async () => {
  const [access, page, board, radar] = await Promise.all([
    source("lib/opportunities/access.ts"), source("app/oportunidades/page.tsx"),
    source("components/opportunities/opportunities-board.tsx"), source("lib/opportunities/radar-client.ts"),
  ]);
  assert.match(access, /^import "server-only";/m);
  assert.doesNotMatch(access, /STUDENT_OPPORTUNITIES|mergeOpportunities|SAMPLE_SIZE/);
  assert.match(page, /listPublicOpportunityPage/);
  assert.match(page, /OpportunitiesBoard/);
  assert.match(page, /Catálogo temporariamente indisponível/);
  assert.doesNotMatch(board, /@\/content\/opportunities|@\/lib\/opportunities\/(access|radar-client)/);
  assert.match(radar, /cache: "no-store"/);
  assert.doesNotMatch(radar, /aprovada em revisão/);
});

test("o Radar completo exige sessão tanto na rota quanto na camada de acesso", async () => {
  const [access, memberPage, proxy, radarClient, radarApi] = await Promise.all([
    source("lib/opportunities/access.ts"),
    source("app/membros/oportunidades/page.tsx"),
    source("proxy.ts"),
    source("lib/opportunities/radar-client.ts"),
    readFile(new URL("../../radar-academico/src/app/api/public/opportunities/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(access, /await requireMember\("\/membros\/oportunidades"\);/);
  assert.match(memberPage, /await requireMember\(memberRadarPath\(params\)\);/);
  assert.match(memberPage, /listMemberOpportunityPage/);
  assert.match(proxy, /matcher: \["\/membros", "\/membros\/:path\*", "\/admin", "\/admin\/:path\*"\]/);
  assert.match(radarClient, /RADAR_ACADEMICO_API_TOKEN/);
  assert.match(radarClient, /Authorization: `Bearer \$\{radarApiToken\}`/);
  assert.match(radarApi, /isRadarConsumerAuthorized\(request\)/);
  assert.match(radarApi, /status: 401/);
});

test("o painel de filtros expõe estado, relações e fechamento por teclado", async () => {
  const board = await source("components/opportunities/opportunities-board.tsx");

  assert.match(board, /aria-expanded=\{filtersOpen\}/);
  assert.match(board, /aria-controls="opportunity-filter-panel"/);
  assert.match(board, /role="region"/);
  assert.match(board, /hidden=\{!filtersOpen\}/);
  assert.match(board, /event\.key === "Escape"/);
  assert.match(board, /filterButtonRef\.current\?\.focus\(\)/);
  assert.match(board, /aria-live="polite"/);
  assert.match(board, /disabled=\{activeFilterCount === 0\}/);
  assert.match(board, /id="opportunity-state"/);
  assert.match(board, /id="opportunity-city"/);
  assert.match(board, /disabled=\{!filters\.stateCode \|\| cityOptions\.length === 0\}/);
  assert.match(board, /router\.replace\(query \? `\$\{pathname\}\?\$\{query\}` : pathname, \{ scroll: false \}\)/);
});

test("a credencial da integração do Radar falha fechada e só aceita o bearer configurado", async () => {
  const { isRadarConsumerAuthorized } = await loadRadarConsumer();
  const originalToken = process.env.RADAR_ACADEMICO_API_TOKEN;

  try {
    delete process.env.RADAR_ACADEMICO_API_TOKEN;
    assert.equal(isRadarConsumerAuthorized(new Request("http://radar.test/api/public/opportunities")), false);

    process.env.RADAR_ACADEMICO_API_TOKEN = "integration-secret";
    assert.equal(isRadarConsumerAuthorized(new Request("http://radar.test/api/public/opportunities")), false);
    assert.equal(isRadarConsumerAuthorized(new Request("http://radar.test/api/public/opportunities", {
      headers: { Authorization: "Bearer wrong-secret" },
    })), false);
    assert.equal(isRadarConsumerAuthorized(new Request("http://radar.test/api/public/opportunities", {
      headers: { Authorization: "Bearer integration-secret" },
    })), true);
  } finally {
    if (originalToken === undefined) delete process.env.RADAR_ACADEMICO_API_TOKEN;
    else process.env.RADAR_ACADEMICO_API_TOKEN = originalToken;
  }
});
