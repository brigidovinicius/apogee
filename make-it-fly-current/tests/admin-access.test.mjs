import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("admin authorization is enforced on the server and repeated in the data layer", async () => {
  const [access, data, opportunities, dashboard, users, curation, posts, proxy] = await Promise.all([
    source("lib/admin/access.ts"),
    source("lib/admin/data.ts"),
    source("lib/opportunities/access.ts"),
    source("app/admin/page.tsx"),
    source("app/admin/usuarios/page.tsx"),
    source("app/admin/curadoria/page.tsx"),
    source("app/admin/posts/novo/page.tsx"),
    source("proxy.ts"),
  ]);

  assert.match(access, /^import "server-only";/m);
  assert.match(access, /await getCurrentMember\(\)/);
  assert.match(access, /member\.role !== "admin"/);
  assert.match(access, /redirect\("\/admin\/acesso-negado"\)/);
  assert.match(access, /\/membros\/entrar\?next=/);

  assert.match(data, /^import "server-only";/m);
  assert.match(data, /await requireAdmin\("\/admin"\)/);
  assert.match(data, /await requireAdmin\("\/admin\/usuarios"\)/);
  assert.doesNotMatch(data, /account\.password|session\.token|accessToken|refreshToken|idToken/);

  assert.match(opportunities, /await requireAdmin\("\/admin\/curadoria"\)/);
  assert.match(dashboard, /getAdminOverview\(\)/);
  assert.match(users, /listAdminUsers\(search, filter\)/);
  assert.match(curation, /listAdminOpportunityCatalogue\(\)/);
  assert.match(posts, /await requireAdmin\("\/admin\/posts\/novo"\)/);

  assert.match(proxy, /"\/admin", "\/admin\/:path\*"/);
});

test("non-admin members receive an explicit denied state without operational reads", async () => {
  const denied = await source("app/admin/acesso-negado/page.tsx");
  assert.match(denied, /await requireMember\("\/admin\/acesso-negado"\)/);
  assert.match(denied, /member\.role === "admin"/);
  assert.match(denied, /Esta área exige papel administrativo/);
  assert.doesNotMatch(denied, /getAdminOverview|listAdminUsers|listAdminOpportunityCatalogue|getDb/);
});

test("curation remains read-only and links to the authorized Radar review queue", async () => {
  const [curation, editor, navigation, radarPage, radarActions, radarClient] = await Promise.all([
    source("app/admin/curadoria/page.tsx"),
    source("app/admin/posts/novo/page.tsx"),
    source("components/admin/admin-nav.tsx"),
    source("app/admin/radar/page.tsx"),
    source("app/admin/radar/actions.ts"),
    source("lib/opportunities/radar-editorial-client.ts"),
  ]);

  assert.match(curation, /Somente leitura/);
  assert.doesNotMatch(curation, /<form|<button[^>]*name="decision"/);
  assert.match(curation, /href="\/admin\/radar"/);
  assert.match(editor, /disabled/);
  assert.doesNotMatch(editor, /action=|useActionState|fetch\(/);
  for (const label of ["Moderação", "Assinaturas", "Conciliação", "Fila e jobs", "Auditoria"]) {
    assert.match(navigation, new RegExp(`"${label}"`));
  }
  assert.match(navigation, /aria-disabled="true"/);
  assert.match(navigation, /href: "\/admin\/radar"/);

  assert.match(radarPage, /await requireAdmin\("\/admin\/radar"\)/);
  assert.match(radarPage, /Nenhum candidato é publicado automaticamente/);
  assert.match(radarPage, /max="10"/);
  assert.match(radarActions, /await requireAdmin\("\/admin\/radar"\)/);
  assert.match(radarPage, /Aprovar e publicar/);
  assert.match(radarActions, /decideRadarReviewOpportunity/);
  assert.match(radarActions, /maxPages: limit\(formData, "max_pages"\)/);
  assert.match(radarActions, /maxCandidates: limit\(formData, "max_candidates"\)/);
  assert.match(radarClient, /^import "server-only";/m);
  assert.match(radarClient, /RADAR_ACADEMICO_ADMIN_API_TOKEN/);
  assert.match(radarClient, /radar-academico/);
  assert.doesNotMatch(radarClient, /NEXT_PUBLIC/);
});

test("member navigation reveals the admin switch only for an authorized role", async () => {
  const [memberBar, switcher, auth] = await Promise.all([
    source("components/members/member-bar.tsx"),
    source("components/admin/admin-mode-switcher.tsx"),
    source("lib/members/auth.ts"),
  ]);

  assert.match(memberBar, /member\.role === "admin"/);
  assert.match(memberBar, /<AdminModeSwitcher mode="user" \/>/);
  assert.match(switcher, /href="\/admin"/);
  assert.match(auth, /role: "member"/);
  assert.match(auth, /input: false/);
});
