import assert from "node:assert/strict";
import test from "node:test";
import * as React from "react";
import { opportunityLoader } from "./helpers/load-opportunity-module.mjs";

const load = opportunityLoader();
const { memberRadarPath, memberRadarLoginHref } = load("lib/opportunities/navigation.ts");
const { safeNextPath } = load("lib/members/validation.ts");

function nodes(tree, predicate) {
  if (Array.isArray(tree)) return tree.flatMap((child) => nodes(child, predicate));
  if (!tree || typeof tree !== "object") return [];
  return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)];
}

test("Radar login round-trips every supported filter and pagination through the existing auth validator", () => {
  const params = new URLSearchParams({ categoria: "competicoes", modalidade: "Prêmio", formacao: "Graduação",
    uf: "SC", cidade: "Florianópolis", busca: "ciência & inovação", formato: "online", abrangencia: "nacional",
    beneficio: "premiacao", prazo: "30dias", pagina: "2" });
  const login = new URL(memberRadarLoginHref(params), "https://apogee.test");
  const next = safeNextPath(login.searchParams.get("next"));
  const destination = new URL(next, "https://apogee.test");
  assert.equal(login.pathname, "/membros/entrar");
  assert.equal(destination.pathname, "/membros/oportunidades");
  for (const [key, value] of params) assert.equal(destination.searchParams.get(key), value, key);
});

test("Radar transfers no unrelated destinations and ignores invalid page numbers", () => {
  assert.equal(memberRadarLoginHref(new URLSearchParams()), "/membros/entrar?next=%2Fmembros%2Foportunidades");
  assert.equal(memberRadarPath(new URLSearchParams("categoria=invalida&next=https://example.org&token=private")), "/membros/oportunidades");
  for (const page of ["-1", "0", "1", "1.5", "Infinity", "abc", "9007199254740992"])
    assert.equal(memberRadarPath(new URLSearchParams({ pagina: page })), "/membros/oportunidades", page);
  assert.equal(memberRadarPath(new URLSearchParams({ busca: "x".repeat(150) })).split("busca=")[1].length, 100);
});

test("the public page uses the same filtered login destination in its header and CTA", async () => {
  const pageLoad = opportunityLoader({
    "next/link": { __esModule: true, default: "Link" },
    "@/components/site/site-header": { SiteHeader: "SiteHeader" },
    "@/components/site/site-footer": { SiteFooter: "SiteFooter" },
    "@/components/site/share-button": { ShareButton: "ShareButton" },
    "@/components/opportunities/opportunities-board": { OpportunitiesBoard: "OpportunitiesBoard" },
    "@/lib/opportunities/access": { listPublicOpportunityPage: async () => null },
  });
  const Page = pageLoad("app/oportunidades/page.tsx").default;
  const tree = await Page({ searchParams: Promise.resolve({ categoria: "competicoes", pagina: "2" }) });
  const expected = "/membros/entrar?next=%2Fmembros%2Foportunidades%3Fcategoria%3Dcompeticoes%26pagina%3D2";
  assert.equal(nodes(tree, (node) => node.type === "SiteHeader")[0].props.memberHref, expected);
  assert.equal(nodes(tree, (node) => node.type === "Link")[0].props.href, expected);
});

test("member route and data guard keep Radar state when authentication or onboarding redirects", async () => {
  const destinations = [];
  const guards = {
    "@/lib/members/dal": { requireMember: async (next) => { destinations.push(next); return { id: "local-fixture" }; } },
    "@/lib/billing/access": { requireRadarAccess: async () => {} },
    "@/lib/admin/access": { requireAdmin: async () => {} },
    "@/lib/opportunities/radar-client": { listRadarOpportunities: async () => [] },
    "@/components/members/member-bar": { MemberBar: "MemberBar" },
    "@/components/opportunities/opportunities-board": { OpportunitiesBoard: "OpportunitiesBoard" },
  };
  const memberLoad = opportunityLoader(guards);
  const params = new URLSearchParams("categoria=competicoes&pagina=2");
  await memberLoad("app/membros/oportunidades/page.tsx").default({ searchParams: Promise.resolve(Object.fromEntries(params)) });
  assert.deepEqual(destinations, [memberRadarPath(params), memberRadarPath(params)]);

  let catalogueRead = false;
  const denied = opportunityLoader({ ...guards,
    "@/lib/members/dal": { requireMember: async () => { throw new Error("authentication-required"); } },
    "@/lib/opportunities/radar-client": { listRadarOpportunities: async () => { catalogueRead = true; return []; } },
  });
  await assert.rejects(denied("lib/opportunities/access.ts").listMemberOpportunityPage(params), /authentication-required/);
  assert.equal(catalogueRead, false);
});

test("every mobile admin destination closes the persistent details menu and restores focus", () => {
  let focused = false;
  const menu = { open: true, querySelector: () => ({ focus: () => { focused = true; } }) };
  const adminLoad = opportunityLoader({
    react: { ...React, useRef: () => ({ current: { closest: () => menu } }) },
    "next/link": { __esModule: true, default: "Link" },
    "next/navigation": { usePathname: () => "/admin" },
  });
  const { AdminNav } = adminLoad("components/admin/admin-nav.tsx");
  const links = nodes(AdminNav({ compact: true }), (node) => node.type === "Link");
  assert.equal(links.length, 6);
  for (const link of links) {
    menu.open = true; focused = false;
    link.props.onNavigate();
    assert.equal(menu.open, false, link.props.href);
    assert.equal(focused, true, link.props.href);
  }
  for (const link of nodes(AdminNav({}), (node) => node.type === "Link")) assert.equal(link.props.onNavigate, undefined);
});
