import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { renderToStaticMarkup } from "react-dom/server";
import * as jsxRuntime from "react/jsx-runtime";
import ts from "typescript";
import { restorePreApplicationSource } from "./application-preservation.mjs";

const readSource = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const sha256 = value => createHash("sha256").update(value).digest("hex");
const parse = (source, path = "component.tsx") => ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const tag = node => ts.isJsxElement(node) ? node.openingElement : ts.isJsxSelfClosingElement(node) ? node : undefined;
const attribute = (node, name) => tag(node)?.attributes.properties.find(property => ts.isJsxAttribute(property) && property.name.getText() === name);
const stringAttribute = (node, name) => {
  const initializer = attribute(node, name)?.initializer;
  return initializer && ts.isStringLiteral(initializer) ? initializer.text : undefined;
};
const nodesMatching = (node, predicate, result = []) => {
  if (predicate(node)) result.push(node);
  ts.forEachChild(node, child => { nodesMatching(child, predicate, result); });
  return result;
};

async function readContent() {
  const source = await readSource("content/site.ts");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}

async function renderSupport() {
  const source = await readSource("components/landing/EnergySupport.tsx");
  const { outputText } = ts.transpileModule(source, {
    fileName: "EnergySupport.tsx",
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  });
  // Render the real component as HTML; image optimization and CSS bundling are
  // excluded, so these assertions do not claim browser-layout coverage.
  const dependencies = {
    "react/jsx-runtime": jsxRuntime,
    "@/content/site": await readContent(),
    "next/image": { default: props => jsxRuntime.jsx("img", props) },
    "./energy-support.module.css": { default: new Proxy({}, { get: (_, key) => String(key) }) },
  };
  const exports = {};
  new Function("require", "exports", outputText)(specifier => {
    assert.ok(Object.hasOwn(dependencies, specifier), `Unexpected EnergySupport import: ${specifier}`);
    return dependencies[specifier];
  }, exports);
  return renderToStaticMarkup(jsxRuntime.jsx(exports.EnergySupport, {}));
}

test("energy support renders a labelled aside and the requested heading as accessible text", async () => {
  const html = await renderSupport();
  assert.match(html, /<aside\b[^>]*id="energia"[^>]*aria-labelledby="energy-support-title"/);
  const heading = html.match(/<h3\b[^>]*id="energy-support-title"[^>]*>([\s\S]*?)<\/h3>/);
  assert.ok(heading, "the endorsement follows the experience h2 as an h3");
  assert.equal(heading[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim(), "Energizados por Red Bull");
  assert.doesNotMatch(html, /<h[12]\b|aria-hidden="true"/);
});

test("energy support uses only the supplied can artwork with meaningful alternative text", async () => {
  const html = await renderSupport();
  const images = html.match(/<img\b[^>]*>/g) ?? [];
  assert.equal(images.length, 1, "no separate logo or additional branded image is introduced");
  assert.match(images[0], /src="\/partners\/red-bull-can-white\.png"/);
  assert.match(images[0], /alt="Ilustração de uma lata Red Bull"/);
  assert.match(images[0], /width="1726"/);
  assert.match(images[0], /height="4918"/);
  assert.doesNotMatch(html, /<svg\b|<picture\b|src="[^"]*(?:red-?bull-logo|redbull\.svg|red-bull\.svg)/i);
});

test("support mentions the existing Energy Bar without inventing an official-partner claim", async () => {
  const [html, content] = await Promise.all([renderSupport(), readContent()]);
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  assert.match(JSON.stringify(content), /Energy Bar com Red Bull/);
  assert.match(text, /Energy Bar com Red Bull para acompanhar o dia de criação e conexões\./);
  assert.doesNotMatch(text, /(?:parceir[oa]|patrocinador[ae]?|patrocínio|apoio)\s+oficial|official\s+(?:partner|sponsor)|aprovad[oa]\s+pela\s+Red Bull|endossad[oa]\s+pela\s+Red Bull/i);
  assert.doesNotMatch(html, /<a\b|<button\b|<form\b/, "the support band does not introduce another destination or CTA");
});

test("the support band appears once inside experience after the editorial block and before the ticker", async () => {
  const source = await readSource("components/landing/make-it-fly-v2.tsx");
  const file = parse(source);
  const supportNodes = nodesMatching(file, node => tag(node)?.tagName.getText(file) === "EnergySupport");
  assert.equal(supportNodes.length, 1);
  const support = supportNodes[0];
  assert.match(attribute(support.parent, "className")?.getText(file) ?? "", /styles\.sectionInner/);
  let section = support.parent;
  while (section && stringAttribute(section, "id") !== "experiencia") section = section.parent;
  assert.ok(section, "EnergySupport belongs to the existing experience section");
  const editorial = nodesMatching(section, node => /styles\.editorialSplit/.test(attribute(node, "className")?.getText(file) ?? ""))[0];
  const ticker = nodesMatching(section, node => /styles\.disciplineTicker/.test(attribute(node, "className")?.getText(file) ?? ""))[0];
  assert.ok(editorial && ticker);
  assert.ok(editorial.end <= support.pos && support.end <= ticker.pos);
});

