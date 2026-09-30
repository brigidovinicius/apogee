import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import ts from "typescript";
import { restorePreApplicationSource } from "./application-preservation.mjs";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");
const sha1 = (bytes) => createHash("sha1").update(bytes).digest("hex");
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

// Legacy backup pinned to recovered deployment dpl_7zYo7vXKvP8fo9J7Ei2q2PQnGMUu.
// These checks are self-contained: no external baseline directory is needed.
// SHA-1 is used only to compare against the original recovery manifest.
async function assertUnchanged(path, expected, normalize = (bytes) => bytes) {
  const bytes = await readFile(new URL(path, root));
  assert.equal(sha1(normalize(bytes)), expected, `${path} must preserve the recovered legacy source`);
}

async function readMetadata(path) {
  const text = await source(path);
  const file = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declaration = file.statements.filter(ts.isVariableStatement)
    .flatMap(statement => statement.declarationList.declarations)
    .find(variable => variable.name.getText(file) === "metadata");
  assert.ok(declaration?.initializer, `${path} must declare its own metadata`);
  // Evaluate only the metadata initializer, excluding layout imports and fonts.
  const { outputText } = ts.transpileModule(`export const metadata = ${declaration.initializer.getText(file)};`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  });
  const exports = {};
  new Function("exports", outputText)(exports);
  return exports.metadata;
}

