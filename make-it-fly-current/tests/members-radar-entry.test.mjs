import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");
const require = createRequire(import.meta.url);

async function loadMembersPage() {
  const page = await source("app/membros/page.tsx");
  const output = ts.transpileModule(page, {
    fileName: "app/membros/page.tsx",
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  const jsx = (type, props) => ({ type, props: props ?? {} });
  const modules = {
    "next/link": { default: "Link" },
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "@/components/members/format": { formatDateTime: () => "" },
    "@/components/members/member-bar": { MemberBar: "MemberBar" },
    "@/components/members/members.module.css": {
      default: {
        container: "container",
        memberBar: "memberBar",
        pageHead: "pageHead",
        eyebrow: "eyebrow",
        title: "title",
        lead: "lead",
        radarEntry: "radarEntry",
        radarEntryEyebrow: "radarEntryEyebrow",
        radarEntryLink: "radarEntryLink",
        empty: "empty",
      },
    },
    "@/lib/members/dal": { requireMember: async () => ({ name: "Ana Apogee", username: "ana" }) },
    "@/lib/members/forum": { listCategories: async () => [] },
  };
  const loaded = { exports: {} };
  new Function("require", "module", "exports", output)(
    (id) => modules[id] ?? require(id),
    loaded,
    loaded.exports,
  );
  return loaded.exports.default;
}

function findNode(node, predicate) {
  if (!node || typeof node !== "object") return null;
  if (predicate(node)) return node;
  const children = node.props?.children;
  for (const child of Array.isArray(children) ? children : [children]) {
    const found = findNode(child, predicate);
    if (found) return found;
  }
  return null;
}

test("a área autenticada exibe um atalho claro e navegável para o Radar completo", async () => {
  const [MembersPage, styles] = await Promise.all([
    loadMembersPage(),
    source("components/members/members.module.css"),
  ]);

  const tree = await MembersPage();
  const entry = findNode(tree, (node) => node.props?.["aria-labelledby"] === "radar-entry-title");
  const heading = findNode(tree, (node) => node.type === "h2" && node.props?.children === "Radar de Oportunidades");
  const link = findNode(tree, (node) => node.type === "Link" && node.props?.href === "/membros/oportunidades");

  assert.ok(entry, "the authenticated members page renders the Radar entry");
  assert.ok(heading, "the Radar entry has a visible, labelled heading");
  assert.ok(link, "the Radar entry navigates to the protected full Radar");
  assert.match(styles, /\.radarEntry \{/);
  assert.match(styles, /@media \(max-width: 640px\)[\s\S]*?\.radarEntryLink \{\s*width: 100%;/);
});

test("visitantes continuam redirecionados e não recebem os dados completos do Radar", async () => {
  const [proxy, memberPage, access] = await Promise.all([
    source("proxy.ts"),
    source("app/membros/oportunidades/page.tsx"),
    source("lib/opportunities/access.ts"),
  ]);

  assert.match(proxy, /matcher: \["\/membros", "\/membros\/:path\*"\]/);
  assert.match(proxy, /login\.searchParams\.set\("next", pathname \+ search\)/);
  assert.match(memberPage, /await requireMember\("\/membros\/oportunidades"\)/);
  assert.match(access, /await requireMember\("\/membros\/oportunidades"\)/);
});
