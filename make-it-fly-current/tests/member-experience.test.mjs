import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { opportunityLoader } from "./helpers/load-opportunity-module.mjs";

const Link = ({ children, prefetch, ...props }) => { void prefetch; return React.createElement("a", props, children); };
const member = { id: "synthetic-member", name: "Pessoa Revisora", username: "revisora", role: "member", image: null };
const uiMocks = { "next/link": { __esModule: true, default: Link }, "@/components/members/member-bar": { MemberBar: () => null } };

test("every exclusive preview is inert, decorative and contains no real action or private record", () => {
  const { LockedMemberArea } = opportunityLoader(uiMocks)("components/members/locked-member-area.tsx");
  for (const kind of ["ferramentas", "beneficios", "trilha", "forum", "calendario", "colecoes", "perfil"]) {
    const html = renderToStaticMarkup(React.createElement(LockedMemberArea, { kind, next: `/membros/${kind}` }));
    assert.match(html, /aria-hidden="true" inert="" data-locked-preview=/);
    const backdrop = html.slice(html.indexOf('data-locked-preview='), html.indexOf('class="notice"'));
    assert.doesNotMatch(backdrop, /href=|<button|<form|<input|<iframe/);
    assert.match(html, /Conhecer a assinatura anual/);
    assert.doesNotMatch(html, /labs\.google|PRIVATE_|redemption_url|resource_url/);
  }
});

test("pending free accounts can discover their home without reading the forum or granting access", async () => {
  let forumReads = 0;
  const Page = opportunityLoader({ ...uiMocks,
    "@/lib/members/dal": { requireSignedInMember: async () => member },
    "@/lib/members/protection": { adultAccess: async () => false },
    "@/lib/members/forum": { listCategories: async () => { forumReads++; throw Error("Private forum must remain unread"); } },
    "@/lib/billing/store": { radarAccess: async () => ({ active: false }) },
    "@/lib/billing/community-store": { communityAccess: async () => ({ active: false }) },
  })("app/membros/page.tsx").default;
  const html = renderToStaticMarkup(await Page());
  assert.equal(forumReads, 0);
  for (const path of ["/membros/ferramentas", "/membros/beneficios", "/membros/trilha", "/membros/oportunidades"]) assert.ok(html.includes(`href="${path}"`), path);
  assert.match(html, /Verificar minha conta/);
  assert.match(html, /data-locked-preview="forum"/);
});

test("free and legacy members never load paid catalogues; paid members still require account verification", async () => {
  let paid = false, verificationChecks = 0, catalogueReads = 0;
  const load = opportunityLoader({
    "@/lib/members/dal": {
      requireSignedInMember: async () => member,
      requireMember: async () => { verificationChecks++; throw Error("VERIFICATION_REQUIRED"); },
    },
    "@/lib/members/db": { getSql: () => { catalogueReads++; throw Error("PRIVATE_READ"); } },
    "@/lib/billing/community-store": { communityAccess: async () => ({ active: paid, paidUntil: null }) },
  });
  const toolbox = load("lib/toolbox/store.ts"), deliverables = load("lib/deliverables/store.ts");
  assert.deepEqual((await toolbox.memberToolbox()).tools, []);
  assert.deepEqual((await deliverables.memberBenefits()).benefits, []);
  assert.deepEqual((await deliverables.memberLearning()).activities, []);
  await assert.rejects(deliverables.setLearningProgress({ activityId: "private", completed: true }), /anual/);
  assert.equal(verificationChecks, 0);
  assert.equal(catalogueReads, 0);
  paid = true;
  for (const read of [() => toolbox.memberToolbox(), () => deliverables.memberBenefits(), () => deliverables.memberLearning(), () => deliverables.setLearningProgress({})]) await assert.rejects(read(), /VERIFICATION_REQUIRED/);
  assert.equal(verificationChecks, 4);
  assert.equal(catalogueReads, 0);
});

test("administrator content access still requires account verification and never invents a paid subscription in the home", async () => {
  const admin = { ...member, role: "admin" };
  const load = opportunityLoader({ ...uiMocks,
    "@/lib/members/dal": { requireSignedInMember: async () => admin, requireMember: async () => { throw Error("VERIFICATION_REQUIRED"); } },
    "@/lib/members/db": { getSql: () => { throw Error("PRIVATE_READ"); } },
    "@/lib/billing/community-store": { communityAccess: async () => ({ active: false }) },
    "@/lib/billing/store": { radarAccess: async () => ({ active: true }) },
    "@/lib/members/protection": { adultAccess: async () => true },
    "@/lib/members/forum": { listCategories: async () => [] },
  });
  const deliverables = load("lib/deliverables/store.ts");
  for (const read of [() => deliverables.memberBenefits(), () => deliverables.memberLearning(), () => deliverables.setLearningProgress({})]) await assert.rejects(read(), /VERIFICATION_REQUIRED/);
  const html = renderToStaticMarkup(await load("app/membros/page.tsx").default());
  assert.doesNotMatch(html, /Exclusivo da assinatura|Assinatura anual ativa|Prévia administrativa/);
  assert.match(html, /href="\/membros\/trilha"/);
});

test("calendar and collection previews preserve the destination and respect verification and existing Radar rights", async () => {
  let state = { kind: "redirect", href: "/membros/protecao" };
  const gates = opportunityLoader({ ...uiMocks,
    "@/lib/members/dal": { requireSignedInMember: async () => member },
    "@/lib/members/protection": { adultAccess: async () => false },
    "@/lib/opportunities/personal-calendar": { calendarSaveAccess: async () => state },
  })("components/members/member-page-access.tsx");
  for (const kind of ["calendario", "colecoes"]) {
    const html = renderToStaticMarkup(await gates.calendarPagePreview(kind, `/membros/${kind}`));
    assert.match(html, /Verificar minha conta/);
    assert.ok(html.includes(encodeURIComponent(`/membros/${kind}`)));
  }
  state = { kind: "redirect", href: "/membros/radar/acesso" };
  assert.match(renderToStaticMarkup(await gates.calendarPagePreview("calendario", "/membros/meu-calendario")), /Conhecer a assinatura anual/);
  state = { kind: "ready", member };
  assert.equal(await gates.calendarPagePreview("calendario", "/membros/meu-calendario"), null);
  state = { kind: "disabled" };
  assert.match(renderToStaticMarkup(await gates.calendarPagePreview("calendario", "/membros/meu-calendario")), /em preparação/);
});

test("the global account menu exposes logout on public pages and never offers administration to ordinary members", () => {
  const load = opportunityLoader({ ...uiMocks,
    "next/navigation": { usePathname: () => "/", useRouter: () => ({ refresh() {} }) },
    "@/app/membros/actions": { signOut: async () => {} },
  });
  const { AccountProvider, AccountMenu } = load("components/members/account-menu.tsx");
  const render = account => renderToStaticMarkup(React.createElement(AccountProvider, { account }, React.createElement(AccountMenu, { fallback: React.createElement("a", { href: "/membros" }, "Membros") })));
  assert.equal(render(null), '<a href="/membros">Membros</a>');
  const html = render(member);
  assert.match(html, /Minha conta/); assert.match(html, /Sair da conta/);
  assert.doesNotMatch(html, /href="\/admin"|email|synthetic-member/);
  assert.match(render({ ...member, role: "admin" }), /href="\/admin"/);
});
