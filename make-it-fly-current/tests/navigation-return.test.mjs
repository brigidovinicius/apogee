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

test("the public Radar sends visitors directly to sign-in and routes signed-in members to the filtered catalogue", async () => {
  let signedIn = false;
  let catalogueReads = 0;
  const redirect = href => { throw Error(href); };
  const pageLoad = opportunityLoader({
    "next/link": { __esModule: true, default: "Link" },
    "next/headers": { headers: async () => new Headers() },
    "next/navigation": { redirect },
    "better-auth/cookies": { getSessionCookie: () => signedIn },
    "@/lib/members/dal": { getCurrentMember: async () => ({ id: "fixture" }) },
    "@/components/site/site-header": { SiteHeader: "SiteHeader" },
    "@/components/site/site-footer": { SiteFooter: "SiteFooter" },
    "@/components/site/share-button": { ShareButton: "ShareButton" },
    "@/components/opportunities/opportunities-board": { OpportunitiesBoard: "OpportunitiesBoard" },
    "@/lib/opportunities/access": { listPublicOpportunityPage: async () => { catalogueReads += 1; return null; } },
  });
  const Page = pageLoad("app/oportunidades/page.tsx").default;
  const query = { categoria: "competicoes", pagina: "2", localizacao: "off", token: "ignored" };
  const params = new URLSearchParams(query);
  const tree = await Page({ searchParams: Promise.resolve(query) });
  const expected = memberRadarLoginHref(params);
  assert.equal(nodes(tree, (node) => node.type === "SiteHeader")[0].props.memberHref, expected);
  assert.equal(nodes(tree, node => node.type?.name === "RadarOfferIntro")[0].props.next, memberRadarPath(params));
  signedIn = true;
  await assert.rejects(Page({ searchParams: Promise.resolve(query) }), error => error.message === memberRadarPath(params));
  assert.equal(catalogueReads, 1);
});

test("the public Benefits sign-in and signed-in redirect share the filtered member destination", async () => {
  let signedIn = false;
  const pageLoad = opportunityLoader({
    "next/headers": { headers: async () => new Headers() },
    "next/navigation": { redirect: href => { throw Error(href); } },
    "better-auth/cookies": { getSessionCookie: () => signedIn },
    "@/lib/members/dal": { getCurrentMember: async () => ({ id: "fixture" }) },
    "@/components/site/editorial-page-shell": { EditorialPageShell: "EditorialPageShell" },
    "@/components/benefits/preview-catalogue": { BenefitPreviewCatalogue: "BenefitPreviewCatalogue" },
  });
  const Page = pageLoad("app/beneficios/page.tsx").default;
  const searchParams = Promise.resolve({ q: "crédito", categoria: "video", next: "ignored" });
  const destination = "/membros/beneficios?q=cr%C3%A9dito&categoria=video";
  const tree = await Page({ searchParams });
  assert.equal(tree.props.memberHref, `/membros/entrar?next=${encodeURIComponent(destination)}`);
  signedIn = true;
  await assert.rejects(Page({ searchParams }), error => error.message === destination);
});

test("member route and data guard keep Radar state when authentication or onboarding redirects", async () => {
  const destinations = [];
  const guards = {
    "@/lib/billing/store": { radarAccess:async()=>({active:true}) },
    "@/lib/members/dal": { requireSignedInMember: async (next) => { destinations.push(next); return { id: "local-fixture" }; } },
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
    "@/lib/members/dal": { requireSignedInMember: async () => { throw new Error("authentication-required"); } },
    "@/lib/opportunities/radar-client": { listRadarOpportunities: async () => { catalogueRead = true; return []; } },
  });
  await assert.rejects(denied("lib/opportunities/access.ts").listMemberOpportunityPage(params), /authentication-required/);
  assert.equal(catalogueRead, false);
});

test("member navigation makes Events and entitled Radar resources directly reachable", async () => {
  let radarActive = false;
  const loadBar = opportunityLoader({
    "next/link": { __esModule: true, default: "Link" },
    "./member-navigation": { MemberNavigation: "MemberNavigation" },
    "@/lib/opportunities/personal-calendar": { personalCalendarEnabled: () => true },
    "@/lib/opportunities/collections": { collectionsEnabled: () => true },
    "@/lib/members/resource-availability": { memberResourceAvailability: async () => ({ ferramentas: false }) },
    "@/lib/billing/store": { radarAccess: async () => ({ active: radarActive }) },
  });
  const { MemberBar } = loadBar("components/members/member-bar.tsx");
  const member = { id: "fixture", role: "member" };
  const links = async () => {
    const tree = await MemberBar({ member, current: "calendario" });
    const [nav] = nodes(tree, node => node.props?.["aria-label"] === "Navegação da área de membros");
    return nodes(nav, node => node.type === "Link").map(node => node.props);
  };
  assert.deepEqual((await links()).map(link => link.href), ["/membros", "/membros/oportunidades", "/membros/beneficios", "/membros/eventos"]);
  radarActive = true;
  const direct = await links();
  assert.deepEqual(direct.slice(-2).map(link => link.href), ["/membros/meu-calendario", "/membros/colecoes"]);
  assert.equal(direct.at(-2)["aria-current"], "page");
});

test("shared navigation marks only a defined current section and preserves the configured member destination", () => {
  const headerLoad = opportunityLoader({
    "next/link": { __esModule: true, default: "Link" },
    "next/image": { __esModule: true, default: "Image" },
    "./site-mobile-navigation": { SiteMobileNavigation: "MobileNavigation" },
  });
  const { SiteHeader } = headerLoad("components/site/site-header.tsx");
  const memberHref = "/membros/entrar?next=%2Fmembros%2Foportunidades%3Fcategoria%3Deventos";
  const tree = SiteHeader({ memberHref });
  const entries = nodes(tree, node => node.type?.name === "CommunityEntryLink");
  assert.deepEqual(entries.map(node => node.props.href), [memberHref]);
  const exploreDestinations = ["/blog", "/comunidade#participar", "/galeria", "/loja"];
  const menus = nodes(tree, node => node.type === "MobileNavigation");
  assert.equal(menus.length, 2);
  for (const menu of menus) {
    const entries = nodes(menu, node => node.type === "Link").map(node => node.props.href);
    assert.deepEqual(entries.slice(-4), exploreDestinations);
  }
  assert.equal(nodes(tree, node => node.type === "Link" && node.props["aria-current"] === "page").length, 0);
  for (const adaptive of [false, true]) {
    const selected = nodes(SiteHeader({ current: "benefits", memberHref, adaptive }), node => node.type === "Link" && node.props["aria-current"] === "page");
    assert.equal(selected.length, 2);
    assert.ok(selected.every(node => node.props.href === "/beneficios"));
  }
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
  assert.equal(links.length, 13);
  assert.ok(links.some(link => link.props.href === "/admin/comportamento"));
  assert.ok(links.some(link => link.props.href === "/admin/ferramentas"));
  assert.ok(links.some(link => link.props.href === "/admin/pesquisas"));
  for (const link of links) {
    menu.open = true; focused = false;
    link.props.onNavigate();
    assert.equal(menu.open, false, link.props.href);
    assert.equal(focused, true, link.props.href);
  }
  for (const link of nodes(AdminNav({}), (node) => node.type === "Link")) assert.equal(link.props.onNavigate, undefined);
});
