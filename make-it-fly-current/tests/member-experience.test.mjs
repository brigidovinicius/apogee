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
  for (const kind of ["ferramentas", "beneficios", "forum", "calendario", "colecoes", "perfil"]) {
    const html = renderToStaticMarkup(React.createElement(LockedMemberArea, { kind, next: `/membros/${kind}` }));
    assert.match(html, /aria-hidden="true" inert="" data-locked-preview=/);
    const backdrop = html.slice(html.indexOf('data-locked-preview='), html.indexOf('class="notice"'));
    assert.doesNotMatch(backdrop, /href=|<button|<form|<input|<iframe/);
    assert.match(html, /Conhecer a assinatura anual/);
    assert.doesNotMatch(html, /labs\.google|PRIVATE_|redemption_url|resource_url/);
  }
});

test("the learning page requires a session and renders the coming-soon panel with an inert preview", async () => {
  let signedIn = false;
  const LearningPage = opportunityLoader({ ...uiMocks,
    "@/lib/members/dal": { requireSignedInMember: async path => {
      assert.equal(path, "/membros/trilha");
      if (!signedIn) throw Error("SIGN_IN_REQUIRED");
      return member;
    } },
    "@/components/members/member-workspace": { MemberWorkspace: ({ current, children }) => {
      assert.equal(current, "trilha");
      return children;
    } },
  })("app/membros/trilha/page.tsx").default;
  await assert.rejects(LearningPage(), /SIGN_IN_REQUIRED/);
  signedIn = true;
  const html = renderToStaticMarkup(await LearningPage());
  assert.match(html, /aria-hidden="true" inert="" data-locked-preview="trilha"/);
  assert.match(html, /<h2[^>]*>Em breve<\/h2>/);
  assert.doesNotMatch(html, /Um primeiro resultado com IA|name="activityId"|Conhecer a assinatura anual/);
});

test("free accounts see the community forum without gaining paid offers", async () => {
  let forumReads = 0;
  const Page = opportunityLoader({ ...uiMocks,
    "@/lib/members/dal": { requireSignedInMember: async () => member },
    "@/lib/members/forum": { listCategories: async () => { forumReads++; return []; } },
    "@/lib/billing/store": { radarAccess: async () => ({ active: false }) },
    "@/lib/billing/community-store": { communityAccess: async () => ({ active: false }) },
  })("app/membros/page.tsx").default;
  const html = renderToStaticMarkup(await Page());
  assert.equal(forumReads, 1);
  assert.doesNotMatch(html, /href="\/membros\/ferramentas"/);
  for (const path of ["/membros/beneficios", "/membros/oportunidades", "/membros/assinatura"]) assert.ok(html.includes(`href="${path}"`), path);
  assert.match(html, /Conversas da comunidade/);
  assert.doesNotMatch(html, /Verificar minha conta|data-locked-preview="forum"/);
});

test("free and legacy members never load paid catalogues; paid catalogues still use the signed-in guard", async () => {
  let paid = false, sessionChecks = 0, catalogueReads = 0;
  const load = opportunityLoader({
    "@/lib/members/dal": {
      requireSignedInMember: async () => member,
      requireMember: async () => { sessionChecks++; throw Error("SESSION_REQUIRED"); },
    },
    "@/lib/members/db": { getSql: () => { catalogueReads++; throw Error("PRIVATE_READ"); } },
    "@/lib/billing/community-store": { communityAccess: async () => ({ active: paid, paidUntil: null }) },
  });
  const toolbox = load("lib/toolbox/store.ts"), deliverables = load("lib/deliverables/store.ts");
  assert.deepEqual((await toolbox.memberToolbox()).tools, []);
  assert.deepEqual((await deliverables.memberBenefits()).benefits, []);
  assert.equal(sessionChecks, 0);
  assert.equal(catalogueReads, 0);
  paid = true;
  for (const read of [() => toolbox.memberToolbox(), () => deliverables.memberBenefits()]) await assert.rejects(read(), /SESSION_REQUIRED/);
  assert.equal(sessionChecks, 2);
  assert.equal(catalogueReads, 0);
});

