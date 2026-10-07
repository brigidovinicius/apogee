import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Stage 3 applies the approved foundation to member entry without changing its auth contract", async () => {
  const [entry, signup, styles, login] = await Promise.all([
    source("app/membros/entrar/page.tsx"),
    source("app/membros/cadastro/page.tsx"),
    source("components/members/members.module.css"),
    source("app/login/page.tsx"),
  ]);

  for (const page of [entry, signup]) {
    assert.match(page, /className=\{styles\.authIntro\}/);
    assert.match(page, /className=\{`\$\{styles\.panel\} \$\{styles\.authPanel\}`\}/);
    assert.match(page, /safeNextPath\(params\.next\)/);
  }
  assert.match(login, /redirect\(`\/membros\/entrar\?next=\$\{encodeURIComponent\(next\)\}`\)/);
  assert.match(styles, /\.authPanel \{/);
  assert.match(styles, /--apogee-control-min-height/);
  assert.match(styles, /--apogee-radius-soft/);
});

test("Stage 3 keeps the protected Radar path while giving member and opportunity controls responsive touch targets", async () => {
  const [memberPage, access, proxy, memberStyles, opportunityStyles] = await Promise.all([
    source("app/membros/oportunidades/page.tsx"),
    source("lib/opportunities/access.ts"),
    source("proxy.ts"),
    source("components/members/members.module.css"),
    source("components/opportunities/opportunities.module.css"),
  ]);

  assert.match(memberPage, /await requireMember\("\/membros\/oportunidades"\)/);
  assert.match(access, /await requireMember\("\/membros\/oportunidades"\)/);
  assert.match(proxy, /matcher: \["\/membros", "\/membros\/:path\*"\]/);
  assert.match(memberStyles, /@media \(max-width: 640px\)[\s\S]*?\.radarEntryLink \{\s*width: 100%;/);
  assert.match(memberStyles, /\.memberBar a \{[\s\S]*?min-height: var\(--apogee-control-min-height\)/);
  assert.match(opportunityStyles, /\.filterGroup button,[\s\S]*?\.empty button \{[\s\S]*?min-height: var\(--apogee-control-min-height\)/);
  assert.match(opportunityStyles, /@media \(max-width: 760px\)[\s\S]*?\.grid \{\s*grid-template-columns: 1fr;/);
});