test("legacy landing backup is unchanged except for its isolated content import", async () => {
  const path = "components/published/make-it-fly-v2.tsx";
  const text = await source(path);
  assert.equal(text.match(/@\/content\/published-site/g)?.length, 1);
  assert.doesNotMatch(text, /@\/content\/site["']|@\/components\/hero\//);
  await assertUnchanged(path, "87f6d0026d3051e423e7c14e0287ac7854afa372", (bytes) =>
    bytes.toString().replace("@/content/published-site", "@/content/site"));
});

test("legacy content and both legacy stylesheets retain their exact original bytes", async () => {
  await assertUnchanged("content/published-site.ts", "c3e862cf5cc9f61f262f2bb256398687a98e1f42");
  await assertUnchanged("components/published/make-it-fly-v2.module.css", "bc28ed8e3419ec8cfef24f85a7c6b6d4618f936e");
  await assertUnchanged("app/(publicado)/globals.css", "475151175d91c88058992b9daaa6243d3d62fb30");
});

test("the single root layout preserves the approved visual wrapper and relocated local fonts", async () => {
  const path = "app/layout.tsx";
  const text = await source(path);
  const file = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const visual = file.statements.filter(statement => !(ts.isVariableStatement(statement)
    && statement.declarationList.declarations.some(declaration => declaration.name.getText(file) === "metadata"))
    && !(ts.isImportDeclaration(statement) && statement.moduleSpecifier.text === "@/components/analytics/JourneyTracker"))
    .map(statement => statement.getText(file)).join("\n").replaceAll("../fonts/", "./fonts/")
    .replace("        <JourneyTracker />\n", "");
  assert.equal(sha256(visual), "bb2dbfad30652ec73ab9929b3732b448473f74112cbcb0cdaac56663c16f2cc0",
    "only metadata and the relocated font paths may differ from the approved layout");
  assert.ok(visual.includes("<html") && visual.includes("<body"));
  assert.match(text, /import "\.\/globals\.css"/);
  assert.equal((text.match(/<JourneyTracker \/>/g) ?? []).length, 1);
  assert.doesNotMatch(text, /\(teste\)|\(publicado\)|next\/font\/google|\.\.\/fonts\//);
  const fonts = [...text.matchAll(/["'](\.\/fonts\/[^"']+\.woff2)["']/g)].map(match => match[1]);
  assert.equal(fonts.length, 7);
  for (const font of fonts) assert.ok(existsSync(new URL(font, new URL(path, root))), font);
  await readMetadata(path);
});

test("the Make It Fly page directly renders the byte-identical approved page", async () => {
  const publishedPage = await source("app/makeitfly/page.tsx");
  assert.equal(sha256(publishedPage), "ee79483da8a4f08cb583f4909a920463c617fd8b427f7c24652de5c40b197654");
  assert.equal(publishedPage.match(/@\/components\/landing\/make-it-fly-v2/g)?.length, 1);
  assert.match(publishedPage, /return\s+<MakeItFlyV2\s*\/>/);
  assert.doesNotMatch(publishedPage, /components\/published|redirect\s*\(/);
});

test("all original fonts, public assets and shared legacy dependencies retain their hashes", async () => {
  const original = {
    "app/favicon.ico": "9ecfcc8f0ead0bf3d2d7c39e084b88f41cc89a2e",
    "app/fonts/dm-mono-300-latin.woff2": "3155a36f511a94a7d835fdc0bf2a5ed97f818357",
    "app/fonts/dm-mono-400-latin.woff2": "f41e4e83f8222fac2fbd95ac6f3b7bdd2fe4fe5b",
    "app/fonts/dm-mono-500-latin.woff2": "0fca4facaa0a279288b128a27a231c4974bee58b",
    "app/fonts/inter-variable-latin.woff2": "1dc044f4824fd5af6bfed67fee48be70fa069f3f",
    "app/fonts/public-sans-variable-latin.woff2": "989b6c577de591300a4a67eae64de52874a595c5",
    "components/ui/button.tsx": "b931559ae8376698547e0081e4860dddb3f3232a",
    "components/ui/hyperdrive-hero.tsx": "eb150c251665f8470f3b693a2e0cad81b702449b",
    "components/ui/landing-page.tsx": "3e1123ab7ff453459b8066f7eb909acaabc3a583",
    "components/ui/lunar-gravity-card.tsx": "267dcb04dc720c436fe220fb64f07642f2c2c99d",
    "components/ui/moon-scene.tsx": "795ee06da7e225acaae6125ee35553786cef8428",
    "components/ui/starfield-background.tsx": "9d0a65764dc0a113036ad4ecb56ceda80c53c648",
    "lib/utils.ts": "f8a9cf1b19a39d0008d291734254f336c9bde72f",
    "public/brand/apogee-logo-navy.svg": "02e60f4c3510b03cba70647ffbf56c6307b07bd4",
    "public/brand/apogee-logo-white.svg": "f15d7e7e0273c732d152fbd0ed451969c7c6325d",
    "public/brand/apogee-star.svg": "61b0a510e697f572df9f7c0625969891bdaa90f7",
    "public/brand/make-it-fly-wordmark.png": "b3938a6f70aaf8cba28cb5ea77db8c9c827be333",
    "public/file.svg": "fb380eeffe87d50b597383664c02982964d0d28c",
    "public/globe.svg": "2eba23b01a46733bb8423e6d38ebf5f7e95abec5",
    "public/next.svg": "3f3e95622612b989c5bd6a03299a308c6f3c7e6b",
    "public/partners/red-bull.png": "226400d74e34fafeb895082175571ae3e279a7c9",
    "public/rosa/retrato-nasa.webp": "84aeb6d1b0b497bf34e4cf960ac5fcad6bbbdcd2",
    "public/rosa/saturn-v.webp": "47161c087b9a20b89f366fdc20e90237bb59385f",
    "public/textures/moon.jpg": "48b884811328418b4feda05019d4db0b5e8ae41e",
    "public/vercel.svg": "cebb8852d58c8886be3e9051a26957f42bb82f1a",
    "public/window.svg": "54c48e0daa6caa317fe1b4c419007fd93e948db9",
  };
  await Promise.all(Object.entries(original).map(([path, hash]) => assertUnchanged(path, hash)));
});

test("only the Apogee home, its community pages, the Make It Fly routes and their endpoints are routable", async () => {
  const files = [];
  const visit = async directory => {
    for (const entry of await readdir(new URL(`${directory}/`, root), { withFileTypes: true })) {
      const path = `${directory}/${entry.name}`;
      if (entry.isDirectory()) await visit(path);
      else files.push(path);
    }
  };
  await visit("app");
  assert.deepEqual(files.filter(path => /\/(?:page|layout|route)\.(?:tsx?|jsx?|mdx)$/.test(path)).sort(), [
    "app/api/applications-export/route.ts", "app/api/applications/route.ts", "app/api/checkout/route.ts",
    "app/api/gallery/admin/route.ts", "app/api/gallery/route.ts", "app/api/journey/route.ts", "app/galeria/page.tsx",
    "app/gerenciar-galeria/page.tsx", "app/layout.tsx", "app/loja/page.tsx", "app/makeitfly/layout.tsx", "app/makeitfly/page.tsx",
    "app/makeitfly/participar/page.tsx", "app/page.tsx",
  ]);
  for (const path of ["pages", "src/pages", "app/(publicado)/page.tsx", "app/(publicado)/layout.tsx", "app/(teste)/teste-terra/page.tsx", "app/(teste)/layout.tsx"]) {
    assert.equal(existsSync(new URL(path, root)), false, `${path} must not expose another page`);
  }
  assert.doesNotMatch(await source("app/layout.tsx"), /\(publicado\)|\(teste\)|published-site|components\/published/);
  assert.match(await source("components/landing/make-it-fly-v2.tsx"), /@\/components\/hero\/ApogeeHero/);
});

test("the Make It Fly page is indexable with the correct canonical and normal scrolling", async () => {
  const [publishedMetadata, publishedCss, config, pkg] = await Promise.all([
    readMetadata("app/makeitfly/layout.tsx"), source("app/globals.css"),
    source("next.config.ts"), source("package.json"),
  ]);
  assert.deepEqual(publishedMetadata.robots, { index: true, follow: true });
  assert.equal(publishedMetadata.title, "Make it fly");
  assert.equal(publishedMetadata.description, "Um dia de coworking, comunidade e foco para tirar uma ideia do papel. Primeira edição com vagas limitadas. Energizados por Red Bull.");
  assert.deepEqual(publishedMetadata.openGraph, {
    title: "Make it fly | Tire uma ideia do papel",
    description: "Coworking, comunidade e foco. Vagas limitadas.",
    locale: "pt_BR", type: "website",
  });
  assert.deepEqual(publishedMetadata.twitter, {
    card: "summary", title: "Make it fly | Tire uma ideia do papel",
    description: "Coworking, comunidade e foco. Vagas limitadas.",
  });
  const canonical = new URL(publishedMetadata.alternates?.canonical, publishedMetadata.metadataBase);
  assert.equal(canonical.href, "https://makeitfly.vercel.app/makeitfly");
  assert.doesNotMatch(JSON.stringify(publishedMetadata), /Florianópolis|Setembro|40 participantes|apoio oficial|noindex|teste-terra/i);
  assert.match(publishedCss, /overflow-x:\s*clip/);
  assert.equal(sha256(publishedCss), "a1e9a486e66f4f14df3ee567177c643d905f64bf8f93daeb180ae36858abc070");
  assert.match(config, /experimental:\s*\{\s*cssChunking:\s*false\s*\}/);
  assert.match(JSON.parse(pkg).scripts.build, /next build --webpack/);
});

test("application changes preserve the approved landing except the reviewed CTAs", async () => {
  const approved = {
    "components/landing/make-it-fly-v2.tsx": "890ad11aadad7ee32745ebbd7fd1ef23c6c8b555b4e35f8fba98969311c50d1f",
    "components/landing/EnergySupport.tsx": "05c7c43f0f20a34525d89bd94aa0373b0d1a764c400dca6352e8cace7b89f352",
    "components/landing/energy-support.module.css": "a0f4a615f89f330d38f94fac61d99070acebd0833afbd4cfb86d3bafda218753",
    "components/landing/make-it-fly-v2.module.css": "e4c253faf70677454bfa2735a0e8da33c8a4568224daec217bb56ad887ed3c9c",
    "content/site.ts": "4a1f8a09b99d4dfd7293c2600da7afd12bc49ff2cfa608cd6a8d8b7040565351",
    "public/earth/earth-bump-2k.webp": "4138be78b0d9f7717269748e0349f9c2d5f868aa970cfc92a9221cbcb6464c34",
    "public/earth/earth-clouds-2k.webp": "af30946c260a495e49070f617b693e2167fe6fde88fe785ceaa20a823c7a7da9",
    "public/earth/earth-day-2k.webp": "6c432deaa07bc9b1d3943a7eae92a06c91e547e0bfae5bfac2a61b440be3c582",
    "public/earth/earth-day-4k.webp": "68a527aaa5fda5de5bc64569e86495143c1c91a072bed4247be86ee495211200",
    "public/earth/earth-night-2k.webp": "0d31d17bbd563c0e3ad149ae4013de53c5eb21038558fca0d9e9b9a3f33da94b",
    "public/earth/earth-poster-desktop.avif": "c8120f3615b02890508d29ee30c3800f213bf0dd0e6a6e46c451785b42a62ae8",
    "public/earth/earth-poster-mobile.avif": "e36f0be204a8e5bd46bb09785e0523c05fccd2dc9e439a86661eaaf8d83c5199",
  };
  for (const [path, hash] of Object.entries(approved)) {
    const bytes = await readFile(new URL(path, root));
    const normalized = ["components/landing/make-it-fly-v2.tsx", "content/site.ts"].includes(path)
      ? restorePreApplicationSource(path, bytes) : bytes;
    assert.equal(sha256(normalized), hash, path);
  }
});

test("assets stay root-relative and the static Earth fallback remains independent of WebGL", async () => {
  const [poster, hero, scene, content] = await Promise.all([
    source("components/hero/EarthPosterFallback.tsx"), source("components/hero/ApogeeHero.tsx"),
    source("components/hero/EarthCanvas.tsx"), source("content/site.ts"),
  ]);
  assert.match(poster, /<picture\b/);
  assert.match(poster, /srcSet="\/earth\/earth-poster-mobile\.avif"/);
  assert.match(poster, /src="\/earth\/earth-poster-desktop\.avif"/);
  assert.match(hero, /<EarthPosterFallback\s+hidden=\{earthReady\}/);
  assert.match(scene, /loader\.loadAsync\(`\/earth\/\$\{name\}\.webp`\)/);
  assert.doesNotMatch(`${poster}\n${hero}\n${scene}\n${content}`, /teste-terra\//);
  assert.match(content, /"\/partners\/red-bull-can-white\.png"/);
  assert.match(content, /"\/rosa\//);
});
