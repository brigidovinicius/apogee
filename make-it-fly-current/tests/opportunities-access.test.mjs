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

test("a prévia pública recebe apenas a DTO controlada e não importa fontes completas", async () => {
  const [access, page, preview, board, catalogue, radar] = await Promise.all([
    source("lib/opportunities/access.ts"),
    source("app/oportunidades/page.tsx"),
    source("components/opportunities/opportunities-preview.tsx"),
    source("components/opportunities/opportunities-board.tsx"),
    source("content/opportunities.ts"),
    source("lib/opportunities/radar-client.ts"),
  ]);

  assert.match(access, /^import "server-only";/m);
  assert.match(catalogue, /^import "server-only";/m);
  assert.match(radar, /^import "server-only";/m);
  assert.match(access, /PUBLIC_OPPORTUNITY_SAMPLE_SIZE = 3/);
  assert.match(access, /return \{\s*id: opportunity\.id,\s*title: opportunity\.title,\s*organization: opportunity\.organization,\s*kind: opportunity\.kind,\s*level: opportunity\.level,\s*\};/s);
  assert.match(page, /listPublicOpportunityPreviews/);
  assert.match(page, /OpportunitiesPreview/);
  assert.doesNotMatch(page, /STUDENT_OPPORTUNITIES|listRadarOpportunities|OpportunitiesBoard/);
  assert.doesNotMatch(board, /@\/content\/opportunities|@\/lib\/opportunities\/(access|radar-client)/);

  for (const privateField of ["summary", "eligibility", "benefit", "deadline", "officialUrl", "verifiedAt"]) {
    assert.doesNotMatch(preview, new RegExp(`opportunity\\.${privateField}`), privateField);
  }
  assert.match(preview, /aria-hidden="true"/);
  assert.match(preview, /Os detalhes desta oportunidade ficam disponíveis somente para membros autenticados\./);
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
  assert.match(memberPage, /await requireMember\("\/membros\/oportunidades"\);/);
  assert.match(memberPage, /listMemberOpportunities/);
  assert.match(proxy, /matcher: \["\/membros", "\/membros\/:path\*"\]/);
  assert.match(radarClient, /RADAR_ACADEMICO_API_TOKEN/);
  assert.match(radarClient, /Authorization: `Bearer \$\{radarApiToken\}`/);
  assert.match(radarApi, /isRadarConsumerAuthorized\(request\)/);
  assert.match(radarApi, /status: 401/);
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