test("administrator content is visible without inventing a paid subscription in the home", async () => {
  const admin = { ...member, role: "admin" };
  const load = opportunityLoader({ ...uiMocks,
    "@/lib/members/dal": { requireSignedInMember: async () => admin, requireMember: async () => { throw Error("SESSION_REQUIRED"); } },
    "@/lib/members/db": { getSql: () => async (query) => {
      assert.doesNotMatch(query.join(""), /member_learning/);
      return [{ ferramentas: true }];
    } },
    "@/lib/billing/community-store": { communityAccess: async () => ({ active: false }) },
    "@/lib/billing/store": { radarAccess: async () => ({ active: true }) },
    "@/lib/members/forum": { listCategories: async () => [] },
  });
  const deliverables = load("lib/deliverables/store.ts");
  await assert.rejects(deliverables.memberBenefits(), /SESSION_REQUIRED/);
  const home = load("app/membros/page.tsx").default;
  const html = renderToStaticMarkup(await home());
  assert.doesNotMatch(html, /Exclusivo da assinatura|Assinatura anual ativa|Prévia administrativa/);
  assert.match(html, /href="\/membros\/ferramentas"/);
  assert.doesNotMatch(html, /Um primeiro resultado com IA|name="activityId"/);
});

test("calendar and collection previews preserve the destination and respect existing Radar rights", async () => {
  let state = { kind: "redirect", href: "/membros/radar/acesso" };
  const gates = opportunityLoader({ ...uiMocks,
    "@/lib/members/dal": { requireSignedInMember: async () => member },
    "@/lib/opportunities/personal-calendar": { calendarSaveAccess: async () => state },
  })("components/members/member-page-access.tsx");
  for (const kind of ["calendario", "colecoes"]) {
    const html = renderToStaticMarkup(await gates.calendarPagePreview(kind, `/membros/${kind}`));
    assert.match(html, /Conhecer a assinatura anual/);
    assert.ok(html.includes(encodeURIComponent(`/membros/${kind}`)));
  }
  state = { kind: "redirect", href: "/membros/radar/acesso" };
  assert.match(renderToStaticMarkup(await gates.calendarPagePreview("calendario", "/membros/meu-calendario")), /Conhecer a assinatura anual/);
  state = { kind: "ready", member };
  assert.equal(await gates.calendarPagePreview("calendario", "/membros/meu-calendario"), null);
  state = { kind: "disabled" };
  assert.match(renderToStaticMarkup(await gates.calendarPagePreview("calendario", "/membros/meu-calendario")), /em preparação/);
});

test("all authenticated accounts enter the member area without requiring an annual subscription", () => {
  const load = opportunityLoader({ ...uiMocks,
    "next/navigation": { usePathname: () => "/", useRouter: () => ({ refresh() {} }) },
    "@/app/membros/actions": { signOut: async () => {} },
  });
  const { AccountProvider, CommunityEntryLink, MemberBrandLink } = load("components/members/account-menu.tsx");
  const render = (account, child) => renderToStaticMarkup(React.createElement(AccountProvider, { account }, child));
  assert.match(render(null, React.createElement(CommunityEntryLink)), /href="\/membros\/entrar"[\s\S]*Entrar/);
  const login = "/membros/entrar?next=%2Fmembros%2Feventos";
  assert.ok(render(null, React.createElement(CommunityEntryLink, { href: login })).includes(login));
  assert.match(render(member, React.createElement(CommunityEntryLink, { href: login })), /href="\/membros"[\s\S]*Minha comunidade/);
  assert.match(render(member, React.createElement(MemberBrandLink, null, "Apogee")), /href="\/membros"/);
  assert.match(render(null, React.createElement(MemberBrandLink, null, "Apogee")), /href="\/"/);
});

test("the account menu exposes logout and never offers administration to ordinary members", () => {
  const load = opportunityLoader({ ...uiMocks,
    "next/navigation": { usePathname: () => "/", useRouter: () => ({ refresh() {} }) },
    "@/app/membros/actions": { signOut: async () => {} },
  });
  const { AccountProvider, AccountMenu } = load("components/members/account-menu.tsx");
  const render = account => renderToStaticMarkup(React.createElement(AccountProvider, { account }, React.createElement(AccountMenu, { fallback: React.createElement("a", { href: "/membros" }, "Membros") })));
  assert.equal(render(null), '<a href="/membros">Membros</a>');
  const html = render(member);
  assert.match(html, /Minha conta/); assert.match(html, /Sair da conta/);
  assert.ok(html.includes(`href="/membros/perfil/${member.username}"`));
  assert.match(html, /Voltar ao site/);
  assert.doesNotMatch(html, /href="\/admin"|email|synthetic-member/);
  assert.match(render({ ...member, role: "admin" }), /href="\/admin"/);
});