test("support does not add a flight milestone or alter the seven-section sequence", async () => {
  const [landing, hero, support] = await Promise.all([
    readSource("components/landing/make-it-fly-v2.tsx"),
    readSource("components/hero/ApogeeHero.tsx"),
    readSource("components/landing/EnergySupport.tsx"),
  ]);
  const ids = nodesMatching(parse(`${hero}\n${landing}`), node => Boolean(attribute(node, "data-flight-section")))
    .map(node => stringAttribute(node, "id"));
  assert.deepEqual(ids, ["inicio", "experiencia", "jornada", "programacao", "manifesto", "quem-conduz", "participar"]);
  assert.doesNotMatch(support, /data-flight-section|<section\b|Canvas|useScroll|useFrame/);
});

test("approved landing and footer remain identical outside support and participation CTA changes", async () => {
  const source = await readSource("components/landing/make-it-fly-v2.tsx");
  const previous = restorePreApplicationSource("components/landing/make-it-fly-v2.tsx", source)
    .replace(/^import \{ EnergySupport \} from "\.\/EnergySupport";\n/m, "")
    .replace(/^[\t ]*<EnergySupport \/>\n/m, "");
  assert.equal(sha256(previous), "172c3019c4d180eac53860536f73407a786ad22c7802b6d127e417d7d81d1b67");
});

test("Earth animation, hero and supplied can retain their approved hashes", async () => {
  // Captured before this bounded support-band change. Intentional future scene
  // changes require their own review before updating this preservation baseline.
  const expected = {
    "components/hero/ApogeeHero.tsx": "8422976557816669d1ca2be0214464b8b463ac9f0c24f7b2d1909645ecb6bdcd",
    "components/hero/ApogeeFlight.tsx": "2ec569da0d6038647b99b9673ceef7298c1ed12f18a3afe5d4f9e754729c2eec",
    "components/hero/useApogeeTimeline.ts": "c58e7503c90a2cb4a1ea664acd7edd6066fe86395e9cafc673703783c09f9335",
    "components/hero/apogee.module.css": "6277bc651b53166b0f3d76f802ff38b8b1bf18f179d01916deaa839f3657ca2a",
    "components/hero/EarthCanvas.tsx": "1620386ff6f1524b777a89b3a3ca562023b2bd229b2d444708419ecea06d1a94",
    "components/hero/EarthGlobe.tsx": "1ad77c62c57005533abd7d189f0ddb166e362dad162b10c0225624e834d2315e",
    "components/hero/StarField.tsx": "a73169c7aa120f90d745da4ed205348c3c3d3e994764d6d927bde81fd17fe104",
    "components/hero/Atmosphere.tsx": "04e3e228421aa33b847852f78719624f755fa4561b40a1c5ef1a629735dd2dba",
    "components/hero/HeroContent.tsx": "c53f4a34b688ea1d74ffd7f0a0c79c0ed594aca9a162f4d5803c46ac1f611cc2",
    "components/hero/EarthPosterFallback.tsx": "2ef38eada43248edb3aa3345ca8bc7653efc72b72814040e1a6b153ea1e1881c",
    "lib/apogee-motion-policy.ts": "710df8f9f5fedaabdaf48921ffb3f66e96a6948ca4bf8a42371ea1bf2f76594b",
    "lib/apogee-scroll.ts": "07df4da2df36795f0d8617d7016e494eecb3e3e653f661906005e3d26e82927b",
    "lib/apogee-config.ts": "414b9fe083d81cec18e03371cc151ee21c3577d29f4ee7a5dc0bbf6c0e7501f3",
    "public/partners/red-bull-can-white.png": "10c66a9050b33597b6b2918f3998ec8b2962179f356bfba952d7fd94d311f938",
  };
  for (const [path, hash] of Object.entries(expected)) {
    const bytes = await readFile(new URL(`../${path}`, import.meta.url));
    assert.equal(sha256(path === "components/hero/HeroContent.tsx" ? restorePreApplicationSource(path, bytes) : bytes), hash, path);
  }
});

test("support styling remains local, responsive and outside the scrolling machinery", async () => {
  const css = await readSource("components/landing/energy-support.module.css");
  assert.match(css, /@media\s*\(max-width:\s*767px\)/);
  assert.match(css, /\.can\s*\{[^}]*height:\s*auto/);
  assert.doesNotMatch(css, /position\s*:\s*(?:fixed|sticky)|scroll-snap|scroll-behavior|:global|\bcanvas\b|\.flight\b|\b(?:html|body)\s*\{/);
});
