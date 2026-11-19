import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { opportunityLoader } from "./helpers/load-opportunity-module.mjs";

const { benefitNavigation } = opportunityLoader()("lib/benefits/navigation.ts");

test("benefit detail carries only the recognized list and filters on the round trip", () => {
  const { detailSearch } = benefitNavigation({ q: "créditos & IA", categoria: "video", next: "outra-pagina" }, "saved");
  const back = benefitNavigation(Object.fromEntries(new URLSearchParams(detailSearch)), "saved");
  assert.equal(back.listHref, "/membros/beneficios/salvos?q=cr%C3%A9ditos+%26+IA&categoria=video");
  assert.match(detailSearch, /origem=salvos/);
  assert.equal(benefitNavigation({}, "catalogue").detailSearch, "");
  assert.equal(benefitNavigation({ q: "abc" }, "history").detailSearch, "?origem=resgates");
  assert.equal(benefitNavigation({ q: ["x"], categoria: "a/b" }, "catalogue").listHref, "/membros/beneficios");
});

const video = { slug: "video", name: "Vídeo", count: 1 };
const skills = { slug: "skills", name: "Skills", count: 1 };
const entries = [
  { id: "a", categorySlug: "video", categoryName: "Vídeo", name: "Editor", description: "Edição de cenas", url: "https://example.test/video" },
  { id: "b", categorySlug: "skills", categoryName: "Skills", name: "Revisar texto", description: "Instruções para revisar", url: "https://example.test/skill" },
];
async function toolbox(params, allowed = true, categories = [video, skills]) {
  const load = opportunityLoader({
    "next/link": { __esModule: true, default: "a" },
    "next/navigation": { notFound: () => { throw Error("NOT_FOUND"); } },
    "@/components/members/member-workspace": { MemberWorkspace: ({ children }) => children },
    "@/components/members/locked-member-area": { LockedMemberArea: () => "Acesso anual" },
    "@/lib/toolbox/store": { memberToolbox: async selected => ({
      member: {}, access: { allowed }, categories,
      tools: entries.filter(t => (!selected || t.categorySlug === selected) && categories.some(c => c.slug === t.categorySlug)),
    }) },
  });
  return renderToStaticMarkup(await load("app/membros/ferramentas/page.tsx").default({ searchParams: Promise.resolve(params) }));
}

test("tool query and category combine, ignoring case and accents", async () => {
  const html = await toolbox({ q: "EDICAO video", categoria: "video" });
  assert.match(html, /example.test\/video/);
  assert.doesNotMatch(html, /example.test\/skill/);
  assert.match(await toolbox({ q: "inexistente", categoria: "video" }), /Nenhum resultado/);
  await assert.rejects(toolbox({ categoria: "desconhecida" }), /NOT_FOUND/);
});

test("skills are reachable with an empty catalogue and private entries stay behind the gate", async () => {
  const html = await toolbox({ categoria: "skills" });
  assert.match(html, /Abrir skill/);
  assert.doesNotMatch(html, /example.test\/video/);
  assert.match(await toolbox({ categoria: "skills" }, true, []), /Skills em preparação/);
  assert.doesNotMatch(await toolbox({ categoria: "skills" }, false), /example.test|Abrir skill|role="search"/);
});
