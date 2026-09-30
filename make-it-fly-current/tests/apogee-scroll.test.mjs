import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(new URL("../lib/apogee-scroll.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } });
const { flightProgress, flightAnchors } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
const sectionTops = [0, 1000, 2300, 4200, 5300, 6900, 8100];
const anchors = [0, 800, 2100, 4000, 5100, 6700, 7900, 9300];

function closeTo(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 1e-12, `${actual} should equal ${expected}`);
}

test("section flight maps the entire document to seven distinct intervals", () => {
  anchors.forEach((scrollY, index) => closeTo(flightProgress(scrollY, anchors), index / 7));
  for (let section = 0; section < 7; section++) {
    for (const fraction of [0.1, 0.25, 0.5, 0.9]) {
      const scrollY = anchors[section] + (anchors[section + 1] - anchors[section]) * fraction;
      closeTo(flightProgress(scrollY, anchors), (section + fraction) / 7);
    }
  }
  assert.ok(flightProgress(sectionTops[1], anchors) < 0.2, "the animation must not finish when the hero leaves");
  assert.ok(flightProgress(sectionTops[6], anchors) > 0.85, "the participation section remains part of the flight");
});

test("flight progress clamps bounds and safely rejects non-finite scroll input", () => {
  for (const scrollY of [-100, -1, -0.01, 0]) assert.equal(flightProgress(scrollY, anchors), 0);
  for (const scrollY of [anchors.at(-1), 10000, Number.MAX_VALUE]) assert.equal(flightProgress(scrollY, anchors), 1);
  for (const scrollY of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    assert.equal(flightProgress(scrollY, anchors), 0);
  }
});

test("1001 document-scroll samples are deterministic, bounded and monotonically increasing", () => {
  let previous = 0;
  for (let index = 0; index <= 1000; index++) {
    const scrollY = anchors.at(-1) * index / 1000;
    const progress = flightProgress(scrollY, anchors);
    assert.equal(progress, flightProgress(scrollY, anchors));
    assert.ok(Number.isFinite(progress) && progress >= 0 && progress <= 1);
    assert.ok(progress >= previous);
    previous = progress;
  }
  assert.equal(previous, 1);
});

test("anchors follow actual section geometry and document end at five viewport heights", () => {
  for (const viewportHeight of [900, 800, 1024, 844, 700]) {
    const documentHeight = 10300;
    const original = [...sectionTops];
    const measured = flightAnchors(Object.freeze([...sectionTops]), viewportHeight, documentHeight);
    assert.deepEqual(sectionTops, original, "measuring geometry must not mutate section positions");
    assert.equal(measured.length, 8);
    assert.equal(measured[0], 0);
    assert.equal(measured.at(-1), documentHeight - viewportHeight);
    for (let index = 1; index < measured.length; index++) {
      assert.ok(Number.isFinite(measured[index]) && measured[index] > measured[index - 1]);
      if (index < sectionTops.length) {
        const lead = sectionTops[index] - measured[index];
        assert.ok(lead >= viewportHeight * 0.15 && lead <= viewportHeight * 0.25, "each section arrives near the upper fifth of the viewport");
      }
      closeTo(flightProgress(measured[index], measured), index / 7);
    }
  }
});

test("reverse scrolling retraces exactly the same 1001 frames without hidden history", () => {
  const forward = Array.from({ length: 1001 }, (_, index) => flightProgress(anchors.at(-1) * index / 1000, anchors));
  let previous = 1;
  for (let index = 1000; index >= 0; index--) {
    const progress = flightProgress(anchors.at(-1) * index / 1000, anchors);
    assert.equal(progress, forward[index]);
    assert.ok(progress <= previous);
    previous = progress;
  }
  assert.equal(previous, 0);
  for (let index = 1; index < anchors.length; index++) {
    assert.ok(flightProgress(anchors[index] - 1, anchors) < index / 7);
  }
});

test("flight stays fixed while all content retains natural scrolling without a pinned stage", async () => {
  const [hero, flight, css, timeline] = await Promise.all([
    readFile(new URL("../components/hero/ApogeeHero.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/hero/ApogeeFlight.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/hero/apogee.module.css", import.meta.url), "utf8"),
    readFile(new URL("../components/hero/useApogeeTimeline.ts", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(`${hero}\n${flight}`, /OrbitOverlay|styles\.sticky/);
  assert.doesNotMatch(css, /position\s*:\s*sticky\b/i);
  assert.doesNotMatch(css, /(?:min-|max-)?height\s*:\s*(?:260|160)(?:s|d|l)?vh\b/i);
  assert.match(css, /\.frame\s*\{[^}]*position\s*:\s*relative[^}]*height\s*:\s*100svh/);
  assert.doesNotMatch(css.match(/\.frame\s*\{[^}]*\}/)?.[0] ?? "", /isolation\s*:\s*isolate/);
  assert.match(css, /position\s*:\s*fixed/);
  assert.match(timeline, /flightProgress/);
  assert.match(timeline, /flightAnchors/);
  assert.match(timeline, /data-flight-section/);
  assert.doesNotMatch(timeline, /useSpring/);
  assert.doesNotMatch(timeline, /preventDefault\s*\(|scrollTo\s*\(|scrollBy\s*\(|addEventListener\s*\(\s*["'](?:wheel|touchmove)["']/);
  assert.doesNotMatch(timeline, /document\.body\.style\.(?:overflow|position)/);
  assert.match(hero, /<HeroContent\b/);
});

test("normal-flow hero preserves HTML content, navigation and fallback independently of the canvas", async () => {
  const [hero, flight, content, landing] = await Promise.all([
    readFile(new URL("../components/hero/ApogeeHero.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/hero/ApogeeFlight.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/hero/HeroContent.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/landing/make-it-fly-v2.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(flight, /ssr:\s*false/);
  assert.match(hero, /<EarthPosterFallback\b/);
  assert.doesNotMatch(flight, /<EarthPosterFallback\b/);
  assert.match(hero, /aria-labelledby="hero-title"/);
  assert.match(content, /<h1\s+id="hero-title"/);
  assert.match(content, /ABERTURA\.descricao/);
  assert.match(content, /<ApplicationLink\s+className=\{styles\.cta\}/);
  const applicationLink = await readFile(new URL("../components/application/ApplicationLink.tsx", import.meta.url), "utf8");
  assert.match(applicationLink, /href="\/makeitfly\/participar"/);
  assert.match(landing, /<header\b/);
  assert.match(landing, /<nav\b[^>]*aria-label="Navegação principal"/);
});
