import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { renderToStaticMarkup } from "react-dom/server";
import * as jsxRuntime from "react/jsx-runtime";
import ts from "typescript";

const readSource = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

async function readContent() {
  const source = await readSource("content/site.ts");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}

async function renderHeroContent() {
  const source = await readSource("components/hero/HeroContent.tsx");
  const content = await readContent();
  const linkSource = await readSource("components/application/ApplicationLink.tsx");
  const linkOutput = ts.transpileModule(linkSource, {
    fileName: "ApplicationLink.tsx",
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const linkExports = {};
  new Function("require", "exports", linkOutput)(specifier => {
    if (specifier === "react/jsx-runtime") return jsxRuntime;
    if (specifier === "next/link") return { default: ({ href, className, children }) => jsxRuntime.jsx("a", { href, className, children }) };
    if (specifier === "@/components/analytics/journey-client") return { flushJourneyEvents() {}, trackJourney() {} };
    if (specifier === "./application-client") return { rememberAttribution() {} };
    throw new Error(`Unexpected ApplicationLink import: ${specifier}`);
  }, linkExports);
  const { outputText } = ts.transpileModule(source, {
    fileName: "HeroContent.tsx",
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  });
  // Render the actual content component without Next's image optimizer or CSS
  // bundler. This verifies HTML structure, not browser layout or hydration.
  const dependencies = {
    "react/jsx-runtime": jsxRuntime,
    "@/content/site": content,
    "@/components/application/ApplicationLink": linkExports,
    "next/image": { default: props => jsxRuntime.jsx("img", props) },
    "./apogee.module.css": { default: new Proxy({}, { get: (_, key) => String(key) }) },
  };
  const exports = {};
  new Function("require", "exports", outputText)(specifier => {
    assert.ok(Object.hasOwn(dependencies, specifier), `Unexpected HeroContent import: ${specifier}`);
    return dependencies[specifier];
  }, exports);
  return renderToStaticMarkup(jsxRuntime.jsx(exports.HeroContent, {}));
}

test("automatic test hero renders no motion button, hidden control or September date", async () => {
  const html = await renderHeroContent();
  assert.doesNotMatch(html, /<button\b|role="button"|aria-pressed=|data-motion-choice|motionToggle|motionChoice/i);
  assert.doesNotMatch(html, /(?:ativar|pausar|desativar)\s+animação|setembro|2026/i);
  assert.doesNotMatch(html, /<(?:div|span|p)\b[^>]*class="location"[^>]*>\s*<\/(?:div|span|p)>/i);
});

test("automatic test hero preserves nonempty sponsorship, accessible title and participation CTA", async () => {
  const html = await renderHeroContent();
  assert.match(html, /Energizados por Red Bull/);
  assert.match(html, /src="\/partners\/red-bull-can-white\.png"/);
  assert.match(html, /alt="Ilustração de uma lata Red Bull"/);
  assert.doesNotMatch(html, /<(?:div|span)\b[^>]*class="support"[^>]*>\s*<\/(?:div|span)>/i);
  assert.match(html, /<h1\b[^>]*id="hero-title"/);
  assert.match(html, /href="\/makeitfly\/participar"[^>]*>Quero participar do evento/);
  assert.match(html, /Vagas limitadas/);
});

test("September is absent from approved content, public metadata and landing copy", async () => {
  for (const path of ["content/site.ts", "app/layout.tsx", "components/landing/make-it-fly-v2.tsx"]) {
    const source = await readSource(path);
    const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const copy = [];
    const collect = node => {
      if (ts.isStringLiteralLike(node) || ts.isJsxText(node)) copy.push(node.text);
      ts.forEachChild(node, collect);
    };
    collect(file);
    assert.doesNotMatch(copy.join("\n"), /setembro|2026/i, `${path} must not retain the removed date`);
  }
  const content = await readContent();
  assert.doesNotMatch(JSON.stringify(content), /setembro|2026/i);
  assert.equal(content.PARTICIPAR.botao.href, "/makeitfly/participar");
  assert.equal(content.ABERTURA.apoio.rotulo, "Energizados por Red Bull");
});

test("test scene starts from capability policy without an opt-in control or preference listener", async () => {
  const [hero, flight, timeline, css] = await Promise.all([
    readSource("components/hero/ApogeeHero.tsx"),
    readSource("components/hero/ApogeeFlight.tsx"),
    readSource("components/hero/useApogeeTimeline.ts"),
    readSource("components/hero/apogee.module.css"),
  ]);
  assert.match(flight, /resolveApogeeMotion\s*\(/);
  assert.doesNotMatch(`${hero}\n${flight}`, /motionOptIn|motionChoice|showMotionChoice|setMotionOptIn|data-motion-choice|<button\b/);
  assert.doesNotMatch(timeline, /prefers-reduced-motion|systemReduced|motionOptIn/);
  assert.doesNotMatch(css, /\.motionToggle|data-motion-choice/);
  assert.match(hero, /<EarthPosterFallback\b/);
  assert.match(flight, /readyVersion\s*===\s*timeline\.sceneVersion/);
});

test("a single persistent flight layer is a sibling of the naturally scrolling main content", async () => {
  const [hero, flight, landing] = await Promise.all([
    readSource("components/hero/ApogeeHero.tsx"),
    readSource("components/hero/ApogeeFlight.tsx"),
    readSource("components/landing/make-it-fly-v2.tsx"),
  ]);
  assert.equal((flight.match(/<EarthCanvas\b/g) ?? []).length, 1);
  assert.doesNotMatch(`${hero}\n${landing}`, /<EarthCanvas\b/);
  assert.equal((landing.match(/<ApogeeFlight\b/g) ?? []).length, 1);

  const file = ts.createSourceFile("landing.tsx", landing, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let main;
  let flightNode;
  const collect = node => {
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText(file) === "main") main = node;
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(file) === "ApogeeFlight") flightNode = node;
    ts.forEachChild(node, collect);
  };
  collect(file);
  assert.ok(main && flightNode, "both the flight and semantic main content must exist");
  assert.equal(flightNode.parent, main.parent, "the flight cannot live inside the clipped hero or a single section");
  assert.match(main.getText(file), /<ApogeeHero\b/);
  for (const section of ["experiencia", "jornada", "programacao", "manifesto", "quem-conduz", "participar"]) {
    assert.match(main.getText(file), new RegExp(`id="${section}"`));
  }
});

test("global scene remains demand-rendered beyond the hero and preserves its failure safeguards", async () => {
  const [canvas, flight, timeline] = await Promise.all([
    readSource("components/hero/EarthCanvas.tsx"),
    readSource("components/hero/ApogeeFlight.tsx"),
    readSource("components/hero/useApogeeTimeline.ts"),
  ]);
  assert.match(canvas, /frameloop=\{active\s*\?\s*"demand"\s*:\s*"never"\}/);
  assert.match(canvas, /progress\.on\("change"/);
  assert.match(canvas, /webglcontextlost/);
  assert.match(canvas, /onError/);
  assert.match(flight, /lowPower/);
  assert.match(flight, /failed/);
  assert.match(timeline, /visibilitychange/);
  assert.doesNotMatch(timeline, /new IntersectionObserver/);
});

test("foreground content and footer stay above the noninteractive flight layer", async () => {
  const [heroCss, landingCss] = await Promise.all([
    readSource("components/hero/apogee.module.css"),
    readSource("components/landing/make-it-fly-v2.module.css"),
  ]);
  const rule = (source, name) => {
    const block = source.match(new RegExp(`\\.${name}\\s*\\{([^}]*)\\}`));
    assert.ok(block, `Missing .${name} rule`);
    return block[1];
  };
  const flight = rule(heroCss, "flight");
  const content = rule(heroCss, "content");
  const sectionContent = rule(landingCss, "sectionInner");
  const footer = rule(landingCss, "footer");
  const zIndex = block => Number(block.match(/z-index\s*:\s*(-?\d+)/)?.[1]);
  assert.match(flight, /position\s*:\s*fixed/);
  assert.match(flight, /pointer-events\s*:\s*none/);
  assert.ok(Number.isFinite(zIndex(flight)));
  for (const foreground of [content, sectionContent, footer]) {
    assert.ok(zIndex(foreground) > zIndex(flight), "readable content remains above the persistent canvas");
  }
  assert.match(footer, /background\s*:\s*var\(--ink\)/, "opaque footer obscures the globe without relying on a zero-opacity final frame");
});
