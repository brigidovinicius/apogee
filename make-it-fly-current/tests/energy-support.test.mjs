import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { renderToStaticMarkup } from "react-dom/server";
import * as jsxRuntime from "react/jsx-runtime";
import ts from "typescript";

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
    react: { useRef: () => ({ current: null }) },
    "framer-motion": {
      motion: new Proxy({}, { get: (_, element) => ({ children, ...props }) => jsxRuntime.jsx(String(element), { ...props, children }) }),
      useScroll: () => ({ scrollYProgress: 0 }),
      useSpring: value => value,
      useTransform: (_, __, output) => output[0],
    },
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
  assert.equal(heading[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(), "O dia de trabalho será energizado por Red Bull.");
  assert.doesNotMatch(html, /<h[12]\b/);
  assert.doesNotMatch(heading[0], /aria-hidden="true"/);
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

test("support preserves the Energy Bar content and avoids an official-partner claim", async () => {
  const [html, content] = await Promise.all([renderSupport(), readContent()]);
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  assert.match(JSON.stringify(content), /Energy Bar com Red Bull/);
  assert.match(text, /O dia de trabalho será energizado por Red Bull\./);
  assert.doesNotMatch(text, /(?:parceir[oa]|patrocinador[ae]?|patrocínio|apoio)\s+oficial|official\s+(?:partner|sponsor)|aprovad[oa]\s+pela\s+Red Bull|endossad[oa]\s+pela\s+Red Bull/i);
  assert.doesNotMatch(html, /<a\b|<button\b|<form\b/, "the support band does not introduce another destination or CTA");
});

test("the support band appears once between the experience editorial and journey", async () => {
  const source = await readSource("components/landing/make-it-fly-v2.tsx");
  const file = parse(source);
  const supportNodes = nodesMatching(file, node => tag(node)?.tagName.getText(file) === "EnergySupport");
  assert.equal(supportNodes.length, 1);
  const support = supportNodes[0];
  const experience = nodesMatching(file, node => stringAttribute(node, "id") === "experiencia")[0];
  const journey = nodesMatching(file, node => stringAttribute(node, "id") === "jornada")[0];
  assert.ok(experience && journey);
  assert.ok(experience.end <= support.pos && support.end <= journey.pos);
});

test("support has its own measured scroll scene without changing the primary section order", async () => {
  const [landing, hero, support] = await Promise.all([
    readSource("components/landing/make-it-fly-v2.tsx"),
    readSource("components/hero/ApogeeHero.tsx"),
    readSource("components/landing/EnergySupport.tsx"),
  ]);
  const ids = nodesMatching(parse(`${hero}\n${landing}`), node => Boolean(attribute(node, "data-flight-section")))
    .map(node => stringAttribute(node, "id"));
  assert.deepEqual(ids, ["inicio", "experiencia", "jornada", "programacao", "manifesto", "quem-conduz", "participar", "galeria-preview"]);
  assert.match(support, /data-flight-section/);
  assert.match(support, /useScroll/);
  assert.doesNotMatch(support, /<section\b|Canvas|useFrame/);
});

test("approved landing and footer retain their reviewed source bytes", async () => {
  const source = await readSource("components/landing/make-it-fly-v2.tsx");
  assert.equal(sha256(source), "0d324833fbdee9e3664a98cdca4f23e75149bc0f8f3dcc640741b63f3e57ba61");
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
    "components/hero/HeroContent.tsx": "55bf76317b773ed9d1f7aa66ac931e8b5c326613a45c9043bb7ae252e1f3d519",
    "components/hero/EarthPosterFallback.tsx": "2ef38eada43248edb3aa3345ca8bc7653efc72b72814040e1a6b153ea1e1881c",
    "lib/apogee-motion-policy.ts": "710df8f9f5fedaabdaf48921ffb3f66e96a6948ca4bf8a42371ea1bf2f76594b",
    "lib/apogee-scroll.ts": "07df4da2df36795f0d8617d7016e494eecb3e3e653f661906005e3d26e82927b",
    "lib/apogee-config.ts": "414b9fe083d81cec18e03371cc151ee21c3577d29f4ee7a5dc0bbf6c0e7501f3",
    "public/partners/red-bull-can-white.png": "10c66a9050b33597b6b2918f3998ec8b2962179f356bfba952d7fd94d311f938",
  };
  for (const [path, hash] of Object.entries(expected)) {
    const bytes = await readFile(new URL(`../${path}`, import.meta.url));
    assert.equal(sha256(bytes), hash, path);
  }
});

test("support styling is local, responsive and does not interfere with the global flight layer", async () => {
  const css = await readSource("components/landing/energy-support.module.css");
  assert.match(css, /@media\s*\(max-width:\s*767px\)/);
  assert.match(css, /\.can\s*\{[^}]*height:\s*auto/);
  assert.match(css, /\.stickyScene\s*\{[^}]*position\s*:\s*sticky/);
  assert.doesNotMatch(css, /position\s*:\s*fixed|scroll-snap|scroll-behavior|:global|\bcanvas\b|\.flight\b|\b(?:html|body)\s*\{/);
});
